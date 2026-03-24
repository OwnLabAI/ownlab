'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { Hash, Trash2, Users, X } from 'lucide-react';
import { Loader } from '@/components/ai-elements/loader';
import {
  deleteChannel,
  fetchChannelMembers,
  ensureDefaultChannel,
  fetchWorkspaceChannels,
  type Channel,
  type ChannelMember,
} from '@/lib/api';
import { useWorkspaceView } from '@/features/workspace/stores/use-workspace-view-store';
import { WorkspaceChannelChatView } from './channel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
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
import { ToolPanelChannels } from './tool-panel-channels';
import { toast } from 'sonner';

interface ChannelChatProps {
  workspaceId: string;
  workspaceName?: string;
  workspaceRootPath?: string | null;
}

export function ChannelChat({ workspaceId, workspaceName, workspaceRootPath }: ChannelChatProps) {
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
        let nextChannels = await fetchWorkspaceChannels(workspaceId);
        if (nextChannels.length === 0) {
          const defaultChannel = await ensureDefaultChannel(workspaceId);
          nextChannels = [defaultChannel];
        }

        if (cancelled) {
          return;
        }

        setChannels(nextChannels);

        const hasSelected = selectedChannelId && nextChannels.some((entry) => entry.id === selectedChannelId);
        if (!hasSelected) {
          const preferredDefault =
            nextChannels.find((entry) => entry.scopeRefId === workspaceId) ?? nextChannels[0] ?? null;
          setSelectedChannelId(preferredDefault?.id ?? null);
        }
      } catch (err) {
        console.error('Failed to load channels:', err);
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
  const isDefaultWorkspaceChannel = !!channel && channel.scopeType === 'workspace' && channel.scopeRefId === workspaceId;
  const channelDisplayName = channel?.title?.trim() || channel?.name || 'this channel';

  const handleDeleteChannel = async () => {
    if (!channel) {
      return;
    }

    setDeleting(true);
    try {
      await deleteChannel(channel.id);
      const remainingChannels = channels.filter((entry) => entry.id !== channel.id);
      if (remainingChannels.length > 0) {
        const fallbackChannel =
          remainingChannels.find((entry) => entry.scopeRefId === workspaceId) ??
          remainingChannels[0] ??
          null;
        setChannels(remainingChannels);
        setSelectedChannelId(fallbackChannel?.id ?? null);
      } else {
        const defaultChannel = await ensureDefaultChannel(workspaceId);
        setChannels([defaultChannel]);
        setSelectedChannelId(defaultChannel.id);
      }
      bumpChannelsVersion();
      setDeleteDialogOpen(false);
      setChannelsOpen(false);
      toast.success('Channel deleted.');
    } catch (err) {
      console.error('Failed to delete channel:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete channel');
    } finally {
      setDeleting(false);
    }
  };

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
      } catch (err) {
        console.error('Failed to load channel member count:', err);
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
        <div className="text-center max-w-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-4">
            <Hash className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {error || 'Failed to load channel.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              ensureDefaultChannel(workspaceId)
                .then(async (ch) => {
                  setChannels([ch]);
                  setSelectedChannelId(ch.id);
                })
                .catch((err) => {
                  console.error(err);
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

  const channelsAction = (
    <div className="flex items-center gap-2">
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
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ChannelHeader title={channel.title?.trim() || channel.name || workspaceName || 'Workspace'} actions={channelsAction} />
      <WorkspaceChannelsDialog
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
      <WorkspaceChannelChatView
        channel={channel}
        workspaceRootPath={workspaceRootPath ?? null}
        placeholder={`Message ${channel.title ?? channel.name}`}
        extraBody={{ scopeType: 'workspace', scopeRefId: channel.scopeRefId ?? channel.workspaceId }}
      />
    </div>
  );
}

function ChannelHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-start justify-between gap-3 px-4 pt-4">
      <span className="font-medium text-sm">{title}</span>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

function WorkspaceChannelsDialog({
  open,
  onOpenChange,
  channel,
  deleting,
  isDefaultWorkspaceChannel,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
  deleting: boolean;
  isDefaultWorkspaceChannel: boolean;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[75vh] max-w-xl flex-col overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="relative border-b px-6 py-4">
          <div className="pr-24">
            <DialogTitle>{channel.title?.trim() || channel.name}</DialogTitle>
          </div>
          <DialogDescription>Manage channel members.</DialogDescription>
          <div className="absolute top-3.5 right-4 flex items-center gap-1">
            {!isDefaultWorkspaceChannel ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={onDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Delete channel</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Delete channel</TooltipContent>
              </Tooltip>
            ) : null}
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ToolPanelChannels mode="members" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
