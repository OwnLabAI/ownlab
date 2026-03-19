'use client';

import { useState } from 'react';
import { EntityIcon } from '@/components/entity-icon';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PenSquare, Settings2, Trash2 } from 'lucide-react';
import { ThreadList } from './thread-list';
import type { ThreadItem } from './thread-list';

const ADAPTER_LABELS: Record<string, string> = {
  codex_local: 'Codex',
  claude_local: 'Claude Code',
  claude_code: 'Claude Code',
  gemini_local: 'Gemini CLI',
  opencode_local: 'OpenCode',
  opencode: 'OpenCode',
  pi_local: 'Pi',
  cursor: 'Cursor',
};

type Props = {
  agent: {
    id: string;
    name: string;
    adapterType: string;
    icon: string | null;
    status?: string;
  };
  threads?: ThreadItem[];
  currentThreadId?: string | null;
  onNewChat?: () => void;
  onOpenConfig?: () => void;
  onSelectThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onDeleteAgent?: () => void | Promise<void>;
  deletingAgent?: boolean;
  deleteError?: string | null;
};

export function AgentHeader({
  agent,
  threads = [],
  currentThreadId = null,
  onNewChat,
  onOpenConfig,
  onSelectThread = () => {},
  onDeleteThread = () => {},
  onDeleteAgent,
  deletingAgent = false,
  deleteError = null,
}: Props) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <header className="flex min-h-12 shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <EntityIcon icon={agent.icon} name={agent.name} fallback="AI" className="size-8 rounded-lg" />
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm leading-tight">
              <span className="font-semibold">{agent.name}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">
                {ADAPTER_LABELS[agent.adapterType] ?? agent.adapterType}
              </span>
              {agent.status && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-muted-foreground">{agent.status}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onOpenConfig}>
            <Settings2 className="size-3.5" />
            Config
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onNewChat}>
            <PenSquare className="size-3.5" />
            New Chat
          </Button>
          <ThreadList
            threads={threads}
            currentThreadId={currentThreadId}
            onSelect={onSelectThread}
            onDelete={onDeleteThread}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-transparent hover:text-destructive/80"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!onDeleteAgent}
            aria-label="Delete agent"
            title="Delete agent"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </header>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="flex flex-col p-0 sm:max-w-md">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="text-xl">Remove Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this agent from your lab? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <div className="mx-6 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{deleteError}</p>
            </div>
          ) : null}

          <DialogFooter className="px-6 py-4 border-t shrink-0 mx-0 mb-0 rounded-b-xl">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deletingAgent}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onDeleteAgent?.()}
              disabled={deletingAgent}
            >
              {deletingAgent ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
