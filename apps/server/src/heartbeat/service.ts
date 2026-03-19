import { randomUUID } from "node:crypto";
import type { Db } from "@ownlab/db";
import {
  agents,
  tasks,
  heartbeatRuns,
  eq,
  desc,
} from "@ownlab/db";
import type {
  AdapterAgent,
  AdapterRuntime,
  AdapterExecutionResult,
} from "@ownlab/adapter-utils";
import { getServerAdapter } from "../adapters/registry.js";
import { createChannelService } from "../channels/service.js";
import {
  buildAgencyPromptNote,
  ensureAgencyProfileMaterialized,
  type AgencyProfileMaterialization,
} from "../agency/profile.js";

function buildTaskPrompt(
  task: { title: string; objective: string | null },
  agencyProfile: AgencyProfileMaterialization | null,
): string {
  const lines: string[] = [];
  lines.push(`TASK: ${task.title}`);
  lines.push("");
  if (task.objective?.trim()) {
    lines.push("OBJECTIVE:");
    lines.push(task.objective.trim());
    lines.push("");
  }
  const agencyLines = buildAgencyPromptNote(agencyProfile);
  if (agencyLines.length > 0) {
    lines.push(...agencyLines);
    lines.push("");
  }
  lines.push("Please work on this task. Report your progress and results.");
  return lines.join("\n");
}

export function createHeartbeatService(db: Db) {
  const channelService = createChannelService(db);

  async function invokeTask(
    taskId: string,
    opts?: { agentId?: string; requestedByActorId?: string },
  ) {
    const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId));
    const task = taskRows[0];
    if (!task) {
      throw new Error("Task not found");
    }

    const agentId = opts?.agentId ?? task.assigneeAgentId;
    if (!agentId) {
      throw new Error("Task has no assignee agent. Please assign an agent first.");
    }

    const agentRows = await db.select().from(agents).where(eq(agents.id, agentId));
    const agent = agentRows[0];
    if (!agent) {
      throw new Error("Agent not found");
    }

    if (agent.labId !== task.labId) {
      throw new Error("Agent and task must belong to the same lab");
    }

    const adapter = getServerAdapter(agent.adapterType);
    if (!adapter) {
      throw new Error(`Adapter not found for type "${agent.adapterType}"`);
    }

    const runId = randomUUID();
    const contextSnapshot: Record<string, unknown> = {
      taskId,
      issueId: taskId,
      taskKey: taskId,
      projectId: task.workspaceId,
      workspaceId: task.workspaceId,
      labId: task.labId,
      requestedByActorId: opts?.requestedByActorId ?? null,
    };

    await db
      .update(tasks)
      .set({
        status: "running",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    const [run] = await db
      .insert(heartbeatRuns)
      .values({
        id: runId,
        labId: task.labId,
        agentId,
        taskId,
        status: "running",
        invocationSource: "on_demand",
        triggerDetail: "manual",
        contextSnapshot,
        startedAt: new Date(),
      })
      .returning();

    const agencyProfile = await ensureAgencyProfileMaterialized(agent);
    const prompt = buildTaskPrompt(task, agencyProfile);

    const adapterAgent: AdapterAgent = {
      id: agent.id,
      labId: agent.labId,
      companyId: agent.labId,
      name: agent.name,
      adapterType: agent.adapterType,
      adapterConfig: agent.adapterConfig,
    };

    const runtime: AdapterRuntime = {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
    };

    let execution: AdapterExecutionResult;

    try {
      await db
        .update(agents)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(agents.id, agent.id));

      execution = await adapter.execute({
        runId,
        agent: adapterAgent,
        runtime,
        config: (agent.adapterConfig ?? {}) as Record<string, unknown>,
        context: {
          prompt,
          taskId,
          workspaceId: task.workspaceId ?? undefined,
          labId: task.labId,
          agencyProfile: agencyProfile
            ? {
                rootDir: agencyProfile.rootDir,
                manifestPath: agencyProfile.manifestPath,
                agencyFilePath: agencyProfile.agencyFilePath,
                sourcePath: agencyProfile.sourcePath,
                customPath: agencyProfile.customPath,
              }
            : null,
          ...contextSnapshot,
        },
        onLog: async (stream, chunk) => {
          const prefix = `[heartbeat run:${runId}]`;
          if (stream === "stderr") {
            console.error(prefix, chunk);
          } else {
            console.log(prefix, chunk);
          }
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(heartbeatRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
          error: message,
          updatedAt: new Date(),
        })
        .where(eq(heartbeatRuns.id, runId));

      await db
        .update(tasks)
        .set({
          status: "failed",
          lastRunAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      await db
        .update(agents)
        .set({ status: "idle", updatedAt: new Date() })
        .where(eq(agents.id, agent.id));

      throw err;
    }

    const status =
      (execution.exitCode ?? 0) === 0 && !execution.timedOut
        ? "succeeded"
        : "failed";

    const nextRunAt =
      task.scheduleEnabled &&
      task.scheduleType === "interval" &&
      typeof task.intervalSec === "number"
        ? new Date(Date.now() + task.intervalSec * 1000)
        : null;

    const resultSummary = execution.summary?.trim() || null;

    await db
      .update(heartbeatRuns)
      .set({
        status,
        finishedAt: new Date(),
        error: execution.errorMessage ?? null,
        exitCode: execution.exitCode ?? null,
        resultJson: execution.resultJson ?? null,
        updatedAt: new Date(),
      })
        .where(eq(heartbeatRuns.id, runId));

    await db
      .update(tasks)
      .set({
        status: status === "succeeded" ? "idle" : "failed",
        lastRunAt: new Date(),
        nextRunAt,
        lastResultSummary: resultSummary,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await db
      .update(agents)
      .set({ status: "idle", lastHeartbeatAt: new Date(), updatedAt: new Date() })
      .where(eq(agents.id, agent.id));

    if (
      task.workspaceId &&
      status === "succeeded" &&
      execution.summary?.trim()
    ) {
      try {
        const channel = await channelService.ensureTaskChannel(
          task.workspaceId,
          taskId,
        );
        await channelService.appendMessage({
          channelId: channel.id,
          actorId: agent.id,
          actorType: "agent",
          content: execution.summary.trim(),
          metadata: { runId, source: "heartbeat" },
        });
      } catch {
        // ignore - posting to channel is best-effort
      }
    }

    const updated = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, runId))
      .then((rows) => rows[0]);

    return updated;
  }

  async function listRunsForTask(taskId: string, limit = 20) {
    return db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.taskId, taskId))
      .orderBy(desc(heartbeatRuns.createdAt))
      .limit(limit);
  }

  async function getRun(runId: string) {
    const rows = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, runId));
    return rows[0] ?? null;
  }

  return {
    invokeTask,
    listRunsForTask,
    getRun,
  };
}
