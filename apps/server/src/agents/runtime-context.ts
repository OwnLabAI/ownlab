import type { Db } from "@ownlab/db";
import { eq, workspaces } from "@ownlab/db";
import type { agents } from "@ownlab/db";
import { resolveAgentRuntimeHomeDir } from "../home-paths.js";
import { initializeAgentRuntimeFilesystem } from "./runtime-filesystem.js";

type AgentRecord = typeof agents.$inferSelect;

export interface AgentExecutionRuntimeContext {
  cwd: string;
  agentHome: string;
  channelHome: string | null;
  workspaceSource: "agent_home" | "workspace";
  workspaceId: string | null;
  workspaceName: string | null;
  worktreePath: string | null;
}

export async function resolveAgentExecutionRuntimeContext(
  db: Db,
  agent: AgentRecord,
  _channelWorkspaceId?: string | null,
  _channelId?: string | null,
): Promise<AgentExecutionRuntimeContext> {
  const runtimeConfig = asRecord(agent.runtimeConfig);
  const requestedWorkspaceId = asString(runtimeConfig?.workspaceId);
  const configuredProjectPath =
    asString(runtimeConfig?.projectPath) ||
    asString(runtimeConfig?.workingDirectory) ||
    asString((agent.adapterConfig as Record<string, unknown> | null)?.cwd);

  const agentHome = resolveAgentRuntimeHomeDir(agent.id, agent.runtimeConfig);
  const channelHome = null;
  const fallbackCwd = agentHome;

  await initializeAgentRuntimeFilesystem({
    agentId: agent.id,
    adapterType: agent.adapterType,
    runtimeConfig: agent.runtimeConfig,
  });

  if (configuredProjectPath) {
    return {
      cwd: configuredProjectPath,
      agentHome,
      channelHome,
      workspaceSource: "agent_home",
      workspaceId: null,
      workspaceName: null,
      worktreePath: null,
    };
  }

  if (requestedWorkspaceId) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, requestedWorkspaceId))
      .limit(1);

    if (workspace?.worktreePath?.trim()) {
      return {
        cwd: workspace.worktreePath,
        agentHome,
        channelHome,
        workspaceSource: "workspace",
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        worktreePath: workspace.worktreePath,
      };
    }
  }

  return {
    cwd: fallbackCwd,
    agentHome,
    channelHome,
    workspaceSource: "agent_home",
    workspaceId: null,
    workspaceName: null,
    worktreePath: null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
