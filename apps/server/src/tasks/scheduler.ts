import type { Db } from "@ownlab/db";
import { and, eq, lte, tasks } from "@ownlab/db";
import { createHeartbeatService } from "../heartbeat/service.js";

export function createTaskScheduler(db: Db) {
  const heartbeatService = createHeartbeatService(db);
  let timer: NodeJS.Timeout | null = null;

  function start(intervalMs = 15000) {
    if (timer) {
      return;
    }

    timer = setInterval(() => {
      void (async () => {
        const dueTasks = await db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.scheduleEnabled, true),
              lte(tasks.nextRunAt, new Date()),
            ),
          )
          .limit(5);

        for (const task of dueTasks) {
          const mode = typeof task.metadata?.mode === "string" ? task.metadata.mode : null;
          if (mode !== "scheduled" || task.status === "running") {
            continue;
          }
          await heartbeatService.invokeTask(task.id);
        }
      })().catch((error) => {
        console.error("Task scheduler failed:", error);
      });
    }, intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
  };
}
