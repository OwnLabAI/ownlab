'use client';

import Link from 'next/link';
import { EntityIcon } from '@/components/entity-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChartColumnBig, MessagesSquare, Settings2, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { TeamMembersDialog } from './team-members-dialog';

type TeamRecord = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  status?: string | null;
  adapterType?: string | null;
};

type TeamMemberRecord = {
  agentId: string;
  name: string;
  icon: string | null;
  role: string | null;
  teamRole: string;
  reportsTo: string | null;
  status: string | null;
  adapterType?: string | null;
};

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

export function TeamHeader({
  team,
  members,
  currentView,
  onOpenConfig,
  onDeleteTeam,
  deletingTeam = false,
  deleteError = null,
}: {
  team: TeamRecord;
  members: TeamMemberRecord[];
  currentView: 'chat' | 'chart';
  onOpenConfig?: () => void;
  onDeleteTeam?: () => void | Promise<void>;
  deletingTeam?: boolean;
  deleteError?: string | null;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const leader = members.find((member) => member.teamRole === 'leader') ?? null;
  const workerCount = members.filter((member) => member.teamRole === 'worker').length;

  return (
    <header className="flex min-h-12 shrink-0 items-center justify-between border-b px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <EntityIcon icon={team.icon} name={team.name} fallback="TM" className="size-8 rounded-lg" />
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm leading-tight">
          <span className="truncate font-semibold">{team.name}</span>
          {team.adapterType ? (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">
                {ADAPTER_LABELS[team.adapterType] ?? team.adapterType}
              </span>
            </>
          ) : null}
          {team.status ? (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">{team.status}</span>
            </>
          ) : null}
          <Badge variant="secondary">{members.length} members</Badge>
          <Badge variant="outline">{workerCount} workers</Badge>
          {leader ? <Badge variant="outline">Lead: {leader.name}</Badge> : null}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onOpenConfig}>
          <Settings2 className="size-3.5" />
          Config
        </Button>
        <TeamMembersDialog members={members}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Users data-icon="inline-start" />
            Members
          </Button>
        </TeamMembersDialog>
        {currentView === 'chat' ? (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
            <Link href={`/lab/teams/${encodeURIComponent(team.name)}/chart`}>
              <ChartColumnBig data-icon="inline-start" />
              Chart
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
            <Link href={`/lab/teams/${encodeURIComponent(team.name)}`}>
              <MessagesSquare data-icon="inline-start" />
              Chat
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:bg-transparent hover:text-destructive/80"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={!onDeleteTeam}
          aria-label="Delete team"
          title="Delete team"
        >
          <Trash2 />
        </Button>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="flex flex-col p-0 sm:max-w-md">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="text-xl">Remove Team</DialogTitle>
            <DialogDescription>
              This will delete the whole team and all agents inside it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <div className="mx-6 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{deleteError}</p>
            </div>
          ) : null}

          <DialogFooter className="px-6 py-4 border-t shrink-0 mx-0 mb-0 rounded-b-xl">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deletingTeam}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onDeleteTeam?.()}
              disabled={deletingTeam}
            >
              {deletingTeam ? 'Removing...' : 'Remove Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
