export const ADAPTER_TYPE_LABELS: Record<string, string> = {
  claude_local: 'Claude Code',
  codex_local: 'Codex',
  gemini_local: 'Gemini CLI',
  opencode_local: 'OpenCode',
  pi_local: 'Pi',
  cursor: 'Cursor',
  process: 'Process (local CLI)',
  process_local: 'Process (local CLI)',
  claude_code: 'Claude Code',
  opencode: 'OpenCode',
};

export const ADAPTER_TYPE_DESCRIPTIONS: Record<string, string> = {
  claude_local: 'Local Claude agent',
  codex_local: 'Local Codex agent',
  gemini_local: 'Local Gemini agent',
  opencode_local: 'Local multi-provider agent',
  pi_local: 'Local Pi agent',
  cursor: 'Local Cursor agent',
  process: 'Run an arbitrary local CLI command with the channel prompt as stdin',
  process_local: 'Run an arbitrary local CLI command with the channel prompt as stdin',
  claude_code: 'Best for complex coding, debugging, and multi-file refactors',
  opencode: 'Fast and flexible with multi-model support',
};

export const AGENT_ADAPTER_GRID: Array<{
  key: string;
  label: string;
  desc: string;
  comingSoon?: boolean;
}> = [
  { key: 'claude_local', label: 'Claude Code', desc: 'Local Claude agent' },
  { key: 'codex_local', label: 'Codex', desc: 'Local Codex agent' },
  { key: 'gemini_local', label: 'Gemini CLI', desc: 'Local Gemini agent', comingSoon: true },
  { key: 'opencode_local', label: 'OpenCode', desc: 'Local multi-provider agent', comingSoon: true },
  { key: 'pi_local', label: 'Pi', desc: 'Local Pi agent', comingSoon: true },
  { key: 'cursor', label: 'Cursor', desc: 'Local Cursor agent', comingSoon: true },
];

export const LOCAL_ADAPTER_TYPES = ['codex_local', 'claude_local', 'gemini_local', 'opencode_local', 'pi_local', 'cursor', 'process', 'process_local'];
export const CLOUD_ADAPTER_TYPES = ['claude_code', 'opencode'];

export const AVAILABLE_MODELS = [
  { id: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5', provider: 'anthropic' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic' },
];

export const CODEX_MODELS = [
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' },
  { id: 'gpt-5.2-codex', label: 'GPT-5.2-Codex' },
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'gpt-5.1-codex-max', label: 'GPT-5.1-Codex-Max' },
  { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1-Codex-Mini' },
];

export const CLAUDE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-6', label: 'Claude Haiku 4.6' },
  { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

export const GEMINI_MODELS = [
  { id: 'auto', label: 'Auto' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
];

export const CURSOR_MODELS = [
  { id: 'auto', label: 'Auto' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' },
  { id: 'gpt-5.2-codex', label: 'GPT-5.2-Codex' },
  { id: 'gpt-5.1-codex-max', label: 'GPT-5.1-Codex-Max' },
  { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1-Codex-Mini' },
];

/** SVG logo paths under /agent-logos/ for adapter cards. Uses /agent-logos/ to avoid conflict with /agents→/lab redirect. */
export const AGENT_ADAPTER_LOGOS: Record<string, string | null> = {
  claude_local: '/agent-logos/claude-color.svg',
  codex_local: '/agent-logos/codex-color.svg',
  cursor: '/agent-logos/cursor.svg',
  opencode_local: '/agent-logos/opencode.svg',
  gemini_local: '/agent-logos/gemini-color.svg',
  pi_local: null,
};

export function getModelsForAdapter(adapterType: string): Array<{ id: string; label: string }> {
  switch (adapterType) {
    case 'codex_local':
      return CODEX_MODELS;
    case 'claude_local':
      return CLAUDE_MODELS;
    case 'gemini_local':
      return GEMINI_MODELS;
    case 'cursor':
      return CURSOR_MODELS;
    case 'claude_code':
    case 'opencode':
      return AVAILABLE_MODELS.map((m) => ({ id: m.id, label: m.label }));
    default:
      return CODEX_MODELS;
  }
}
