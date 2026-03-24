'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Plus, UserPlus, UserMinus } from 'lucide-react';
import { EntityIcon } from '@/components/entity-icon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  addChannelMember,
  createWorkspaceChannel,
  fetchChannelMembers,
  fetchWorkspaceChannels,
  fetchWorkspaceAgents,
  removeChannelMember,
  type Channel,
  type ChannelMember,
  type WorkspaceAgent,
} from '@/lib/api';
import { useWorkspaceView } from '@/features/workspace/stores/use-workspace-view-store';
import { toast } from 'sonner';

function getChannelLabel(channel: Channel) {
  return channel.title?.trim() || channel.name;
}

export function ToolPanelChannels({
  mode = 'full',
}: {
  mode?: 'full' | 'members';
}) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const {
    selectedChannelId,
    setSelectedChannelId,
    bumpMembersVersion,
    bumpChannelsVersion,
  } = useWorkspaceView(workspaceId);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [workspaceAgents, setWorkspaceAgents] = useState<WorkspaceAgent[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentChannel =
    channels.find((channel) => channel.id === selectedChannelId) ??
    channels.find((channel) => channel.scopeRefId === workspaceId) ??
    channels[0] ??
    null;

  const loadChannels = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [channelsRes, agentsRes] = await Promise.all([
        fetchWorkspaceChannels(workspaceId),
        fetchWorkspaceAgents(workspaceId),
      ]);
      setChannels(channelsRes);
      setWorkspaceAgents(agentsRes);
      if (!selectedChannelId || !channelsRes.some((channel) => channel.id === selectedChannelId)) {
        const nextChannel =
          channelsRes.find((channel) => channel.scopeRefId === workspaceId) ?? channelsRes[0] ?? null;
        setSelectedChannelId(nextChannel?.id ?? null);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
  }, [workspaceId]);

  useEffect(() => {
    if (!currentChannel) {
      setChannelMembers([]);
      return;
    }

    let cancelled = false;

    async function loadMembers() {
      try {
        const rows = await fetchChannelMembers(currentChannel.id);
        if (!cancelled) {
          setChannelMembers(rows);
        }
      } catch (err) {
        console.error('Failed to load channel members:', err);
        if (!cancelled) {
          setChannelMembers([]);
        }
      }
    }

    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [currentChannel?.id]);

  const memberAgentIds = new Set(
    channelMembers
      .filter((member) => member.actorType === 'agent')
      .map((member) => member.actorId),
  );
  const agentMembers = channelMembers.filter((member) => member.actorType === 'agent');
  const availableWorkspaceAgents = workspaceAgents.filter((agent) => !memberAgentIds.has(agent.id));
  const sortedChannels = useMemo(
    () => [...channels].sort((left, right) => {
      const leftDate = left.lastMessageAt ?? left.updatedAt ?? left.createdAt;
      const rightDate = right.lastMessageAt ?? right.updatedAt ?? right.createdAt;
      return rightDate.localeCompare(leftDate);
    }),
    [channels],
  );

  const handleAdd = async (agentId: string) => {
    if (!currentChannel) return;
    try {
      await addChannelMember(currentChannel.id, agentId, 'agent');
      const nextMembers = await fetchChannelMembers(currentChannel.id);
      setChannelMembers(nextMembers);
      bumpMembersVersion();
      toast.success('Agent added to channel.');
    } catch (err) {
      console.error('Failed to add channel member:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add channel member');
    }
  };

  const handleRemove = async (agentId: string) => {
    if (!currentChannel) return;
    try {
      await removeChannelMember(currentChannel.id, agentId);
      const nextMembers = await fetchChannelMembers(currentChannel.id);
      setChannelMembers(nextMembers);
      bumpMembersVersion();
      toast.success('Agent removed from channel.');
    } catch (err) {
      console.error('Failed to remove channel member:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to remove channel member');
    }
  };

  const toggleAgent = (agentId: string, checked: boolean) => {
    setSelectedAgentIds((current) => (
      checked ? [...new Set([...current, agentId])] : current.filter((id) => id !== agentId)
    ));
  };

  const handleCreateChannel = async () => {
    const trimmedName = newChannelName.trim();
    if (!trimmedName) {
      toast.error('Channel name is required.');
      return;
    }

    setCreating(true);
    try {
      const created = await createWorkspaceChannel({
        workspaceId,
        name: trimmedName,
        memberActorIds: selectedAgentIds,
      });
      await loadChannels();
      setSelectedChannelId(created.id);
      setCreateOpen(false);
      setNewChannelName('');
      setSelectedAgentIds([]);
      bumpChannelsVersion();
      toast.success('Channel created.');
    } catch (err) {
      console.error('Failed to create channel:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-1 flex-col overflow-hidden">
        {mode === 'full' ? (
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-medium text-foreground">Channels</p>
            <Button type="button" size="sm" className="rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 size-4" />
              New channel
            </Button>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-3">
          {mode === 'full' ? (
            <div>
              <div className="space-y-0.5">
                {sortedChannels.map((channel) => {
                  const active = currentChannel?.id === channel.id;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setSelectedChannelId(channel.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition ${
                        active ? 'bg-muted/70 text-foreground' : 'hover:bg-muted/40'
                      }`}
                    >
                      <span className="truncate text-sm font-medium">
                        {getChannelLabel(channel)}
                      </span>
                      {active ? (
                        <span className="shrink-0 text-[11px] text-muted-foreground">Current</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {currentChannel ? (
            <div>
              {mode === 'full' ? (
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                  Agents in {getChannelLabel(currentChannel)}
                </h3>
              ) : null}
              <ul className="space-y-1">
                {agentMembers.map((agent) => (
                  <li
                    key={agent.actorId}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                  >
                    <span className="flex items-center gap-2 truncate text-sm">
                      <EntityIcon icon={agent.icon} name={agent.name ?? agent.actorId} fallback="AI" className="size-6 rounded-md" fallbackClassName="rounded-md text-[10px]" />
                      <span>{agent.name ?? agent.actorId}</span>
                      {agent.status ? (
                        <span className="text-xs text-muted-foreground">
                          {agent.status}
                        </span>
                      ) : null}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 rounded-md hover:bg-muted"
                          onClick={() => handleRemove(agent.actorId)}
                          aria-label="Remove from channel"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Remove from channel</TooltipContent>
                    </Tooltip>
                  </li>
                ))}
                {agentMembers.length === 0 ? (
                  <li className="rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                    No agents in this channel yet.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {currentChannel ? (
            <div>
              {mode === 'full' ? (
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                  Add workspace agents
                </h3>
              ) : null}
              <ul className="space-y-1">
                {availableWorkspaceAgents.map((agent) => (
                  <li
                    key={agent.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                  >
                    <span className="flex items-center gap-2 truncate text-sm">
                      <EntityIcon icon={agent.icon} name={agent.name} fallback="AI" className="size-6 rounded-md" fallbackClassName="rounded-md text-[10px]" />
                      <span>{agent.name}</span>
                      {agent.status && (
                        <span className="text-xs text-muted-foreground">
                          {agent.status}
                        </span>
                      )}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 rounded-md hover:bg-muted"
                          onClick={() => handleAdd(agent.id)}
                          aria-label="Add to channel"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Add to channel</TooltipContent>
                    </Tooltip>
                  </li>
                ))}
                {availableWorkspaceAgents.length === 0 ? (
                  <li className="rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                    All workspace agents are already in this channel.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        {mode === 'full' ? (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>New channel</DialogTitle>
              <DialogDescription>
                Create a new channel in this workspace and choose which workspace agents join it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="new-channel-name">
                  Channel name
                </label>
                <Input
                  id="new-channel-name"
                  value={newChannelName}
                  onChange={(event) => setNewChannelName(event.target.value)}
                  placeholder="design-review"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Workspace agents</p>
                <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-border/60 p-3">
                  {workspaceAgents.map((agent) => {
                    const checked = selectedAgentIds.includes(agent.id);
                    return (
                      <label
                        key={agent.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleAgent(agent.id, value === true)}
                        />
                        <EntityIcon icon={agent.icon} name={agent.name} fallback="AI" className="size-6 rounded-md" fallbackClassName="rounded-md text-[10px]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">{agent.name}</div>
                          <div className="text-xs text-muted-foreground">{agent.status}</div>
                        </div>
                      </label>
                    );
                  })}
                  {workspaceAgents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No workspace agents available.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreateChannel} disabled={creating}>
                {creating ? 'Creating…' : 'Create channel'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
