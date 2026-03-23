import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@ownlab/adapter-utils";
import type { RunProcessResult } from "@ownlab/adapter-utils/server-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  parseJson,
  buildOwnlabEnv,
  applyAgencyEnv,
  extractStringEnv,
  joinPromptSections,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  renderTemplate,
  runChildProcess,
} from "@ownlab/adapter-utils/server-utils";
import {
  parseClaudeStreamJson,
  describeClaudeFailure,
  detectClaudeLoginRequired,
  isClaudeMaxTurnsResult,
  isClaudeUnknownSessionError,
} from "./parse.js";

const COPIED_SHARED_FILES = ["settings.json"] as const;

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of paths) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

async function pathExists(candidate: string): Promise<boolean> {
  return fs.access(candidate).then(() => true).catch(() => false);
}

async function ensureParentDir(target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
}

async function ensureCopiedFile(target: string, source: string): Promise<void> {
  if (path.resolve(target) === path.resolve(source)) return;
  const existing = await fs.lstat(target).catch(() => null);
  if (existing) return;
  await ensureParentDir(target);
  await fs.copyFile(source, target);
}

async function resolveLinkedPath(target: string): Promise<string | null> {
  const linkedPath = await fs.readlink(target).catch(() => null);
  return linkedPath ? path.resolve(path.dirname(target), linkedPath) : null;
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

    const resolvedLinkedPath = await resolveLinkedPath(targetPath);
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

async function prepareIsolatedClaudeHome(input: {
  sourceHome: string;
  targetHome: string;
}) {
  const { sourceHome, targetHome } = input;
  await fs.mkdir(targetHome, { recursive: true });
  await fs.mkdir(path.join(targetHome, "skills"), { recursive: true });

  for (const name of COPIED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    await ensureCopiedFile(path.join(targetHome, name), source);
  }
}

interface ClaudeExecutionInput {
  runId: string;
  agent: AdapterExecutionContext["agent"];
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  authToken?: string;
}

interface ClaudeRuntimeConfig {
  command: string;
  cwd: string;
  agentHome: string;
  claudeHome: string;
  workspaceId: string | null;
  workspaceRepoUrl: string | null;
  workspaceRepoRef: string | null;
  effectiveSkills: Array<Record<string, unknown>>;
  env: Record<string, string>;
  timeoutSec: number;
  graceSec: number;
  extraArgs: string[];
}

function buildLoginResult(input: {
  proc: RunProcessResult;
  loginUrl: string | null;
}) {
  return {
    exitCode: input.proc.exitCode,
    signal: input.proc.signal,
    timedOut: input.proc.timedOut,
    stdout: input.proc.stdout,
    stderr: input.proc.stderr,
    loginUrl: input.loginUrl,
  };
}

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function resolveClaudeBillingType(env: Record<string, string>): "api" | "subscription" {
  return hasNonEmptyEnvValue(env, "ANTHROPIC_API_KEY") ? "api" : "subscription";
}

async function buildClaudeRuntimeConfig(input: ClaudeExecutionInput): Promise<ClaudeRuntimeConfig> {
  const { runId, agent, config, context, authToken } = input;

  const command = asString(config.command, "claude");
  const workspaceContext = parseObject(context.ownlabWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceStrategy = asString(workspaceContext.strategy, "");
  const workspaceId = asString(workspaceContext.workspaceId, "") || null;
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "") || null;
  const workspaceRepoRef = asString(workspaceContext.repoRef, "") || null;
  const workspaceBranch = asString(workspaceContext.branchName, "") || null;
  const workspaceWorktreePath = asString(workspaceContext.worktreePath, "") || null;
  const agentHome = asString(workspaceContext.agentHome, "") || path.join(os.homedir(), ".ownlab", "agent-home", agent.id);
  const effectiveSkills = Array.isArray(context.effectiveSkills)
    ? context.effectiveSkills.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const workspaceHints = Array.isArray(context.ownlabWorkspaces)
    ? context.ownlabWorkspaces.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const runtimeServiceIntents = Array.isArray(context.ownlabRuntimeServiceIntents)
    ? context.ownlabRuntimeServiceIntents.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const runtimeServices = Array.isArray(context.ownlabRuntimeServices)
    ? context.ownlabRuntimeServices.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const runtimePrimaryUrl = asString(context.ownlabRuntimePrimaryUrl, "");
  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
  await ensureAbsoluteDirectory(agentHome, { createIfMissing: true });

  const envConfig = parseObject(config.env);
  const resolvedEnvConfig = extractStringEnv(envConfig);
  const configuredClaudeHome =
    typeof resolvedEnvConfig.CLAUDE_CONFIG_DIR === "string" && resolvedEnvConfig.CLAUDE_CONFIG_DIR.trim().length > 0
      ? path.resolve(resolvedEnvConfig.CLAUDE_CONFIG_DIR.trim())
      : typeof resolvedEnvConfig.CLAUDE_HOME === "string" && resolvedEnvConfig.CLAUDE_HOME.trim().length > 0
        ? path.resolve(resolvedEnvConfig.CLAUDE_HOME.trim())
        : null;
  const globalClaudeHome = resolveClaudeConfigDir(process.env);
  const effectiveClaudeHome = configuredClaudeHome ?? path.join(agentHome, ".claude");
  const sourceClaudeHome = path.join(agentHome, ".claude");
  if (!configuredClaudeHome && path.resolve(effectiveClaudeHome) !== path.resolve(globalClaudeHome)) {
    const preferredSourceHome =
      await pathExists(path.join(sourceClaudeHome, "settings.json"))
        ? sourceClaudeHome
        : globalClaudeHome;
    if (path.resolve(preferredSourceHome) !== path.resolve(effectiveClaudeHome)) {
      await prepareIsolatedClaudeHome({
        sourceHome: preferredSourceHome,
        targetHome: effectiveClaudeHome,
      });
    } else {
      await fs.mkdir(path.join(effectiveClaudeHome, "skills"), { recursive: true });
    }
  } else {
    await fs.mkdir(path.join(effectiveClaudeHome, "skills"), { recursive: true });
  }
  const hasExplicitApiKey = hasNonEmptyEnvValue(resolvedEnvConfig, "ANTHROPIC_API_KEY");
  const env: Record<string, string> = { ...buildOwnlabEnv(agent) };
  env.OWNLAB_RUN_ID = runId;

  const wakeTaskId =
    (typeof context.taskId === "string" && context.taskId.trim().length > 0 && context.taskId.trim()) ||
    (typeof context.issueId === "string" && context.issueId.trim().length > 0 && context.issueId.trim()) ||
    null;
  const wakeReason =
    typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0
      ? context.wakeReason.trim()
      : null;
  const wakeCommentId =
    (typeof context.wakeCommentId === "string" && context.wakeCommentId.trim().length > 0 && context.wakeCommentId.trim()) ||
    (typeof context.commentId === "string" && context.commentId.trim().length > 0 && context.commentId.trim()) ||
    null;
  const approvalId =
    typeof context.approvalId === "string" && context.approvalId.trim().length > 0
      ? context.approvalId.trim()
      : null;
  const approvalStatus =
    typeof context.approvalStatus === "string" && context.approvalStatus.trim().length > 0
      ? context.approvalStatus.trim()
      : null;
  const linkedIssueIds = Array.isArray(context.issueIds)
    ? context.issueIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (wakeTaskId) {
    env.OWNLAB_TASK_ID = wakeTaskId;
  }
  if (wakeReason) {
    env.OWNLAB_WAKE_REASON = wakeReason;
  }
  if (wakeCommentId) {
    env.OWNLAB_WAKE_COMMENT_ID = wakeCommentId;
  }
  if (approvalId) {
    env.OWNLAB_APPROVAL_ID = approvalId;
  }
  if (approvalStatus) {
    env.OWNLAB_APPROVAL_STATUS = approvalStatus;
  }
  if (linkedIssueIds.length > 0) {
    env.OWNLAB_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  }
  if (effectiveWorkspaceCwd) {
    env.OWNLAB_WORKSPACE_CWD = effectiveWorkspaceCwd;
  }
  if (workspaceSource) {
    env.OWNLAB_WORKSPACE_SOURCE = workspaceSource;
  }
  if (workspaceStrategy) {
    env.OWNLAB_WORKSPACE_STRATEGY = workspaceStrategy;
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
  if (workspaceBranch) {
    env.OWNLAB_WORKSPACE_BRANCH = workspaceBranch;
  }
  if (workspaceWorktreePath) {
    env.OWNLAB_WORKSPACE_WORKTREE_PATH = workspaceWorktreePath;
  }
  if (agentHome) {
    env.AGENT_HOME = agentHome;
  }
  env.CLAUDE_CONFIG_DIR = effectiveClaudeHome;
  env.CLAUDE_HOME = effectiveClaudeHome;
  if (workspaceHints.length > 0) {
    env.OWNLAB_WORKSPACES_JSON = JSON.stringify(workspaceHints);
  }
  if (runtimeServiceIntents.length > 0) {
    env.OWNLAB_RUNTIME_SERVICE_INTENTS_JSON = JSON.stringify(runtimeServiceIntents);
  }
  if (runtimeServices.length > 0) {
    env.OWNLAB_RUNTIME_SERVICES_JSON = JSON.stringify(runtimeServices);
  }
  if (runtimePrimaryUrl) {
    env.OWNLAB_RUNTIME_PRIMARY_URL = runtimePrimaryUrl;
  }

  for (const [key, value] of Object.entries(resolvedEnvConfig)) {
    env[key] = value;
  }
  applyAgencyEnv(env, context);

  if (!hasExplicitApiKey && authToken) {
    env.OWNLAB_API_KEY = authToken;
  }

  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();

  return {
    command,
    cwd,
    agentHome,
    claudeHome: effectiveClaudeHome,
    workspaceId,
    workspaceRepoUrl,
    workspaceRepoRef,
    effectiveSkills,
    env,
    timeoutSec,
    graceSec,
    extraArgs,
  };
}

export async function runClaudeLogin(
  ctx: AdapterExecutionContext,
): Promise<ReturnType<typeof buildLoginResult>> {
  const { runId, agent, config, context, onLog, authToken } = ctx;
  const runtime = await buildClaudeRuntimeConfig({
    runId,
    agent,
    config,
    context,
    authToken,
  });

  const proc = await runChildProcess(runId, runtime.command, ["login"], {
    cwd: runtime.cwd,
    env: runtime.env,
    timeoutSec: runtime.timeoutSec,
    graceSec: runtime.graceSec,
    onLog,
  });

  const loginMeta = detectClaudeLoginRequired({
    parsed: null,
    stdout: proc.stdout,
    stderr: proc.stderr,
  });

  return buildLoginResult({
    proc,
    loginUrl: loginMeta.loginUrl,
  });
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, authToken } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your OwnLab work.",
  );
  const model = asString(config.model, "");
  const effort = asString(config.effort, "");
  const chrome = asBoolean(config.chrome, false);
  const maxTurns = asNumber(config.maxTurnsPerRun, 0);
  const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();
  const instructionsFileDir = instructionsFilePath ? `${path.dirname(instructionsFilePath)}/` : "";
  const commandNotes = instructionsFilePath
    ? [
        `Injected agent instructions via --append-system-prompt-file ${instructionsFilePath} (with path directive appended)`,
      ]
    : [];

  const runtimeConfig = await buildClaudeRuntimeConfig({
    runId,
    agent,
    config,
    context,
    authToken,
  });
  const { command, cwd, agentHome, claudeHome, workspaceId, workspaceRepoUrl, workspaceRepoRef, effectiveSkills, env, timeoutSec, graceSec, extraArgs } = runtimeConfig;
  const effectiveEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...env }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const billingType = resolveClaudeBillingType(effectiveEnv);
  await syncSkillLinks(
    path.join(claudeHome, "skills"),
    effectiveSkills
      .filter((skill) => {
        const compat = Array.isArray(skill.adapterCompat) ? skill.adapterCompat : [];
        return compat.includes("claude_local");
      })
      .flatMap((skill) => {
        const slug = asString(skill.slug, "").trim();
        const localPath = asString(skill.localPath, "").trim();
        if (!slug || !localPath) return [];
        return [{ slug, localPath }];
      }),
  );

  let effectiveInstructionsFilePath = instructionsFilePath;
  if (instructionsFilePath) {
    try {
      const instructionsContent = await fs.readFile(instructionsFilePath, "utf-8");
      const pathDirective =
        `\nThe above agent instructions were loaded from ${instructionsFilePath}. ` +
        `Resolve any relative file references from ${instructionsFileDir}.`;
      const combinedPath = path.join(claudeHome, "agent-instructions.md");
      await fs.writeFile(combinedPath, instructionsContent + pathDirective, "utf-8");
      effectiveInstructionsFilePath = combinedPath;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await onLog(
        "stderr",
        `[ownlab] Warning: could not read agent instructions file "${instructionsFilePath}": ${reason}\n`,
      );
      effectiveInstructionsFilePath = "";
    }
  }

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
      `[ownlab] Claude session "${runtimeSessionId}" was saved for cwd "${runtimeSessionCwd}" and will not be resumed in "${cwd}".\n`,
    );
  }

  const bootstrapPromptTemplate = asString(config.bootstrapPromptTemplate, "");
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const renderedBootstrapPrompt =
    !sessionId && bootstrapPromptTemplate.trim().length > 0
      ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
      : "";
  const sessionHandoffNote = asString(context.ownlabSessionHandoffMarkdown, "").trim();
  const prompt = joinPromptSections([
    renderedBootstrapPrompt,
    sessionHandoffNote,
    renderedPrompt,
  ]);
  const effectivePrompt = joinPromptSections([
    workspaceId
      ? [
          "Filesystem boundary note:",
          `This run is bound to workspace ${cwd}.`,
          "Treat paths outside the workspace and explicit runtime support directories as unavailable.",
          "Do not describe host-wide file access unless a command in the current session proves it.",
        ].join("\n")
      : "",
    prompt,
  ]);
  const allowedDirs = uniquePaths(
    [cwd, agentHome, claudeHome].filter((value) => value.trim().length > 0),
  );

  const buildClaudeArgs = (resumeSessionId: string | null) => {
    const args = ["--print", "-", "--output-format", "stream-json", "--verbose"];
    if (resumeSessionId) args.push("--resume", resumeSessionId);
    if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
    if (chrome) args.push("--chrome");
    if (model) args.push("--model", model);
    if (effort) args.push("--effort", effort);
    if (maxTurns > 0) args.push("--max-turns", String(maxTurns));
    if (effectiveInstructionsFilePath) {
      args.push("--append-system-prompt-file", effectiveInstructionsFilePath);
    }
    for (const dir of allowedDirs) {
      if (dir === path.resolve(cwd)) continue;
      args.push("--add-dir", dir);
    }
    if (extraArgs.length > 0) args.push(...extraArgs);
    return args;
  };

  const parseFallbackErrorMessage = (proc: RunProcessResult) => {
    const stderrLine =
      proc.stderr
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) ?? "";

    if ((proc.exitCode ?? 0) === 0) {
      return "Failed to parse claude JSON output";
    }

    return stderrLine
      ? `Claude exited with code ${proc.exitCode ?? -1}: ${stderrLine}`
      : `Claude exited with code ${proc.exitCode ?? -1}`;
  };

  const runAttempt = async (resumeSessionId: string | null) => {
    const args = buildClaudeArgs(resumeSessionId);
    if (onMeta) {
      await onMeta({
        adapterType: "claude_local",
        command,
        cwd,
        commandArgs: args,
        commandNotes,
        env: redactEnvForLogs(env),
        prompt: effectivePrompt,
        context,
      });
    }

    const proc = await runChildProcess(runId, command, args, {
      cwd,
      env,
      stdin: effectivePrompt,
      timeoutSec,
      graceSec,
      onLog,
    });

    const parsedStream = parseClaudeStreamJson(proc.stdout);
    const parsed = parsedStream.resultJson ?? parseJson(proc.stdout);
    return { proc, parsedStream, parsed };
  };

  const toAdapterResult = (
    attempt: {
      proc: RunProcessResult;
      parsedStream: ReturnType<typeof parseClaudeStreamJson>;
      parsed: Record<string, unknown> | null;
    },
    opts: { fallbackSessionId: string | null; clearSessionOnMissingSession?: boolean },
  ): AdapterExecutionResult => {
    const { proc, parsedStream, parsed } = attempt;
    const loginMeta = detectClaudeLoginRequired({
      parsed,
      stdout: proc.stdout,
      stderr: proc.stderr,
    });
    const errorMeta =
      loginMeta.loginUrl != null
        ? {
            loginUrl: loginMeta.loginUrl,
          }
        : undefined;

    if (proc.timedOut) {
      return {
        exitCode: proc.exitCode,
        signal: proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${timeoutSec}s`,
        errorCode: "timeout",
        errorMeta,
        clearSession: Boolean(opts.clearSessionOnMissingSession),
      };
    }

    if (!parsed) {
      return {
        exitCode: proc.exitCode,
        signal: proc.signal,
        timedOut: false,
        errorMessage: parseFallbackErrorMessage(proc),
        errorCode: loginMeta.requiresLogin ? "claude_auth_required" : null,
        errorMeta,
        resultJson: {
          stdout: proc.stdout,
          stderr: proc.stderr,
        },
        clearSession: Boolean(opts.clearSessionOnMissingSession),
      };
    }

    const usage =
      parsedStream.usage ??
      (() => {
        const usageObj = parseObject(parsed.usage);
        return {
          inputTokens: asNumber(usageObj.input_tokens, 0),
          cachedInputTokens: asNumber(usageObj.cache_read_input_tokens, 0),
          outputTokens: asNumber(usageObj.output_tokens, 0),
        };
      })();

    const resolvedSessionId =
      parsedStream.sessionId ??
      (asString(parsed.session_id, opts.fallbackSessionId ?? "") || opts.fallbackSessionId);
    const resolvedSessionParams = resolvedSessionId
      ? ({
        sessionId: resolvedSessionId,
        cwd,
        ...(workspaceId ? { workspaceId } : {}),
        ...(workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {}),
        ...(workspaceRepoRef ? { repoRef: workspaceRepoRef } : {}),
      } as Record<string, unknown>)
      : null;
    const clearSessionForMaxTurns = isClaudeMaxTurnsResult(parsed);

    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: false,
      errorMessage:
        (proc.exitCode ?? 0) === 0
          ? null
          : describeClaudeFailure(parsed) ?? `Claude exited with code ${proc.exitCode ?? -1}`,
      errorCode: loginMeta.requiresLogin ? "claude_auth_required" : null,
      errorMeta,
      usage,
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: "anthropic",
      model: parsedStream.model || asString(parsed.model, model),
      billingType,
      costUsd: parsedStream.costUsd ?? asNumber(parsed.total_cost_usd, 0),
      resultJson: parsed,
      summary: parsedStream.summary || asString(parsed.result, ""),
      clearSession: clearSessionForMaxTurns || Boolean(opts.clearSessionOnMissingSession && !resolvedSessionId),
    };
  };

  try {
    const initial = await runAttempt(sessionId ?? null);
    if (
      sessionId &&
      !initial.proc.timedOut &&
      (initial.proc.exitCode ?? 0) !== 0 &&
      initial.parsed &&
      isClaudeUnknownSessionError(initial.parsed)
    ) {
      await onLog(
        "stderr",
        `[ownlab] Claude resume session "${sessionId}" is unavailable; retrying with a fresh session.\n`,
      );
      const retry = await runAttempt(null);
      return toAdapterResult(retry, { fallbackSessionId: null, clearSessionOnMissingSession: true });
    }

    return toAdapterResult(initial, { fallbackSessionId: runtimeSessionId || runtime.sessionId });
  } finally {
    if (effectiveInstructionsFilePath && effectiveInstructionsFilePath !== instructionsFilePath) {
      fs.rm(effectiveInstructionsFilePath, { force: true }).catch(() => {});
    }
  }
}
