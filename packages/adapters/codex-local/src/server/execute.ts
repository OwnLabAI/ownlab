import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@ownlab/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  applyAgencyEnv,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@ownlab/adapter-utils/server-utils";
import { parseCodexJsonl, isCodexUnknownSessionError } from "./parse.js";

const COPIED_SHARED_FILES = ["config.json", "config.toml", "instructions.md"] as const;
const SYMLINKED_SHARED_FILES = ["auth.json"] as const;

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function resolveCodexBillingType(env: Record<string, string>): "api" | "subscription" {
  return hasNonEmptyEnvValue(env, "OPENAI_API_KEY") ? "api" : "subscription";
}

function resolveCodexHomeDir(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = typeof env.CODEX_HOME === "string" && env.CODEX_HOME.trim().length > 0
    ? env.CODEX_HOME.trim()
    : null;
  return path.resolve(fromEnv ?? path.join(os.homedir(), ".codex"));
}

async function pathExists(candidate: string): Promise<boolean> {
  return fs.access(candidate).then(() => true).catch(() => false);
}

async function ensureParentDir(target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
}

async function ensureSymlink(target: string, source: string): Promise<"created" | "repaired" | "skipped"> {
  if (path.resolve(target) === path.resolve(source)) {
    return "skipped";
  }

  const existing = await fs.lstat(target).catch(() => null);
  if (!existing) {
    await ensureParentDir(target);
    await fs.symlink(source, target);
    return "created";
  }

  if (!existing.isSymbolicLink()) {
    return "skipped";
  }

  const linkedPath = await fs.readlink(target).catch(() => null);
  if (!linkedPath) return "skipped";

  const resolvedLinkedPath = path.resolve(path.dirname(target), linkedPath);
  if (resolvedLinkedPath === source) return "skipped";

  await fs.unlink(target);
  await fs.symlink(source, target);
  return "repaired";
}

async function ensureCopiedFile(target: string, source: string): Promise<void> {
  if (path.resolve(target) === path.resolve(source)) {
    return;
  }

  const existing = await fs.lstat(target).catch(() => null);
  if (existing) return;
  await ensureParentDir(target);
  await fs.copyFile(source, target);
}

async function hasUsableCodexAuth(sourceHome: string): Promise<boolean> {
  return pathExists(path.join(sourceHome, "auth.json"));
}

async function syncSkillLinks(
  targetDir: string,
  desiredSkills: Array<{ slug: string; localPath: string }>,
) {
  await fs.mkdir(targetDir, { recursive: true });
  const desired = new Map(desiredSkills.map((skill) => [skill.slug, skill.localPath]));
  const existing = await fs.readdir(targetDir, { withFileTypes: true }).catch(() => []);

  for (const entry of existing) {
    const targetPath = path.join(targetDir, entry.name);
    const desiredSource = desired.get(entry.name);
    if (!desiredSource) {
      const stats = await fs.lstat(targetPath).catch(() => null);
      if (stats?.isSymbolicLink()) {
        await fs.unlink(targetPath).catch(() => {});
      }
      continue;
    }

    const linkedPath = await fs.readlink(targetPath).catch(() => null);
    const resolvedLinkedPath = linkedPath
      ? path.resolve(path.dirname(targetPath), linkedPath)
      : null;
    if (resolvedLinkedPath === desiredSource) {
      desired.delete(entry.name);
      continue;
    }

    const stats = await fs.lstat(targetPath).catch(() => null);
    if (stats?.isSymbolicLink()) {
      await fs.unlink(targetPath);
      await fs.symlink(desiredSource, targetPath);
    }
    desired.delete(entry.name);
  }

  for (const [slug, sourcePath] of desired.entries()) {
    await fs.symlink(sourcePath, path.join(targetDir, slug)).catch(async () => {
      const targetPath = path.join(targetDir, slug);
      const existing = await fs.lstat(targetPath).catch(() => null);
      if (existing?.isSymbolicLink()) {
        await fs.unlink(targetPath);
        await fs.symlink(sourcePath, targetPath);
      }
    });
  }
}

async function prepareIsolatedCodexHome(input: {
  sourceHome: string;
  targetHome: string;
}) {
  const { sourceHome, targetHome } = input;
  await fs.mkdir(targetHome, { recursive: true });

  for (const name of SYMLINKED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    await ensureSymlink(path.join(targetHome, name), source);
  }

  for (const name of COPIED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    await ensureCopiedFile(path.join(targetHome, name), source);
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta } = ctx;

  const command = asString(config.command, "codex");
  const model = asString(config.model, "");
  const modelReasoningEffort = asString(config.modelReasoningEffort, "");
  const search = asBoolean(config.search, false);
  const bypass = asBoolean(
    config.dangerouslyBypassApprovalsAndSandbox,
    asBoolean(config.dangerouslyBypassSandbox, true),
  );

  const workspaceContext = parseObject(context.ownlabWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceId = asString(workspaceContext.workspaceId, "");
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "");
  const workspaceRepoRef = asString(workspaceContext.repoRef, "");
  const agentHome = asString(workspaceContext.agentHome, "") || path.join(os.homedir(), ".ownlab", "agent-home", agent.id);
  const channelHome = asString(workspaceContext.channelHome, "");
  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
  await ensureAbsoluteDirectory(agentHome, { createIfMissing: true });

  const envConfig = parseObject(config.env);
  const configuredCodexHome =
    typeof envConfig.CODEX_HOME === "string" && envConfig.CODEX_HOME.trim().length > 0
      ? path.resolve(envConfig.CODEX_HOME.trim())
      : null;
  const globalCodexHome = resolveCodexHomeDir(process.env);
  const effectiveCodexHome = configuredCodexHome ?? path.join(channelHome || agentHome, ".codex");
  const sourceCodexHome = path.join(agentHome, ".codex");

  if (!configuredCodexHome && path.resolve(effectiveCodexHome) !== path.resolve(globalCodexHome)) {
    const preferredSourceHome =
      await hasUsableCodexAuth(sourceCodexHome)
        ? sourceCodexHome
        : globalCodexHome;
    if (path.resolve(preferredSourceHome) !== path.resolve(effectiveCodexHome)) {
      await prepareIsolatedCodexHome({
        sourceHome: preferredSourceHome,
        targetHome: effectiveCodexHome,
      });
    } else {
      await ensureAbsoluteDirectory(effectiveCodexHome, { createIfMissing: true });
    }
  } else {
    await ensureAbsoluteDirectory(effectiveCodexHome, { createIfMissing: true });
  }

  const effectiveSkills = Array.isArray(context.effectiveSkills)
    ? context.effectiveSkills.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  await syncSkillLinks(
    path.join(effectiveCodexHome, "skills"),
    effectiveSkills
      .filter((skill) => {
        const compat = Array.isArray(skill.adapterCompat) ? skill.adapterCompat : [];
        return compat.includes("codex_local");
      })
      .flatMap((skill) => {
        const slug = asString(skill.slug, "");
        const localPath = asString(skill.localPath, "");
        if (!slug || !localPath) {
          return [];
        }
        return [{ slug, localPath }];
      }),
  );

  const env: Record<string, string> = {
    OWNLAB_AGENT_ID: agent.id,
    OWNLAB_RUN_ID: runId,
    AGENT_HOME: agentHome,
    CODEX_HOME: effectiveCodexHome,
  };
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  if (effectiveWorkspaceCwd) {
    env.OWNLAB_WORKSPACE_CWD = effectiveWorkspaceCwd;
  }
  if (workspaceSource) {
    env.OWNLAB_WORKSPACE_SOURCE = workspaceSource;
  }
  if (workspaceId) {
    env.OWNLAB_WORKSPACE_ID = workspaceId;
  }
  if (workspaceRepoUrl) {
    env.OWNLAB_WORKSPACE_REPO_URL = workspaceRepoUrl;
  }
  if (workspaceRepoRef) {
    env.OWNLAB_WORKSPACE_REPO_REF = workspaceRepoRef;
  }
  applyAgencyEnv(env, context);

  const billingType = resolveCodexBillingType(env);
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");
  const runtimeSessionCwd = asString(runtimeSessionParams.cwd, "");
  const canResumeSession =
    runtimeSessionId.length > 0 &&
    (runtimeSessionCwd.length === 0 || path.resolve(runtimeSessionCwd) === path.resolve(cwd));
  const sessionId = canResumeSession ? runtimeSessionId : null;

  if (runtimeSessionId && !canResumeSession) {
    await onLog(
      "stderr",
      `[ownlab] Codex session "${runtimeSessionId}" was saved for cwd "${runtimeSessionCwd}" and will not be resumed in "${cwd}".\n`,
    );
  }

  const prompt = asString(context.prompt as string, "You are a helpful coding assistant.");

  const buildArgs = (resumeSessionId: string | null) => {
    const args = ["exec", "--json"];
    if (search) args.unshift("--search");
    if (bypass) args.push("--dangerously-bypass-approvals-and-sandbox");
    if (model) args.push("--model", model);
    if (modelReasoningEffort) args.push("-c", `model_reasoning_effort=${JSON.stringify(modelReasoningEffort)}`);
    if (extraArgs.length > 0) args.push(...extraArgs);
    if (resumeSessionId) args.push("resume", resumeSessionId, "-");
    else args.push("-");
    return args;
  };

  const runAttempt = async (resumeSessionId: string | null) => {
    const args = buildArgs(resumeSessionId);
    if (onMeta) {
      await onMeta({
        adapterType: "codex_local",
        command,
        cwd,
        commandArgs: args,
        env: redactEnvForLogs(env),
        prompt,
        context,
      });
    }

    const proc = await runChildProcess(runId, command, args, {
      cwd,
      env,
      stdin: prompt,
      timeoutSec,
      graceSec,
      onLog,
    });

    return {
      proc,
      parsed: parseCodexJsonl(proc.stdout),
    };
  };

  const toResult = (
    attempt: {
      proc: RunProcessResult;
      parsed: ReturnType<typeof parseCodexJsonl>;
    },
    clearSessionOnMissingSession = false,
  ): AdapterExecutionResult => {
    if (attempt.proc.timedOut) {
      return {
        exitCode: attempt.proc.exitCode,
        signal: attempt.proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${timeoutSec}s`,
        clearSession: clearSessionOnMissingSession,
      };
    }

    const resolvedSessionId = attempt.parsed.sessionId ?? runtimeSessionId ?? runtime.sessionId ?? null;
    const resolvedSessionParams = resolvedSessionId
      ? { sessionId: resolvedSessionId, cwd } as Record<string, unknown>
      : null;
    const parsedError = typeof attempt.parsed.errorMessage === "string" ? attempt.parsed.errorMessage.trim() : "";
    const stderrLine = firstNonEmptyLine(attempt.proc.stderr);
    const fallbackErrorMessage = parsedError || stderrLine || `Codex exited with code ${attempt.proc.exitCode ?? -1}`;

    return {
      exitCode: attempt.proc.exitCode,
      signal: attempt.proc.signal,
      timedOut: false,
      errorMessage: (attempt.proc.exitCode ?? 0) === 0 ? null : fallbackErrorMessage,
      usage: attempt.parsed.usage,
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: "openai",
      model,
      billingType,
      summary: attempt.parsed.summary,
      clearSession: Boolean(clearSessionOnMissingSession && !resolvedSessionId),
    };
  };

  const initial = await runAttempt(sessionId);
  if (
    sessionId &&
    !initial.proc.timedOut &&
    (initial.proc.exitCode ?? 0) !== 0 &&
    isCodexUnknownSessionError(initial.proc.stdout, initial.proc.stderr)
  ) {
    await onLog(
      "stderr",
      `[ownlab] Codex resume session "${sessionId}" is unavailable; retrying with a fresh session.\n`,
    );
    const retry = await runAttempt(null);
    return toResult(retry, true);
  }

  return toResult(initial);
}

type RunProcessResult = Awaited<ReturnType<typeof runChildProcess>>;
