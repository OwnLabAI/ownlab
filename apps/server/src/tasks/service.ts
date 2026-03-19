import type { Db } from "@ownlab/db";
import {
  and,
  desc,
  eq,
  heartbeatRuns,
  isNull,
  taskboards,
  tasks,
  teams,
} from "@ownlab/db";
import { stopTaskRuns } from "./run-control-service.js";

type TaskMode = "scheduled" | "auto";

type CreateTaskInput = {
  boardId?: string | null;
  workspaceId?: string | null;
  parentId?: string | null;
  title: string;
  objective?: string | null;
  status?: string;
  priority?: string;
  groupName?: string | null;
  assigneeAgentId?: string | null;
  assigneeTeamId?: string | null;
  scheduleEnabled?: boolean;
  scheduleType?: string;
  intervalSec?: number | null;
  mode?: TaskMode;
};

type UpdateTaskInput = Partial<CreateTaskInput> & {
  lastResultSummary?: string | null;
};

function inferTaskMode(input: {
  mode?: TaskMode;
  scheduleEnabled?: boolean | null;
}): TaskMode {
  if (input.mode) {
    return input.mode;
  }
  if (input.scheduleEnabled) {
    return "scheduled";
  }
  return "auto";
}

export function createTaskService(db: Db) {
  async function resolveDelegation(input: {
    assigneeAgentId?: string | null;
    assigneeTeamId?: string | null;
  }) {
    if (input.assigneeTeamId) {
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, input.assigneeTeamId))
        .limit(1);

      if (!team) {
        throw new Error("Assigned team not found");
      }
      if (!team.leaderAgentId) {
        throw new Error("Assigned team has no leader agent");
      }

      return {
        assigneeAgentId: team.leaderAgentId,
        metadataPatch: {
          delegationTargetType: "team",
          delegationTargetId: team.id,
          delegationTargetLabel: team.name,
        },
      };
    }

    if (input.assigneeAgentId) {
      return {
        assigneeAgentId: input.assigneeAgentId,
        metadataPatch: {
          delegationTargetType: "agent",
          delegationTargetId: input.assigneeAgentId,
          delegationTargetLabel: null,
        },
      };
    }

    return {
      assigneeAgentId: null,
      metadataPatch: {
        delegationTargetType: null,
        delegationTargetId: null,
        delegationTargetLabel: null,
      },
    };
  }

  async function listTasksByBoard(boardId: string) {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.boardId, boardId), isNull(tasks.parentId)))
      .orderBy(desc(tasks.createdAt));
  }

  async function getTaskById(id: string) {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return task ?? null;
  }

  async function listChildTasks(taskId: string) {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.parentId, taskId))
      .orderBy(desc(tasks.createdAt));
  }

  async function listTaskRuns(taskId: string) {
    const task = await getTaskById(taskId);
    if (!task || task.metadata?.mode !== "scheduled") {
      return [];
    }

    const runs = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.taskId, taskId))
      .orderBy(desc(heartbeatRuns.createdAt))
      .limit(20);

    return runs.map((run) => ({
      id: run.id,
      taskId,
      status: run.status,
      trigger: run.triggerDetail ?? run.invocationSource,
      runKind: "heartbeat",
      summary:
        typeof run.resultJson === "object" &&
        run.resultJson !== null &&
        "summary" in run.resultJson &&
        typeof run.resultJson.summary === "string"
          ? run.resultJson.summary
          : null,
      error: run.error,
      startedAt: run.startedAt?.toISOString() ?? run.createdAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    }));
  }

  async function getTaskDetail(taskId: string) {
    const task = await getTaskById(taskId);
    if (!task) {
      return null;
    }

    const [children, runs, parentTask] = await Promise.all([
      listChildTasks(taskId),
      listTaskRuns(taskId),
      task.parentId ? getTaskById(task.parentId) : Promise.resolve(null),
    ]);

    return {
      task,
      parentTask,
      children,
      runs,
      metrics: [],
    };
  }

  async function createTask(input: CreateTaskInput) {
    let resolvedLabId: string | null = null;
    if (input.parentId) {
      const parent = await getTaskById(input.parentId);
      resolvedLabId = parent?.labId ?? null;
    } else if (input.boardId) {
      const [board] = await db
        .select()
        .from(taskboards)
        .where(eq(taskboards.id, input.boardId))
        .limit(1);
      resolvedLabId = board?.labId ?? null;
    }

    if (!resolvedLabId) {
      throw new Error("Unable to resolve lab for task");
    }

    const mode = inferTaskMode(input);
    const scheduleEnabled = input.scheduleEnabled ?? mode === "scheduled";
    const scheduleType = scheduleEnabled ? (input.scheduleType ?? "interval") : "manual";
    const intervalSec = scheduleEnabled ? (input.intervalSec ?? 1800) : null;
    const delegation = await resolveDelegation(input);
    const nextRunAt =
      scheduleEnabled && scheduleType === "interval" && intervalSec
        ? new Date(Date.now() + intervalSec * 1000)
        : null;

    const [task] = await db
      .insert(tasks)
      .values({
        labId: resolvedLabId,
        boardId: input.boardId ?? null,
        workspaceId: input.workspaceId ?? null,
        parentId: input.parentId ?? null,
        type: mode,
        title: input.title.trim(),
        objective: input.objective ?? null,
        description: null,
        status: input.status ?? "backlog",
        priority: input.priority ?? "medium",
        groupName: input.groupName ?? null,
        assigneeAgentId: delegation.assigneeAgentId,
        scheduleEnabled,
        scheduleType,
        intervalSec,
        nextRunAt,
        metadata: {
          mode,
          ...delegation.metadataPatch,
        },
      })
      .returning();

    return task;
  }

  async function updateTask(id: string, patch: UpdateTaskInput) {
    const existing = await getTaskById(id);
    if (!existing) {
      return null;
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    for (const key of [
      "boardId",
      "workspaceId",
      "parentId",
      "title",
      "objective",
      "status",
      "priority",
      "groupName",
      "assigneeAgentId",
      "scheduleEnabled",
      "scheduleType",
      "intervalSec",
      "lastResultSummary",
    ] as const) {
      if (patch[key] !== undefined) {
        updates[key] = patch[key] ?? null;
      }
    }

    if (
      patch.mode !== undefined ||
      patch.scheduleEnabled !== undefined ||
      patch.scheduleType !== undefined ||
      patch.intervalSec !== undefined
    ) {
      const mode = inferTaskMode({
        mode: patch.mode,
        scheduleEnabled: patch.scheduleEnabled ?? existing.scheduleEnabled,
      });
      const scheduleEnabled = patch.scheduleEnabled ?? mode === "scheduled";
      const scheduleType = scheduleEnabled
        ? (patch.scheduleType ?? existing.scheduleType ?? "interval")
        : "manual";
      const intervalSec = scheduleEnabled ? (patch.intervalSec ?? existing.intervalSec ?? 1800) : null;

      updates.type = mode;
      updates.scheduleEnabled = scheduleEnabled;
      updates.scheduleType = scheduleType;
      updates.intervalSec = intervalSec;
      updates.nextRunAt =
        scheduleEnabled && scheduleType === "interval" && intervalSec
          ? new Date(Date.now() + intervalSec * 1000)
          : null;
      updates.metadata = {
        ...(existing.metadata ?? {}),
        mode,
      };
    }

    if (patch.assigneeAgentId !== undefined || patch.assigneeTeamId !== undefined) {
      const delegation = await resolveDelegation({
        assigneeAgentId: patch.assigneeAgentId,
        assigneeTeamId: patch.assigneeTeamId,
      });
      updates.assigneeAgentId = delegation.assigneeAgentId;
      updates.metadata = {
        ...(typeof updates.metadata === "object" && updates.metadata !== null
          ? (updates.metadata as Record<string, unknown>)
          : (existing.metadata ?? {})),
        ...delegation.metadataPatch,
      };
    }

    const [task] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();

    return task ?? null;
  }

  async function deleteTaskTree(taskId: string): Promise<void> {
    const children = await listChildTasks(taskId);
    for (const child of children) {
      await deleteTaskTree(child.id);
    }

    await db.delete(heartbeatRuns).where(eq(heartbeatRuns.taskId, taskId));
    await db.delete(tasks).where(eq(tasks.id, taskId));
  }

  async function deleteTask(id: string) {
    const existing = await getTaskById(id);
    if (!existing) {
      return null;
    }
    await deleteTaskTree(id);
    return existing;
  }

  async function enqueueTaskRun(taskId: string) {
    const task = await getTaskById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    if (task.status === "running") {
      throw new Error("Task is already running");
    }
    if (task.metadata?.mode === "auto") {
      throw new Error("Auto mode is not implemented yet");
    }

    throw new Error("Scheduled tasks should run through the heartbeat service");
  }

  async function stopTask(taskId: string) {
    const task = await getTaskById(taskId);
    if (!task) {
      return null;
    }

    if (task.status !== "running") {
      throw new Error("Task is not running");
    }

    const result = stopTaskRuns(taskId);
    if (!result.stopped) {
      throw new Error("No running task process found");
    }

    const [updated] = await db
      .update(tasks)
      .set({
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    return updated ?? task;
  }

  return {
    listTasksByBoard,
    getTaskById,
    getTaskDetail,
    createTask,
    updateTask,
    deleteTask,
    enqueueTaskRun,
    stopTask,
  };
}
