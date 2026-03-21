import os from "node:os";
import path from "node:path";

const DEFAULT_INSTANCE_ID = "default";
const INSTANCE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;
type RuntimeConfigRecord = Record<string, unknown>;

function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function resolveOwnLabHomeDir(): string {
  const envHome = process.env.OWNLAB_HOME?.trim();
  if (envHome) return path.resolve(expandHomePrefix(envHome));
  return path.resolve(os.homedir(), ".ownlab");
}

export function resolveOwnLabInstanceId(): string {
  const raw = process.env.OWNLAB_INSTANCE_ID?.trim() || DEFAULT_INSTANCE_ID;
  if (!INSTANCE_ID_RE.test(raw)) {
    throw new Error(`Invalid OWNLAB_INSTANCE_ID '${raw}'.`);
  }
  return raw;
}

export function resolveOwnLabInstanceRoot(): string {
  return path.resolve(resolveOwnLabHomeDir(), "instances", resolveOwnLabInstanceId());
}

export function resolveManagedSkillsRootDir(): string {
  return path.resolve(resolveOwnLabInstanceRoot(), "skills");
}

function asRecord(value: unknown): RuntimeConfigRecord | null {
  return typeof value === "object" && value !== null ? (value as RuntimeConfigRecord) : null;
}

function asPathSegment(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !PATH_SEGMENT_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function resolveAgentTeamId(
  runtimeConfig?: RuntimeConfigRecord | null,
): string | null {
  return asPathSegment(asRecord(runtimeConfig)?.teamId);
}

export function resolveLegacyAgentRuntimeRootDir(agentId: string): string {
  const trimmed = asPathSegment(agentId);
  if (!trimmed) {
    throw new Error(`Invalid agent id for runtime path '${agentId}'.`);
  }
  return path.resolve(resolveOwnLabInstanceRoot(), "agents", trimmed);
}

export function resolveTeamRuntimeRootDir(teamId: string): string {
  const trimmed = asPathSegment(teamId);
  if (!trimmed) {
    throw new Error(`Invalid team id for runtime path '${teamId}'.`);
  }
  return path.resolve(resolveOwnLabInstanceRoot(), "teams", trimmed);
}

export function resolveTeamAgentsRootDir(teamId: string): string {
  return path.resolve(resolveTeamRuntimeRootDir(teamId), "agents");
}

/**
 * Resolves the per-agent runtime root. Each local agent gets its own isolated
 * runtime area for home/config state, skills, and fallback workspace content.
 */
export function resolveAgentRuntimeRootDir(
  agentId: string,
  runtimeConfig?: RuntimeConfigRecord | null,
): string {
  const trimmed = asPathSegment(agentId);
  if (!trimmed) {
    throw new Error(`Invalid agent id for runtime path '${agentId}'.`);
  }
  const teamId = resolveAgentTeamId(runtimeConfig);
  if (teamId) {
    return path.resolve(resolveTeamAgentsRootDir(teamId), trimmed);
  }
  return resolveLegacyAgentRuntimeRootDir(trimmed);
}

/**
 * Agent home root used for adapter-specific config homes and long-lived state.
 * Path: ~/.ownlab/instances/{instance}/agents/{agentId}/home
 */
export function resolveAgentRuntimeHomeDir(
  agentId: string,
  runtimeConfig?: RuntimeConfigRecord | null,
): string {
  return path.resolve(resolveAgentRuntimeRootDir(agentId, runtimeConfig), "home");
}

export function resolveAgentCodexHomeDir(
  agentId: string,
  runtimeConfig?: RuntimeConfigRecord | null,
): string {
  return path.resolve(resolveAgentRuntimeHomeDir(agentId, runtimeConfig), ".codex");
}

export function resolveAgentClaudeContainerDir(
  agentId: string,
  runtimeConfig?: RuntimeConfigRecord | null,
): string {
  return path.resolve(resolveAgentRuntimeHomeDir(agentId, runtimeConfig), ".claude");
}

export function resolveAgentChannelRuntimeHomeDir(
  agentId: string,
  channelId: string,
  runtimeConfig?: RuntimeConfigRecord | null,
): string {
  const trimmedChannelId = asPathSegment(channelId);
  if (!trimmedChannelId) {
    throw new Error(`Invalid channel id for runtime path '${channelId}'.`);
  }
  return path.resolve(
    resolveAgentRuntimeRootDir(agentId, runtimeConfig),
    "channels",
    trimmedChannelId,
    "home",
  );
}
