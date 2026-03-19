'use client';

import { useEffect, useState } from 'react';
import { Hash, Users } from 'lucide-react';
import { Loader } from '@/components/ai-elements/loader';
import {
  ensureDefaultChannel,
  fetchWorkspaceMembers,
  type Channel,
} from '@/lib/api';
import { WorkspaceChannelChatView } from './channel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ToolPanelMembers } from './tool-panel-members';

interface ChannelChatProps {
  workspaceId: string;
  workspaceName?: string;
}

export function ChannelChat({ workspaceId, workspaceName }: ChannelChatProps) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ensureDefaultChannel(workspaceId)
      .then(async (ch) => {
        if (!cancelled) setChannel(ch);
        try {
          const members = await fetchWorkspaceMembers(workspaceId);
          if (!cancelled) {
            setMemberCount(members.length);
          }
        } catch (memberError) {
          console.error('Failed to load channel members:', memberError);
          if (!cancelled) {
            setMemberCount(null);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load channel:', err);
        if (!cancelled) setError('Unable to connect to the server. Make sure the backend is running.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceId]);

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
                  setChannel(ch);
                  try {
                    const members = await fetchWorkspaceMembers(workspaceId);
                    setMemberCount(members.length);
                  } catch (memberError) {
                    console.error('Failed to reload channel members:', memberError);
                    setMemberCount(null);
                  }
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ChannelHeader workspaceName={workspaceName ?? 'Workspace'} />
      {channel ? (
        <WorkspaceMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          workspaceName={workspaceName ?? 'Workspace'}
          onMemberCountChange={setMemberCount}
        />
      ) : null}
      <WorkspaceChannelChatView
        channel={channel}
        headerActions={(
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-full"
                onClick={() => setMembersOpen(true)}
              >
                <Users className="size-4" />
                <span className="hidden sm:inline">View members</span>
                {memberCount != null ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
                    {memberCount}
                  </span>
                ) : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">View members</TooltipContent>
          </Tooltip>
        )}
        placeholder="Type @ to chat with a member"
        extraBody={{ scopeType: 'workspace', scopeRefId: channel.workspaceId }}
      />
    </div>
  );
}

function ChannelHeader({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-4">
      <span className="font-medium text-sm">{workspaceName}</span>
    </header>
  );
}

function WorkspaceMembersDialog({
  open,
  onOpenChange,
  workspaceName,
  onMemberCountChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  onMemberCountChange?: (count: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[75vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{workspaceName} members</DialogTitle>
          <DialogDescription>
            Manage the humans and agents who belong to this workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ToolPanelMembers onMemberCountChange={onMemberCountChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
