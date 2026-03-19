export const AGENT_STATUSES = ["idle", "running", "paused", "error"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const ADAPTER_TYPES = [
  "codex_local",
  "claude_code",
  "opencode",
] as const;
export type AdapterType = (typeof ADAPTER_TYPES)[number];

export const ADAPTER_TYPE_LABELS: Record<AdapterType, string> = {
  codex_local: "Codex",
  claude_code: "Claude Code",
  opencode: "OpenCode",
};

export const ADAPTER_TYPE_DESCRIPTIONS: Record<AdapterType, string> = {
  codex_local: "OpenAI Codex CLI running locally on your machine",
  claude_code: "Anthropic Claude Code for complex coding tasks",
  opencode: "Fast and flexible with multi-model support",
};

export const AGENT_TYPES = ["local", "cloud"] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const CHAT_ROLES = ["user", "assistant", "system"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export const AVAILABLE_MODELS = [
  { id: "claude-3-5-haiku-20241022", label: "Claude Haiku 3.5", provider: "anthropic" },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "anthropic" },
] as const;

export const LOCAL_ADAPTER_TYPES: AdapterType[] = ["codex_local"];
export const CLOUD_ADAPTER_TYPES: AdapterType[] = ["claude_code", "opencode"];

export const CODEX_MODELS = [
  { id: "o3", label: "o3" },
  { id: "o4-mini", label: "o4-mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { id: "codex-mini-latest", label: "Codex Mini" },
] as const;

export const AGENT_AVATARS = [
  "avatar-1", "avatar-2", "avatar-3", "avatar-4",
  "avatar-5", "avatar-6", "avatar-7",
] as const;
export type AgentAvatar = (typeof AGENT_AVATARS)[number];
