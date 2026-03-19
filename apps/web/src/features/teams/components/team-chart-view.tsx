'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Users2 } from 'lucide-react';

type TeamRecord = {
  id: string;
  name: string;
  description?: string | null;
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

export function TeamChartView({
  team,
  members,
}: {
  team: TeamRecord;
  members: TeamMemberRecord[];
}) {
  const leader = members.find((member) => member.teamRole === 'leader') ?? null;
  const memberNameById = new Map(members.map((member) => [member.agentId, member.name]));
  const { root, unlinkedMembers } = buildTeamTree(leader, members);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex min-h-full flex-col gap-6 p-6">
        <h2 className="text-lg font-semibold">Team chart</h2>
        {!leader ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users2 />
              </EmptyMedia>
              <EmptyTitle>No leader assigned</EmptyTitle>
              <EmptyDescription>
                This team cannot render an org chart until a leader agent exists.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-8">
            {root ? (
              <div className="overflow-x-auto pb-4">
                <div className="mx-auto flex min-w-fit justify-center px-4">
                  <OrgChartNode node={root} memberNameById={memberNameById} />
                </div>
              </div>
            ) : null}

            {root && root.children.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No worker agents are attached to this team yet.
              </p>
            ) : null}

            {unlinkedMembers.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-dashed bg-muted/20 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Unlinked members</h3>
                  <p className="text-sm text-muted-foreground">
                    These agents could not be placed in the reporting tree because their manager
                    reference is missing or circular.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {unlinkedMembers.map((member) => (
                    <TeamNodeCard
                      key={member.agentId}
                      member={member}
                      emphasis={member.teamRole === 'leader' ? 'leader' : 'worker'}
                      reportsToName={member.reportsTo ? memberNameById.get(member.reportsTo) ?? null : null}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

type TeamTreeNode = {
  member: TeamMemberRecord;
  children: TeamTreeNode[];
};

function OrgChartNode({
  node,
  memberNameById,
}: {
  node: TeamTreeNode;
  memberNameById: Map<string, string>;
}) {
  const reportsToName = node.member.reportsTo ? memberNameById.get(node.member.reportsTo) ?? null : null;
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <TeamNodeCard
        member={node.member}
        emphasis={node.member.teamRole === 'leader' ? 'leader' : 'worker'}
        reportsToName={reportsToName}
      />

      {hasChildren ? (
        <ul className="relative mt-6 flex justify-center pt-8">
          <li className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-border" aria-hidden="true" />
          {node.children.map((child, index) => {
            const isOnlyChild = node.children.length === 1;
            const isFirst = index === 0;
            const isLast = index === node.children.length - 1;

            return (
              <li
                key={child.member.agentId}
                className={cn(
                  'relative flex flex-col items-center px-3 pt-8',
                  'after:absolute after:left-1/2 after:top-0 after:h-8 after:w-px after:-translate-x-1/2 after:bg-border',
                  !isOnlyChild &&
                    'before:absolute before:top-0 before:h-px before:bg-border before:left-0 before:w-full',
                  !isOnlyChild && isFirst && 'before:left-1/2 before:w-1/2',
                  !isOnlyChild && isLast && 'before:w-1/2',
                )}
              >
                <OrgChartNode node={child} memberNameById={memberNameById} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function TeamNodeCard({
  member,
  emphasis,
  reportsToName,
}: {
  member: TeamMemberRecord;
  emphasis: 'leader' | 'worker';
  reportsToName: string | null;
}) {
  return (
    <Card className="w-[320px] max-w-full border bg-card/95 shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <Avatar size="lg">
            {isImageUrl(member.icon) ? <AvatarImage src={member.icon ?? ''} alt={member.name} /> : null}
            <AvatarFallback>{getFallback(member.name, member.icon)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="truncate">{member.name}</CardTitle>
            <CardDescription>{member.role ?? 'general'}</CardDescription>
          </div>
          <Badge variant={emphasis === 'leader' ? 'secondary' : 'outline'}>{member.teamRole}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {member.adapterType ? <Badge variant="outline">{member.adapterType}</Badge> : null}
          {member.status ? <Badge variant="outline">{member.status}</Badge> : null}
        </div>
        {reportsToName ? (
          <p className="text-sm text-muted-foreground">Reports to {reportsToName}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Top-level owner for this team.</p>
        )}
      </CardContent>
    </Card>
  );
}

function buildTeamTree(
  leader: TeamMemberRecord | null,
  members: TeamMemberRecord[],
): {
  root: TeamTreeNode | null;
  unlinkedMembers: TeamMemberRecord[];
} {
  if (!leader) {
    return { root: null, unlinkedMembers: [] };
  }

  const childrenByManager = new Map<string, TeamMemberRecord[]>();
  for (const member of members) {
    if (member.agentId === leader.agentId || !member.reportsTo) {
      continue;
    }

    const existing = childrenByManager.get(member.reportsTo) ?? [];
    existing.push(member);
    childrenByManager.set(member.reportsTo, existing);
  }

  const linked = new Set<string>();

  const visit = (member: TeamMemberRecord, trail: Set<string>): TeamTreeNode => {
    linked.add(member.agentId);

    const nextTrail = new Set(trail);
    nextTrail.add(member.agentId);

    const children = (childrenByManager.get(member.agentId) ?? [])
      .filter((child) => !nextTrail.has(child.agentId))
      .map((child) => visit(child, nextTrail));

    return { member, children };
  };

  const root = visit(leader, new Set());
  const unlinkedMembers = members.filter((member) => !linked.has(member.agentId));

  return { root, unlinkedMembers };
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
