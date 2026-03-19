const API_BASE = '/api';
const SERVER_BASE =
  typeof window === 'undefined'
    ? process.env.OWNLAB_SERVER_URL ?? 'http://localhost:3100'
    : process.env.NEXT_PUBLIC_OWNLAB_SERVER_URL ?? 'http://localhost:3100';

// ── Agents ──────────────────────────────────────────────────────────────────

export interface AgentRecord {
  id: string;
  labId: string;
  name: string;
  role?: string | null;
  reportsTo?: string | null;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
  icon: string | null;
  status: string;
}

export interface TeamRecord {
  id: string;
  labId: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  status: string;
  leaderAgentId: string | null;
  runtimeConfig: Record<string, unknown>;
  metadata: Record<string, unknown>;
  memberAgentIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberRecord {
  teamId: string;
  agentId: string;
  role: string;
  teamRole: string;
  joinedAt: string;
  name: string;
  icon: string | null;
  status: string;
  adapterType: string;
  reportsTo: string | null;
}

export async function fetchAgents(): Promise<AgentRecord[]> {
  const res = await fetch(`${API_BASE}/agents`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export async function fetchAgentByName(name: string) {
  const res = await fetch(`${API_BASE}/agents/by-name/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Agent not found');
  return res.json();
}

export async function fetchAgentById(id: string) {
  const res = await fetch(`${API_BASE}/agents/${id}`);
  if (!res.ok) throw new Error('Agent not found');
  return res.json();
}

export async function createAgent(data: {
  name: string;
  role?: string;
  reportsTo?: string | null;
  adapterType: string;
  model: string;
  icon?: string | null;
  style?: string;
  agentType?: string;
  adapterConfig?: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
}) {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create agent' }));
    throw new Error(err.error || 'Failed to create agent');
  }
  return res.json();
}

export async function updateAgent(
  id: string,
  data: Partial<{
    name: string;
    role: string | null;
    reportsTo: string | null;
    adapterType: string;
    icon: string | null;
    status: string | null;
    adapterConfig: Record<string, unknown> | null;
    runtimeConfig: Record<string, unknown> | null;
  }>,
) {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update agent' }));
    throw new Error(err.error || 'Failed to update agent');
  }
  return res.json();
}

export async function fetchTeams(): Promise<TeamRecord[]> {
  const res = await fetch(`${API_BASE}/teams`);
  if (!res.ok) throw new Error('Failed to fetch teams');
  return res.json();
}

export async function fetchTeamByName(name: string): Promise<TeamRecord> {
  const res = await fetch(`${API_BASE}/teams/by-name/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Team not found');
  return res.json();
}

export async function fetchTeamById(id: string): Promise<TeamRecord> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Team not found');
  return res.json();
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMemberRecord[]> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(teamId)}/members`);
  if (!res.ok) throw new Error('Failed to fetch team members');
  return res.json();
}

export async function createTeam(data: {
  name: string;
  description?: string;
  leaderName: string;
  leaderRole?: string;
  workerCount: number;
  workerRole?: string;
  workerNamePrefix?: string;
  workspaceId?: string;
  adapterType: string;
  model: string;
  icon?: string;
  runtimeConfig?: Record<string, unknown>;
  adapterConfig?: Record<string, unknown>;
}): Promise<{
  team: TeamRecord;
  leader: AgentRecord;
  workers: AgentRecord[];
  channel: Channel | null;
}> {
  const res = await fetch(`${API_BASE}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create team' }));
    throw new Error(err.error || 'Failed to create team');
  }
  return res.json();
}

export async function updateTeam(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    icon: string | null;
    status: string;
    workspaceId: string | null;
  }>,
): Promise<TeamRecord> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update team' }));
    throw new Error(err.error || 'Failed to update team');
  }
  return res.json();
}

export async function deleteTeam(id: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE}/teams/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete team' }));
    throw new Error(err.error || 'Failed to delete team');
  }
  return res.json();
}

export interface AgencyTemplateSummary {
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  vibe: string | null;
  category: string;
  department: string;
  path: string;
}

export interface AgencyTemplateDetail extends AgencyTemplateSummary {
  content: string;
}

export interface SkillRecord {
  id: string;
  labId: string;
  slug: string;
  name: string;
  description: string | null;
  sourceType: 'builtin' | 'community';
  localPath: string;
  adapterCompat: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SkillDetailRecord extends SkillRecord {
  content: string;
}

export interface AgentSkillAssignmentRecord {
  id: string;
  agentId: string;
  skillId: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  skill: SkillRecord;
}

export async function fetchAgencyTemplates(): Promise<AgencyTemplateSummary[]> {
  const res = await fetch(`${API_BASE}/agents/agencies`);
  if (!res.ok) throw new Error('Failed to fetch agency templates');
  return res.json();
}

export async function fetchAgencyTemplate(slug: string): Promise<AgencyTemplateDetail> {
  const res = await fetch(`${API_BASE}/agents/agencies/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Failed to fetch agency template');
  return res.json();
}

export async function deleteAgent(id: string) {
  const res = await fetch(`${API_BASE}/agents/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete agent' }));
    throw new Error(err.error || 'Failed to delete agent');
  }
  return res.json();
}

export async function fetchSkills(): Promise<SkillRecord[]> {
  const res = await fetch(`${API_BASE}/skills`);
  if (!res.ok) throw new Error('Failed to fetch skills');
  return res.json();
}

export async function fetchSkillDetail(skillId: string): Promise<SkillDetailRecord> {
  const res = await fetch(`${API_BASE}/skills/${encodeURIComponent(skillId)}`);
  if (!res.ok) throw new Error('Failed to fetch skill detail');
  return res.json();
}

export async function importSkill(data: {
  sourcePath: string;
  slug?: string | null;
}): Promise<SkillRecord | null> {
  const res = await fetch(`${API_BASE}/skills/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to import skill' }));
    throw new Error(err.error || 'Failed to import skill');
  }
  return res.json();
}

export async function fetchAgentSkills(agentId: string): Promise<AgentSkillAssignmentRecord[]> {
  const res = await fetch(`${API_BASE}/skills/agents/${encodeURIComponent(agentId)}`);
  if (!res.ok) throw new Error('Failed to fetch agent skills');
  return res.json();
}

export async function updateAgentSkills(
  agentId: string,
  assignments: Array<{
    skillId: string;
    enabled?: boolean;
    priority?: number;
    config?: Record<string, unknown>;
  }>,
): Promise<AgentSkillAssignmentRecord[]> {
  const res = await fetch(`${API_BASE}/skills/agents/${encodeURIComponent(agentId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignments }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update agent skills' }));
    throw new Error(err.error || 'Failed to update agent skills');
  }
  return res.json();
}

// ── Agent Chat (local adapter) ────────────────────────────────────────────────

export interface AgentChannelChatInput {
  channelId?: string;
  agentId?: string;
  workspaceId?: string;
  sessionId?: string;
  content: string;
  actorId: string;
  attachments?: ChannelAttachment[];
  mentions?: ChannelMention[];
  scopeType?: 'agent_dm' | 'task' | 'workspace' | 'team';
  taskId?: string;
  assigneeAgentId?: string;
  teamId?: string;
}

export interface AgentChannelChatExecution {
  exitCode: number | null;
  timedOut: boolean;
  errorMessage: string | null;
  usage?: Record<string, unknown> | null;
  provider?: string | null;
  model?: string | null;
}

export interface AgentChannelChatResult {
  channelId: string;
  userMessage: ChannelMessage;
  assistantMessage: ChannelMessage | null;
  assistantMessages: ChannelMessage[];
  execution: AgentChannelChatExecution;
  executions: AgentChannelChatExecution[];
}

export async function sendChannelChatMessageViaServer(
  input: AgentChannelChatInput,
): Promise<AgentChannelChatResult> {
  const url = input.channelId
    ? `${SERVER_BASE}/api/channels/${input.channelId}/messages/respond`
    : `${SERVER_BASE}/api/channel-chat`;
  const body = input.channelId
    ? JSON.stringify({
        actorId: input.actorId,
        sessionId: input.sessionId,
        content: input.content,
        attachments: input.attachments,
        mentions: input.mentions,
      })
    : JSON.stringify(input);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to send agent channel message' }));
    throw new Error(err.error || 'Failed to send agent channel message');
  }
  return res.json();
}

export async function sendAgentChannelMessageViaServer(
  input: AgentChannelChatInput,
): Promise<AgentChannelChatResult> {
  return sendChannelChatMessageViaServer(input);
}

// ── Workspaces ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  labId: string;
  name: string;
  description: string | null;
  worktreePath: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  hasChildren?: boolean;
}

export interface WorkspaceFileTreeResponse {
  rootName: string;
  rootPath: string;
  items: FileTreeNode[];
}

export async function fetchWorkspaces(opts?: { labId?: string }): Promise<Workspace[]> {
  const params = opts?.labId ? `?labId=${encodeURIComponent(opts.labId)}` : '';
  const url =
    typeof window === 'undefined'
      ? `${SERVER_BASE}/api/workspaces${params}`
      : `${API_BASE}/workspaces${params}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

export async function createWorkspaceApi(data: {
  name: string;
  description?: string | null;
  worktreePath?: string | null;
}): Promise<Workspace> {
  const res = await fetch(`${SERVER_BASE}/api/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create workspace' }));
    throw new Error(err.error || 'Failed to create workspace');
  }
  return res.json();
}

export async function browseWorkspaceFolder(): Promise<{
  path: string;
  name: string;
} | null> {
  const res = await fetch(`${API_BASE}/workspaces/browse-folder`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to browse for folder' }));
    throw new Error(err.error || 'Failed to browse for folder');
  }

  return res.json();
}

export async function updateWorkspaceApi(
  id: string,
  data: Partial<{ name: string; description: string | null; status: string; worktreePath: string | null }>,
): Promise<Workspace> {
  const res = await fetch(`${SERVER_BASE}/api/workspaces/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update workspace' }));
    throw new Error(err.error || 'Failed to update workspace');
  }
  return res.json();
}

export async function deleteWorkspaceApi(id: string): Promise<void> {
  const res = await fetch(`${SERVER_BASE}/api/workspaces/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete workspace' }));
    throw new Error(err.error || 'Failed to delete workspace');
  }
}

export async function fetchWorkspaceFileTree(workspaceId: string): Promise<WorkspaceFileTreeResponse> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/file-tree`);
  if (!res.ok) {
    if (res.status === 404) {
      return { rootName: '', rootPath: '', items: [] };
    }
    const err = await res.json().catch(() => ({ error: 'Failed to fetch file tree' }));
    throw new Error(err.error || 'Failed to fetch file tree');
  }
  return res.json();
}

export async function fetchWorkspaceFolderContents(
  workspaceId: string,
  relativeDir?: string,
): Promise<FileTreeNode[]> {
  const q = relativeDir ? `?path=${encodeURIComponent(relativeDir)}` : '';
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/folder-contents${q}`);
  if (!res.ok) {
    if (res.status === 404) return [];
    const err = await res.json().catch(() => ({ error: 'Failed to fetch folder contents' }));
    throw new Error(err.error || 'Failed to fetch folder contents');
  }
  return res.json();
}

export async function createWorkspaceFileOrFolder(
  workspaceId: string,
  relativePath: string,
  type: 'file' | 'folder',
): Promise<void> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: relativePath, type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create' }));
    throw new Error((err as { error?: string }).error || 'Failed to create file or folder');
  }
}

export async function renameWorkspaceFileOrFolder(
  workspaceId: string,
  relativePath: string,
  newName: string,
): Promise<{ path: string; name: string }> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/files`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: relativePath, newName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to rename' }));
    throw new Error((err as { error?: string }).error || 'Failed to rename');
  }

  const data = await res.json();
  return data.item;
}

export async function deleteWorkspaceFileOrFolder(
  workspaceId: string,
  relativePath: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/workspaces/${workspaceId}/files?path=${encodeURIComponent(relativePath)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete' }));
    throw new Error((err as { error?: string }).error || 'Failed to delete');
  }
}

export async function moveWorkspaceFileOrFolder(
  workspaceId: string,
  relativePath: string,
  destinationPath = '',
): Promise<{ path: string; name: string }> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/files/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: relativePath, destinationPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to move' }));
    throw new Error((err as { error?: string }).error || 'Failed to move file or folder');
  }

  const data = await res.json();
  return data.item;
}

export async function fetchWorkspaceFileContent(
  workspaceId: string,
  relativePath: string,
): Promise<string> {
  const res = await fetch(
    `${API_BASE}/workspaces/${workspaceId}/files/content?path=${encodeURIComponent(relativePath)}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch file content' }));
    throw new Error(err.error || 'Failed to fetch file content');
  }
  return res.text();
}

// ── Channels ────────────────────────────────────────────────────────────────

export interface Channel {
  id: string;
  workspaceId: string;
  scopeType: string;
  scopeRefId: string | null;
  name: string;
  title: string | null;
  type: string;
  description: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  sessionId?: string | null;
  actorId: string;
  actorType: string;
  content: string;
  metadata: Record<string, unknown> | null;
  mentions: ChannelMention[];
  actorName: string | null;
  actorIcon: string | null;
  attachments: ChannelAttachment[];
  createdAt: string;
}

export interface ChannelMention {
  id: string;
  type: 'agent';
  label: string;
}

export interface ChannelAttachment {
  type: 'file';
  filename?: string;
  mediaType?: string;
  url?: string;
  textContent?: string | null;
  textExtractionKind?: 'inline_text' | 'pdf_text' | 'image_ocr' | 'unsupported' | 'failed' | null;
}

export interface ConversationSession {
  id: string;
  agentId: string;
  channelId: string;
  title: string | null;
  codexSessionId: string | null;
  codexSessionParams: Record<string, unknown> | null;
  codexSessionDisplayId: string | null;
  startedAt: string;
  lastMessageAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ChannelChatStreamEvent =
  | {
      type: 'user_message';
      message: ChannelMessage;
    }
  | {
      type: 'assistant_message_start';
      message: ChannelMessage;
    }
  | {
      type: 'assistant_message_content';
      messageId: string;
      content: string;
    }
  | {
      type: 'assistant_message_complete';
      temporaryMessageId: string;
      message: ChannelMessage;
      execution: AgentChannelChatExecution;
    }
  | {
      type: 'status';
      message: string;
    }
  | {
      type: 'error';
      error: string;
    };

type ChannelChatStreamHandlers = {
  onEvent?: (event: ChannelChatStreamEvent) => void;
  signal?: AbortSignal;
};

function emitStreamEvent(
  event: ChannelChatStreamEvent,
  handlers: ChannelChatStreamHandlers,
) {
  handlers.onEvent?.(event);
}

export async function streamChannelChatMessageViaServer(
  input: AgentChannelChatInput,
  handlers: ChannelChatStreamHandlers = {},
): Promise<void> {
  const url = input.channelId
    ? `${SERVER_BASE}/api/channels/${input.channelId}/messages/respond/stream`
    : `${SERVER_BASE}/api/channel-chat/stream`;
  const body = input.channelId
    ? JSON.stringify({
        actorId: input.actorId,
        sessionId: input.sessionId,
        content: input.content,
        attachments: input.attachments,
        mentions: input.mentions,
      })
    : JSON.stringify(input);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: handlers.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to stream agent channel message' }));
    throw new Error(err.error || 'Failed to stream agent channel message');
  }

  if (!res.body) {
    throw new Error('Streaming response body is not available');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const event = JSON.parse(trimmed) as ChannelChatStreamEvent;
      emitStreamEvent(event, handlers);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const event = JSON.parse(tail) as ChannelChatStreamEvent;
    emitStreamEvent(event, handlers);
  }
}

export async function fetchChannels(input: {
  workspaceId?: string;
  scopeType?: string;
  scopeRefId?: string;
  includeArchived?: boolean;
}): Promise<Channel[]> {
  const params = new URLSearchParams();
  if (input.workspaceId) params.set('workspaceId', input.workspaceId);
  if (input.scopeType) params.set('scopeType', input.scopeType);
  if (input.scopeRefId) params.set('scopeRefId', input.scopeRefId);
  if (input.includeArchived) params.set('includeArchived', 'true');
  const res = await fetch(`${API_BASE}/channels?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch channels');
  return res.json();
}

export async function fetchChannelsByWorkspace(workspaceId: string): Promise<Channel[]> {
  return fetchChannels({ workspaceId });
}

export async function ensureDefaultChannel(workspaceId: string): Promise<Channel> {
  const res = await fetch(`${API_BASE}/channels/ensure-default`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
  });
  if (!res.ok) throw new Error('Failed to ensure default channel');
  return res.json();
}

export async function fetchChannelMessages(channelId: string, sessionId?: string | null): Promise<ChannelMessage[]> {
  const params = new URLSearchParams();
  if (sessionId) params.set('sessionId', sessionId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/channels/${channelId}/messages${suffix}`);
  if (!res.ok) throw new Error('Failed to fetch channel messages');
  return res.json();
}

export async function sendChannelMessage(
  channelId: string,
  data: { actorId: string; actorType?: string; content: string; metadata?: Record<string, unknown>; sessionId?: string | null },
): Promise<ChannelMessage> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to send channel message');
  return res.json();
}

export async function ensureAgentDmChannel(workspaceId: string, agentId: string): Promise<Channel> {
  const res = await fetch(`${API_BASE}/channels/ensure-agent-dm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, agentId }),
  });
  if (!res.ok) throw new Error('Failed to ensure agent DM channel');
  return res.json();
}

export async function ensureTeamChannel(workspaceId: string, teamId: string): Promise<Channel> {
  const res = await fetch(`${API_BASE}/channels/ensure-team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, teamId }),
  });
  if (!res.ok) throw new Error('Failed to ensure team channel');
  return res.json();
}

export async function fetchConversationSessions(channelId: string): Promise<ConversationSession[]> {
  const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(channelId)}/sessions`);
  if (!res.ok) throw new Error('Failed to fetch conversation sessions');
  return res.json();
}

export async function createConversationSession(
  channelId: string,
  title?: string | null,
): Promise<ConversationSession> {
  const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(channelId)}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title ?? null }),
  });
  if (!res.ok) throw new Error('Failed to create conversation session');
  return res.json();
}

export async function deleteConversationSession(channelId: string, sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(channelId)}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete conversation session');
}

export async function stopChannelRun(channelId: string): Promise<{
  channelId: string;
  stopped: boolean;
  runIds: string[];
}> {
  const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(channelId)}/stop`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to stop channel run' }));
    throw new Error(err.error || 'Failed to stop channel run');
  }
  return res.json();
}

export async function updateChannel(
  channelId: string,
  data: { title?: string | null; archived?: boolean },
): Promise<Channel> {
  const res = await fetch(`${API_BASE}/channels/${channelId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update channel');
  return res.json();
}

export async function deleteChannel(channelId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/channels/${channelId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete channel');
}

export async function ensureTaskChannel(workspaceId: string, taskId: string): Promise<Channel> {
  const res = await fetch(`${API_BASE}/channels/ensure-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, taskId }),
  });
  if (!res.ok) throw new Error('Failed to ensure task channel');
  return res.json();
}

export interface ChannelMember {
  channelId?: string;
  workspaceId?: string;
  actorId: string;
  actorType: string;
  source?: 'direct' | 'team';
  role?: string | null;
  joinedAt: string;
  name: string | null;
  icon: string | null;
  status: string | null;
}

export interface WorkspaceAgent {
  id: string;
  name: string;
  icon: string | null;
  status: string;
  adapterType: string;
}

export async function fetchChannelMembers(channelId: string): Promise<ChannelMember[]> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/members`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch channel members' }));
    throw new Error(err.error || 'Failed to fetch channel members');
  }
  return res.json();
}

export async function addChannelMember(
  channelId: string,
  actorId: string,
  actorType?: string,
): Promise<{ channelId: string; actorId: string; actorType: string; joinedAt: string }> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId, actorType: actorType ?? 'agent' }),
  });
  if (!res.ok) throw new Error('Failed to add channel member');
  return res.json();
}

export async function removeChannelMember(
  channelId: string,
  actorId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/members/${encodeURIComponent(actorId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove channel member');
}

export async function fetchWorkspaceAgents(workspaceId: string): Promise<WorkspaceAgent[]> {
  const res = await fetch(`${API_BASE}/channels/workspace/${workspaceId}/agents`);
  if (!res.ok) throw new Error('Failed to fetch workspace agents');
  return res.json();
}

export async function fetchAvailableWorkspaceAgents(workspaceId: string): Promise<WorkspaceAgent[]> {
  const res = await fetch(`${API_BASE}/channels/workspace/${workspaceId}/available-agents`);
  if (!res.ok) throw new Error('Failed to fetch available workspace agents');
  return res.json();
}

export async function fetchWorkspaceMembers(workspaceId: string): Promise<ChannelMember[]> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch workspace members' }));
    throw new Error(err.error || 'Failed to fetch workspace members');
  }
  return res.json();
}

export async function addWorkspaceMember(
  workspaceId: string,
  data: {
    actorId: string;
    actorType?: string;
    role?: string;
    displayName?: string | null;
    icon?: string | null;
  },
) {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to add workspace member' }));
    throw new Error(err.error || 'Failed to add workspace member');
  }
  return res.json();
}

export async function removeWorkspaceMember(workspaceId: string, actorId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/members/${encodeURIComponent(actorId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to remove workspace member' }));
    throw new Error(err.error || 'Failed to remove workspace member');
  }
}

// ── Taskboards ───────────────────────────────────────────────────────────────

export interface TaskBoard {
  id: string;
  labId: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchTaskBoards(): Promise<TaskBoard[]> {
  const res = await fetch(`${API_BASE}/taskboards`);
  if (!res.ok) throw new Error('Failed to fetch taskboards');
  return res.json();
}

export async function fetchTaskBoard(id: string): Promise<TaskBoard> {
  const res = await fetch(`${API_BASE}/taskboards/${id}`);
  if (!res.ok) throw new Error('Taskboard not found');
  return res.json();
}

export async function createTaskBoard(data: {
  name: string;
  description?: string;
}): Promise<TaskBoard> {
  const res = await fetch(`${API_BASE}/taskboards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create taskboard' }));
    throw new Error(err.error || 'Failed to create taskboard');
  }
  return res.json();
}

export async function updateTaskBoard(
  id: string,
  data: Partial<{ name: string; description: string; status: string }>,
): Promise<TaskBoard> {
  const res = await fetch(`${API_BASE}/taskboards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update taskboard');
  return res.json();
}

export async function deleteTaskBoard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/taskboards/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete taskboard');
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  labId: string;
  boardId: string | null;
  workspaceId: string | null;
  title: string;
  objective: string | null;
  status: string;
  priority: string;
  groupName: string | null;
  assigneeAgentId: string | null;
  scheduleEnabled: boolean;
  scheduleType: string;
  intervalSec: number | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResultSummary: string | null;
  metadata: Record<string, unknown> | null;
  taskNumber: number | null;
  identifier: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRun {
  id: string;
  taskId: string;
  status: string;
  trigger: string;
  runKind: string;
  summary: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetail {
  task: Task;
  parentTask: Task | null;
  children: Task[];
  runs: TaskRun[];
  metrics: Array<Record<string, unknown>>;
}

export async function fetchTasksByBoard(boardId: string): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks/by-board/${boardId}`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function fetchTask(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`);
  if (!res.ok) throw new Error('Task not found');
  return res.json();
}

export async function fetchTaskDetail(id: string): Promise<TaskDetail> {
  const res = await fetch(`${API_BASE}/tasks/${id}/detail`);
  if (!res.ok) throw new Error('Task detail not found');
  return res.json();
}

export async function createTask(data: {
  boardId?: string | null;
  workspaceId?: string | null;
  parentId?: string | null;
  title: string;
  objective?: string;
  status?: string;
  priority?: string;
  groupName?: string | null;
  assigneeAgentId?: string | null;
  assigneeTeamId?: string | null;
  mode?: 'scheduled' | 'auto';
  scheduleEnabled?: boolean;
  scheduleType?: string;
  intervalSec?: number | null;
}): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create task' }));
    throw new Error(err.error || 'Failed to create task');
  }
  return res.json();
}

export async function updateTask(
  id: string,
  data: Partial<{
    boardId: string | null;
    workspaceId: string | null;
    parentId: string | null;
    title: string;
    objective: string | null;
    status: string;
    priority: string;
    groupName: string | null;
    assigneeAgentId: string | null;
    assigneeTeamId: string | null;
    mode: 'scheduled' | 'auto';
    scheduleEnabled: boolean;
    scheduleType: string;
    intervalSec: number | null;
  }>,
): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
}

export async function runTask(id: string): Promise<TaskRun> {
  const res = await fetch(`${API_BASE}/tasks/${id}/run`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to run task' }));
    throw new Error((err as { error?: string }).error || 'Failed to run task');
  }
  return res.json();
}

export async function stopTask(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}/stop`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to stop task' }));
    throw new Error((err as { error?: string }).error || 'Failed to stop task');
  }
  return res.json();
}
