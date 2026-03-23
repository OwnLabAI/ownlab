import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@ownlab/adapter-utils";
import {
  asString,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
} from "@ownlab/adapter-utils/server-utils";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function fileExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function isInsideGitRepository(startDir: string): Promise<boolean> {
  let current = path.resolve(startDir);

  while (true) {
    if (await fileExists(path.join(current, ".git"))) {
      return true;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return false;
    }
    current = parent;
  }
}

function collectCandidateCodexHomes(env: Record<string, string>): string[] {
  if (isNonEmpty(env.CODEX_HOME)) {
    return [path.resolve(env.CODEX_HOME)];
  }

  if (isNonEmpty(process.env.CODEX_HOME)) {
    return [path.resolve(process.env.CODEX_HOME)];
  }

  return [path.join(os.homedir(), ".codex")];
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "codex");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "codex_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "codex_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });

  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "codex_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "codex_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  const skipGitRepoCheckSetting =
    typeof config.skipGitRepoCheck === "boolean" ? config.skipGitRepoCheck : null;
  const insideGitRepository = await isInsideGitRepository(cwd);
  if (insideGitRepository) {
    checks.push({
      code: "codex_git_repo_detected",
      level: "info",
      message: `Codex working directory is inside a Git repository: ${cwd}`,
    });
  } else if (skipGitRepoCheckSetting === false) {
    checks.push({
      code: "codex_git_repo_missing",
      level: "warn",
      message: "Codex working directory is not inside a Git repository.",
      detail: cwd,
      hint: "Enable skipGitRepoCheck or point the agent at a workspace/repository path.",
    });
  } else {
    checks.push({
      code: "codex_git_repo_check_auto_skipped",
      level: "info",
      message: "Codex will auto-enable --skip-git-repo-check for this working directory.",
      detail: cwd,
    });
  }

  const configOpenAiKey = env.OPENAI_API_KEY;
  const hostOpenAiKey = process.env.OPENAI_API_KEY;
  const codexHomes = collectCandidateCodexHomes(env);
  const authJsonPath = await (async () => {
    for (const codexHome of codexHomes) {
      const candidate = path.join(codexHome, "auth.json");
      if (await fileExists(candidate)) return candidate;
    }
    return null;
  })();

  if (isNonEmpty(configOpenAiKey) || isNonEmpty(hostOpenAiKey)) {
    const source = isNonEmpty(configOpenAiKey) ? "adapter config env" : "server environment";
    checks.push({
      code: "codex_openai_api_key_present",
      level: "info",
      message: "OPENAI_API_KEY is set for Codex authentication.",
      detail: `Detected in ${source}.`,
    });
  } else if (authJsonPath) {
    checks.push({
      code: "codex_auth_file_present",
      level: "info",
      message: "Codex login credentials were found.",
      detail: authJsonPath,
    });
  } else {
    checks.push({
      code: "codex_auth_missing",
      level: "warn",
      message: "Codex authentication is not configured yet.",
      hint: "Set OPENAI_API_KEY or run `codex login` so Codex can create auth.json.",
    });
  }

  if (checks.every((check) => check.code !== "codex_cwd_invalid" && check.code !== "codex_command_unresolvable")) {
    // Keep diagnostics intentionally lightweight here. Real execution uses
    // the full isolated CODEX_HOME setup, but environment testing should stay fast.
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
