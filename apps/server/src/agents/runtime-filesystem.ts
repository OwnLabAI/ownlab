import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  resolveAgentClaudeContainerDir,
  resolveAgentCodexHomeDir,
  resolveAgentRuntimeHomeDir,
  resolveAgentRuntimeRootDir,
  resolveLegacyAgentRuntimeRootDir,
} from "../home-paths.js";

const CODEX_COPIED_SHARED_FILES = ["config.json", "config.toml", "instructions.md"] as const;
const CODEX_SYMLINKED_SHARED_FILES = ["auth.json"] as const;
const CLAUDE_COPIED_SHARED_FILES = ["settings.json"] as const;

type RuntimeConfigRecord = Record<string, unknown>;

function resolveCodexHomeDir(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = typeof env.CODEX_HOME === "string" && env.CODEX_HOME.trim().length > 0
    ? env.CODEX_HOME.trim()
    : null;
  return path.resolve(fromEnv ?? path.join(os.homedir(), ".codex"));
}

function resolveClaudeConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const fromConfigDir = typeof env.CLAUDE_CONFIG_DIR === "string" && env.CLAUDE_CONFIG_DIR.trim().length > 0
    ? env.CLAUDE_CONFIG_DIR.trim()
    : null;
  if (fromConfigDir) return path.resolve(fromConfigDir);
  const fromHome = typeof env.CLAUDE_HOME === "string" && env.CLAUDE_HOME.trim().length > 0
    ? env.CLAUDE_HOME.trim()
    : null;
  if (fromHome) return path.resolve(fromHome);
  return path.resolve(path.join(os.homedir(), ".claude"));
}

async function pathExists(candidate: string): Promise<boolean> {
  return fs.access(candidate).then(() => true).catch(() => false);
}

async function ensureParentDir(target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
}

async function ensureSymlink(target: string, source: string): Promise<void> {
  if (path.resolve(target) === path.resolve(source)) return;
  const existing = await fs.lstat(target).catch(() => null);
  if (!existing) {
    await ensureParentDir(target);
    await fs.symlink(source, target);
    return;
  }
  if (!existing.isSymbolicLink()) {
    return;
  }
  const linkedPath = await fs.readlink(target).catch(() => null);
  if (!linkedPath) return;
  const resolvedLinkedPath = path.resolve(path.dirname(target), linkedPath);
  if (resolvedLinkedPath === source) return;
  await fs.unlink(target);
  await fs.symlink(source, target);
}

async function ensureCopiedFile(target: string, source: string): Promise<void> {
  if (path.resolve(target) === path.resolve(source)) return;
  const existing = await fs.lstat(target).catch(() => null);
  if (existing) return;
  await ensureParentDir(target);
  await fs.copyFile(source, target);
}

async function seedRuntimeHome(
  targetHome: string,
  sourceHome: string,
  files: readonly string[],
  mode: "copy" | "symlink",
) {
  await fs.mkdir(targetHome, { recursive: true });
  for (const name of files) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    const target = path.join(targetHome, name);
    if (mode === "copy") {
      await ensureCopiedFile(target, source);
    } else {
      await ensureSymlink(target, source);
    }
  }
}

async function migrateLegacyRuntimeRoot(
  legacyRoot: string,
  targetRoot: string,
): Promise<void> {
  if (path.resolve(legacyRoot) === path.resolve(targetRoot)) {
    return;
  }

  const [legacyExists, targetExists] = await Promise.all([
    pathExists(legacyRoot),
    pathExists(targetRoot),
  ]);
  if (!legacyExists || targetExists) {
    return;
  }

  await fs.mkdir(path.dirname(targetRoot), { recursive: true });
  await fs.rename(legacyRoot, targetRoot);
}

async function migrateLegacyWorkspaceArtifacts(
  runtimeRoot: string,
  agentHome: string,
): Promise<void> {
  const legacyWorkspaceDir = path.join(runtimeRoot, "workspace");
  const legacyAgencyDir = path.join(legacyWorkspaceDir, "agency");
  const nextAgencyDir = path.join(agentHome, "agency");

  const legacyAgencyExists = await pathExists(legacyAgencyDir);
  const nextAgencyExists = await pathExists(nextAgencyDir);

  if (legacyAgencyExists && !nextAgencyExists) {
    await fs.mkdir(agentHome, { recursive: true });
    await fs.rename(legacyAgencyDir, nextAgencyDir);
  }

  const workspaceExists = await pathExists(legacyWorkspaceDir);
  if (!workspaceExists) {
    return;
  }

  const remainingEntries = await fs.readdir(legacyWorkspaceDir).catch(() => []);
  if (remainingEntries.length === 0) {
    await fs.rmdir(legacyWorkspaceDir).catch(() => undefined);
  }
}

export async function initializeAgentRuntimeFilesystem(input: {
  agentId: string;
  runtimeConfig?: RuntimeConfigRecord | null;
}): Promise<void> {
  const runtimeConfig = input.runtimeConfig ?? null;
  const legacyRoot = resolveLegacyAgentRuntimeRootDir(input.agentId);
  const runtimeRoot = resolveAgentRuntimeRootDir(input.agentId, runtimeConfig);
  const agentHome = resolveAgentRuntimeHomeDir(input.agentId, runtimeConfig);
  const codexHome = resolveAgentCodexHomeDir(input.agentId, runtimeConfig);
  const claudeHome = resolveAgentClaudeContainerDir(input.agentId, runtimeConfig);

  await migrateLegacyRuntimeRoot(legacyRoot, runtimeRoot);

  await fs.mkdir(runtimeRoot, { recursive: true });
  await fs.mkdir(agentHome, { recursive: true });
  await fs.mkdir(path.join(codexHome, "skills"), { recursive: true });
  await fs.mkdir(path.join(claudeHome, "skills"), { recursive: true });
  await migrateLegacyWorkspaceArtifacts(runtimeRoot, agentHome);

  const globalCodexHome = resolveCodexHomeDir(process.env);
  await seedRuntimeHome(codexHome, globalCodexHome, CODEX_SYMLINKED_SHARED_FILES, "symlink");
  await seedRuntimeHome(codexHome, globalCodexHome, CODEX_COPIED_SHARED_FILES, "copy");

  const globalClaudeHome = resolveClaudeConfigDir(process.env);
  await seedRuntimeHome(claudeHome, globalClaudeHome, CLAUDE_COPIED_SHARED_FILES, "copy");
}
