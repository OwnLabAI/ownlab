'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EntityIcon } from '@/components/entity-icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { fetchAgentRuntimeSkills, type AgentRuntimeSkillsRecord } from '@/lib/api';
import { BrainCircuit, Download, Loader2, PenSquare, Settings2, Trash2 } from 'lucide-react';
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
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [runtimeSkills, setRuntimeSkills] = useState<AgentRuntimeSkillsRecord | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  useEffect(() => {
    if (!skillsDialogOpen) {
      return;
    }

    let cancelled = false;

    async function loadRuntimeSkills() {
      setSkillsLoading(true);
      setSkillsError(null);
      try {
        const result = await fetchAgentRuntimeSkills(agent.id);
        if (!cancelled) {
          setRuntimeSkills(result);
        }
      } catch (error) {
        if (!cancelled) {
          setRuntimeSkills(null);
          setSkillsError(
            error instanceof Error ? error.message : 'Failed to load agent runtime skills',
          );
        }
      } finally {
        if (!cancelled) {
          setSkillsLoading(false);
        }
      }
    }

    void loadRuntimeSkills();

    return () => {
      cancelled = true;
    };
  }, [agent.id, skillsDialogOpen]);

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
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setSkillsDialogOpen(true)}
          >
            <BrainCircuit className="size-3.5" />
            Skills
          </Button>
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

      <Dialog open={skillsDialogOpen} onOpenChange={setSkillsDialogOpen}>
        <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-3">
            <DialogTitle className="text-xl">Agent Skills</DialogTitle>
            <DialogDescription>
              Skills currently installed for this agent.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1 px-6 py-4">
            {skillsLoading ? (
              <div className="flex min-h-40 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : skillsError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {skillsError}
              </div>
            ) : !runtimeSkills?.supported ? (
              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                The `{agent.adapterType}` adapter does not support runtime skills.
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Installed Skills</CardTitle>
                  <CardDescription>
                    {runtimeSkills.entries.length > 0
                      ? `${runtimeSkills.entries.length} skill${runtimeSkills.entries.length === 1 ? '' : 's'} available.`
                      : 'No skills installed for this agent yet.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {runtimeSkills.entries.length === 0 ? (
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <Link href="/lab/skills" onClick={() => setSkillsDialogOpen(false)}>
                        <Download className="size-4" />
                        Browse Skills
                      </Link>
                    </Button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {runtimeSkills.entries.map((entry) => (
                        <div
                          key={entry.name}
                          className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground"
                        >
                          {entry.name}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
