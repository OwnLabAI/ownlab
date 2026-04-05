'use client';

import { useEffect, useMemo, useState } from 'react';
import { Hash, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Loader } from '@/components/ai-elements/loader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  deleteChannel,
  fetchChannelMembers,
  type Channel,
  type ChannelMember,
} from '@/lib/api';
import {
  getPreferredWorkspaceChannel,
  loadWorkspaceChannels,
} from '@/features/workspace/data/channels';
import { useWorkspaceView } from '@/features/workspace/stores/use-workspace-view-store';
import { ChannelHeader } from './header';
import { ChannelManageDialog } from './manage-dialog';
import { ChannelChatView } from './chat-view';

interface ChannelPanelProps {
  workspaceId: string;
  workspaceName?: string;
  workspaceRootPath?: string | null;
}

export function ChannelPanel({ workspaceId, workspaceName, workspaceRootPath }: ChannelPanelProps) {
  const {
    selectedChannelId,
    setSelectedChannelId,
    channelsVersion,
    bumpChannelsVersion,
  } = useWorkspaceView(workspaceId);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [channelMemberCount, setChannelMemberCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadChannels() {
      setLoading(true);
      setError(null);
      try {
        const nextChannels = await loadWorkspaceChannels(workspaceId);

        if (cancelled) {
          return;
        }

        setChannels(nextChannels);

        const preferredChannel = getPreferredWorkspaceChannel(nextChannels, workspaceId, selectedChannelId);
        if (preferredChannel?.id !== selectedChannelId) {
          setSelectedChannelId(preferredChannel?.id ?? null);
        }
      } catch (nextError) {
        console.error('Failed to load channels:', nextError);
        if (!cancelled) {
          setError('Unable to connect to the server. Make sure the backend is running.');
          setChannels([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadChannels();
    return () => {
      cancelled = true;
    };
  }, [channelsVersion, workspaceId]);

  const channel =
    channels.find((entry) => entry.id === selectedChannelId) ??
    channels.find((entry) => entry.scopeRefId === workspaceId) ??
    channels[0] ??
    null;
  const sortedChannels = useMemo(
    () => [...channels].sort((left, right) => {
      const leftDate = left.lastMessageAt ?? left.updatedAt ?? left.createdAt;
      const rightDate = right.lastMessageAt ?? right.updatedAt ?? right.createdAt;
      return rightDate.localeCompare(leftDate);
    }),
    [channels],
  );
  const isDefaultWorkspaceChannel =
    !!channel && channel.scopeType === 'workspace' && channel.scopeRefId === workspaceId;
  const channelDisplayName = channel?.title?.trim() || channel?.name || 'this channel';

  useEffect(() => {
    if (!channel) {
      setChannelMemberCount(null);
      return;
    }

    let cancelled = false;

    async function loadChannelMemberCount() {
      try {
        const members = await fetchChannelMembers(channel.id);
        if (!cancelled) {
          const agentCount = members.filter((member: ChannelMember) => member.actorType === 'agent').length;
          setChannelMemberCount(agentCount);
        }
      } catch (nextError) {
        console.error('Failed to load channel member count:', nextError);
        if (!cancelled) {
          setChannelMemberCount(null);
        }
      }
    }

    void loadChannelMemberCount();
    return () => {
      cancelled = true;
    };
  }, [channel?.id, channelsOpen]);

  async function handleDeleteChannel() {
    if (!channel) {
      return;
    }

    setDeleting(true);
    try {
      await deleteChannel(channel.id);
      const remainingChannels = channels.filter((entry) => entry.id !== channel.id);
      if (remainingChannels.length > 0) {
        const fallbackChannel = getPreferredWorkspaceChannel(remainingChannels, workspaceId, null);
        setChannels(remainingChannels);
        setSelectedChannelId(fallbackChannel?.id ?? null);
      } else {
        const nextChannels = await loadWorkspaceChannels(workspaceId);
        const defaultChannel = getPreferredWorkspaceChannel(nextChannels, workspaceId, null);
        setChannels(nextChannels);
        setSelectedChannelId(defaultChannel?.id ?? null);
      }
      bumpChannelsVersion();
      setDeleteDialogOpen(false);
      setChannelsOpen(false);
      toast.success('Channel deleted.');
    } catch (nextError) {
      console.error('Failed to delete channel:', nextError);
      toast.error(nextError instanceof Error ? nextError.message : 'Failed to delete channel');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="text-muted-foreground" />
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Hash className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            {error || 'Failed to load channel.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              loadWorkspaceChannels(workspaceId)
                .then((nextChannels) => {
                  const preferredChannel = getPreferredWorkspaceChannel(nextChannels, workspaceId, selectedChannelId);
                  setChannels(nextChannels);
                  setSelectedChannelId(preferredChannel?.id ?? null);
                })
                .catch((nextError) => {
                  console.error(nextError);
                  setError('Unable to connect to the server. Make sure the backend is running.');
                })
                .finally(() => setLoading(false));
            }}
            className="text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const headerActions = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 rounded-full px-3"
          onClick={() => setChannelsOpen(true)}
        >
          <Users className="size-4" />
          {channelMemberCount != null ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
              {channelMemberCount}
            </span>
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Channel members</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ChannelHeader
        title={channel.title?.trim() || channel.name || workspaceName || 'Workspace'}
        channels={sortedChannels}
        selectedChannelId={channel.id}
        onSelectChannel={setSelectedChannelId}
        actions={headerActions}
      />
      <ChannelManageDialog
        open={channelsOpen}
        onOpenChange={setChannelsOpen}
        channel={channel}
        deleting={deleting}
        isDefaultWorkspaceChannel={isDefaultWorkspaceChannel}
        onDelete={() => setDeleteDialogOpen(true)}
      />
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="flex flex-col p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle className="text-xl">Delete Channel</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{channelDisplayName}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-xl border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteChannel}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ChannelChatView
        channel={channel}
        workspaceRootPath={workspaceRootPath ?? null}
        placeholder={`Message ${channel.title ?? channel.name}`}
        extraBody={{ scopeType: 'workspace', scopeRefId: channel.scopeRefId ?? channel.workspaceId }}
      />
    </div>
  );
}
