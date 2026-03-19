'use client';

import { type ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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

export function TeamMembersDialog({
  children,
  members,
}: {
  children: ReactNode;
  members: TeamMemberRecord[];
}) {
  const leader = members.find((member) => member.teamRole === 'leader') ?? null;
  const workers = members.filter((member) => member.teamRole === 'worker');

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex max-h-[80vh] flex-col p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Team members</DialogTitle>
          <DialogDescription>
            Inspect the team hierarchy and current runtime status for each agent.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-6 py-5">
            {leader ? (
              <section className="flex flex-col gap-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Leader
                </p>
                <TeamMemberRow member={leader} />
              </section>
            ) : null}

            <section className="flex flex-col gap-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Workers
              </p>
              <div className="flex flex-col gap-2">
                {workers.length > 0 ? (
                  workers.map((member) => <TeamMemberRow key={member.agentId} member={member} />)
                ) : (
                  <p className="text-sm text-muted-foreground">No worker agents are assigned yet.</p>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function TeamMemberRow({ member }: { member: TeamMemberRecord }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-3">
      <Avatar>
        {isImageUrl(member.icon) ? <AvatarImage src={member.icon ?? ''} alt={member.name} /> : null}
        <AvatarFallback>{getFallback(member.name, member.icon)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{member.name}</span>
          <Badge variant={member.teamRole === 'leader' ? 'secondary' : 'outline'}>
            {member.teamRole}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {member.role ? <span>{member.role}</span> : null}
          {member.adapterType ? <span>{member.adapterType}</span> : null}
          {member.status ? <span>{member.status}</span> : null}
        </div>
      </div>
    </div>
  );
}

function isImageUrl(icon: string | null) {
  if (!icon) {
    return false;
  }

  return /^(https?:|data:image\/|blob:|\/)/.test(icon);
}

function getFallback(name: string, icon: string | null) {
  if (!isImageUrl(icon) && icon) {
    return icon;
  }

  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}
