'use client';

import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Trash2, MessageSquare } from 'lucide-react';

/** Local type for conversation history list (channel-based; no separate thread API). */
export type ThreadItem = {
  id: string;
  title: string | null;
  createdAt: string;
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function groupThreadsByDate(threads: ThreadItem[]) {
  const groups: { label: string; threads: ThreadItem[] }[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const todayThreads: ThreadItem[] = [];
  const yesterdayThreads: ThreadItem[] = [];
  const thisWeekThreads: ThreadItem[] = [];
  const olderThreads: ThreadItem[] = [];

  for (const thread of threads) {
    const created = new Date(thread.createdAt);
    if (created >= today) {
      todayThreads.push(thread);
    } else if (created >= yesterday) {
      yesterdayThreads.push(thread);
    } else if (created >= weekAgo) {
      thisWeekThreads.push(thread);
    } else {
      olderThreads.push(thread);
    }
  }

  if (todayThreads.length > 0) groups.push({ label: 'Today', threads: todayThreads });
  if (yesterdayThreads.length > 0) groups.push({ label: 'Yesterday', threads: yesterdayThreads });
  if (thisWeekThreads.length > 0) groups.push({ label: 'This Week', threads: thisWeekThreads });
  if (olderThreads.length > 0) groups.push({ label: 'Older', threads: olderThreads });

  return groups;
}

type Props = {
  threads: ThreadItem[];
  currentThreadId?: string | null;
  onSelect: (threadId: string) => void;
  onDelete: (threadId: string) => void;
};

type ThreadRowProps = {
  thread: ThreadItem;
  isActive: boolean;
  onSelect: (threadId: string) => void;
  onDelete: (e: React.MouseEvent, threadId: string) => void;
};

function ThreadRow({ thread, isActive, onSelect, onDelete }: ThreadRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(thread.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(thread.id);
        }
      }}
      className={`group/item relative flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-150 ${
        isActive
          ? 'bg-accent/70 shadow-sm'
          : 'bg-background/70 hover:bg-accent/45 hover:shadow-sm'
      } focus-visible:outline-none focus-visible:bg-accent/55 focus-visible:shadow-sm`}
    >
      <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p
          className="line-clamp-2 break-all text-sm font-medium leading-snug text-foreground"
          title={thread.title || 'Untitled'}
        >
          {thread.title || 'Untitled'}
        </p>
      </div>
      <div className="flex shrink-0 items-center self-start">
        <p className="pt-0.5 text-[11px] text-muted-foreground transition-opacity group-hover/item:opacity-0 group-focus-visible/item:opacity-0">
          {formatRelativeTime(thread.createdAt)}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 size-7 -translate-y-1/2 rounded-lg opacity-0 pointer-events-none transition-opacity group-hover/item:opacity-100 group-hover/item:pointer-events-auto group-focus-visible/item:opacity-100 group-focus-visible/item:pointer-events-auto"
          onClick={(e) => onDelete(e, thread.id)}
          aria-label="Delete conversation"
          title="Delete conversation"
        >
          <Trash2 className="size-3 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

export function ThreadList({ threads, currentThreadId, onSelect, onDelete }: Props) {
  const groups = useMemo(() => groupThreadsByDate(threads), [threads]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, threadId: string) => {
      e.stopPropagation();
      onDelete(threadId);
    },
    [onDelete],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          <History className="size-3.5" />
          History
          {threads.length > 0 && (
            <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {threads.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
      >
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Conversation History</h3>
        </div>
        {threads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquare className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="p-3">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 mt-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground first:mt-0">
                    {group.label}
                  </p>
                  <div className="space-y-1.5">
                    {group.threads.map((thread) => (
                      <ThreadRow
                        key={thread.id}
                        thread={thread}
                        isActive={currentThreadId === thread.id}
                        onSelect={onSelect}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
