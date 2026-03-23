export const type = "codex_local";
export const label = "Codex (local)";
export const DEFAULT_CODEX_LOCAL_MODEL = "gpt-5.4";
export const DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX = false;

export const models = [
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.3-codex", label: "GPT-5.3-Codex" },
  { id: "gpt-5.2-codex", label: "GPT-5.2-Codex" },
  { id: "gpt-5.2", label: "GPT-5.2" },
  { id: "gpt-5.1-codex-max", label: "GPT-5.1-Codex-Max" },
  { id: "gpt-5.1-codex-mini", label: "GPT-5.1-Codex-Mini" },
];

export const agentConfigurationDoc = `# codex_local agent configuration

Adapter: codex_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to stdin prompt at runtime
- model (string, optional): Codex model id
- modelReasoningEffort (string, optional): reasoning effort override passed via -c model_reasoning_effort=...
- promptTemplate (string, optional): run prompt template
- search (boolean, optional): run codex with --search
- dangerouslyBypassApprovalsAndSandbox (boolean, optional): run with bypass flag
- command (string, optional): defaults to "codex"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): workspace runtime service intents; local host-managed services are realized before Codex starts and exposed back via context/env

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin (Codex receives "-" prompt argument).
- Ownlab injects effective local skills into "$CODEX_HOME/skills" for local runs.
- Some model/tool combinations reject certain effort levels.
- When OwnLab realizes a workspace/runtime for a run, it injects OWNLAB_* env vars for agent-side tooling.
`;
