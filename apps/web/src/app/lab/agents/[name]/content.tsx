'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createConversationSession,
  deleteAgent,
  deleteConversationSession,
  ensureAgentDmChannel,
  fetchAgentByName,
  fetchConversationSessions,
  fetchWorkspaces,
  type Channel,
  type ConversationSession,
} from '@/lib/api';
import { AgentHeader } from '@/features/agents/components/agent-header';
import { AgentChat } from '@/features/agents/components/agent-chat';
import type { ThreadItem } from '@/features/agents/components/thread-list';
import { useAgentView } from '@/features/agents/stores/use-agent-view-store';
import { CreateAgentDialog } from '@/features/lab/components/agents/create-agent-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

type Agent = {
  id: string;
  labId: string;
  name: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
  icon: string | null;
  status: string;
  lastHeartbeatAt?: string | null;
};

type Props = {
  name: string;
};

function parseString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function AgentPageContent({ name }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingAgent, setDeletingAgent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { configOpen, setConfigOpen } = useAgentView(name);

  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const currentSessionId = searchParams.get('session');

  const threadItems = useMemo<ThreadItem[]>(
    () =>
      sessions.map((session) => ({
        id: session.id,
        title: session.title ?? null,
        createdAt: session.lastMessageAt ?? session.createdAt,
      })),
    [sessions],
  );

  const setCurrentSessionInUrl = useCallback(
    (sessionId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (sessionId) {
        params.set('session', sessionId);
      } else {
        params.delete('session');
      }
      const next = params.toString();
      router.replace(next ? `/lab/agents/${name}?${next}` : `/lab/agents/${name}`);
    },
    [name, router, searchParams],
  );

  const loadSessions = useCallback(async (channelId: string) => {
    const nextSessions = await fetchConversationSessions(channelId);
    setSessions(nextSessions);
    return nextSessions;
  }, []);

  const createSessionAndSelect = useCallback(
    async (channelId: string) => {
      const created = await createConversationSession(channelId);
      setSessions((prev) => [created, ...prev]);
      setCurrentSessionInUrl(created.id);
      return created;
    },
    [setCurrentSessionInUrl],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchAgentByName(name);
        if (!cancelled) setAgent(data);
      } catch {
        if (!cancelled) setError('Agent not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [name]);

  useEffect(() => {
    if (!agent) return;
    const agentRef: Agent = agent;
    let cancelled = false;
    async function loadChannel() {
      setChannelLoading(true);
      setChannelError(null);
      try {
        const workspaces = await fetchWorkspaces();
        const runtimeConfig = (agentRef.runtimeConfig ?? {}) as Record<string, unknown>;
        const configuredWorkspaceId = parseString(runtimeConfig.workspaceId);
        const configuredWorkspace =
          configuredWorkspaceId.length > 0
            ? workspaces.find((workspace) => workspace.id === configuredWorkspaceId)
            : null;
        const workspaceForLab =
          configuredWorkspace ??
          (Array.isArray(workspaces) && workspaces.length > 0
            ? workspaces.find((ws) => ws.labId === agentRef.labId) ?? workspaces[0]
            : null);
        if (!workspaceForLab) {
          throw new Error('No workspace available for this agent');
        }

        if (cancelled) return;

        const ensuredChannel = await ensureAgentDmChannel(workspaceForLab.id, agentRef.id);
        if (cancelled) return;
        setChannel(ensuredChannel);
        const nextSessions = await loadSessions(ensuredChannel.id);
        if (cancelled) return;

        const selected =
          (currentSessionId
            ? nextSessions.find((session) => session.id === currentSessionId)
            : null) ??
          nextSessions[0] ??
          (await createSessionAndSelect(ensuredChannel.id));

        if (!cancelled) {
          if (!currentSessionId || currentSessionId !== selected.id) {
            setCurrentSessionInUrl(selected.id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setChannel(null);
          setSessions([]);
          setChannelError(err instanceof Error ? err.message : 'Failed to load chat');
        }
      } finally {
        if (!cancelled) setChannelLoading(false);
      }
    }
    void loadChannel();
    return () => {
      cancelled = true;
    };
  }, [agent, createSessionAndSelect, currentSessionId, loadSessions, setCurrentSessionInUrl, retryTrigger]);

  const retryLoadChannel = useCallback(() => {
    setChannelError(null);
    setRetryTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!channel || !currentSessionId) {
      return;
    }
  }, [channel, currentSessionId]);

  const handleNewChat = useCallback(() => {
    if (!channel) {
      return;
    }
    void createSessionAndSelect(channel.id);
  }, [channel, createSessionAndSelect]);

  const handleSelectThread = useCallback(
    (sessionId: string) => {
      const selected = sessions.find((session) => session.id === sessionId);
      if (!selected) {
        return;
      }
      setCurrentSessionInUrl(sessionId);
    },
    [sessions, setCurrentSessionInUrl],
  );

  const handleDeleteThread = useCallback(
    (sessionId: string) => {
      if (!channel) {
        return;
      }

      void (async () => {
        await deleteConversationSession(channel.id, sessionId);
        const nextSessions = sessions.filter((session) => session.id !== sessionId);
        setSessions(nextSessions);

        if (sessionId !== currentSessionId) {
          return;
        }

        const fallback = nextSessions[0] ?? (await createSessionAndSelect(channel.id));
        setCurrentSessionInUrl(fallback.id);
      })();
    },
    [channel, createSessionAndSelect, currentSessionId, sessions, setCurrentSessionInUrl],
  );

  const handleChannelActivity = useCallback(() => {
    if (!channel) {
      return;
    }

    void loadSessions(channel.id);
  }, [channel, loadSessions]);

  const handleDeleteAgent = useCallback(async () => {
    if (!agent || deletingAgent) {
      return;
    }

    setDeleteError(null);
    setDeletingAgent(true);
    try {
      await deleteAgent(agent.id);
      router.push('/lab');
      router.refresh();
    } catch (deleteAgentError) {
      setDeleteError(
        deleteAgentError instanceof Error ? deleteAgentError.message : 'Failed to delete agent',
      );
    } finally {
      setDeletingAgent(false);
    }
  }, [agent, deletingAgent, router]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{error || 'Agent not found'}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AgentHeader
        agent={agent}
        threads={threadItems}
        currentThreadId={currentSessionId}
        onNewChat={handleNewChat}
        onOpenConfig={() => setConfigOpen(true)}
        onSelectThread={handleSelectThread}
        onDeleteThread={handleDeleteThread}
        onDeleteAgent={handleDeleteAgent}
        deletingAgent={deletingAgent}
        deleteError={deleteError}
      />
      {channelLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : channelError || !channel ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <p className="text-sm">{channelError ?? 'Failed to load chat'}</p>
          <Button variant="outline" size="sm" onClick={retryLoadChannel}>
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        </div>
      ) : (
        <AgentChat
          agent={agent}
          channel={channel}
          sessionId={currentSessionId ?? threadItems[0]?.id ?? ''}
          onChannelActivity={handleChannelActivity}
        />
      )}
      <CreateAgentDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        agent={agent}
        onSaved={(updated) => {
          setAgent(updated);
          if (updated.name !== name) {
            router.replace(`/lab/agents/${updated.name}`);
          }
        }}
      />
    </div>
  );
}
