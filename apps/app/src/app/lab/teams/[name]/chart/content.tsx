'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api';
import type { TeamRecord } from '@/lib/api';
import { Loader2, Users2 } from 'lucide-react';
import { TeamHeader } from '@/features/teams/components/team-header';
import { TeamChartView } from '@/features/teams/components/team-chart-view';
import { ConfigTeamDialog } from '@/features/teams/components/config-team-dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

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

type TeamApi = {
  fetchTeamByName: (name: string) => Promise<TeamRecord>;
  fetchTeamMembers: (teamId: string) => Promise<TeamMemberRecord[]>;
  deleteTeam: (teamId: string) => Promise<unknown>;
};

type Props = {
  name: string;
};

const teamApi = api as unknown as TeamApi;

export function TeamChartPageContent({ name }: Props) {
  const router = useRouter();
  const [team, setTeam] = useState<TeamRecord | null>(null);
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const loadMembers = useCallback(async (teamId: string) => {
    const rows = await teamApi.fetchTeamMembers(teamId);
    setMembers(rows);
    return rows;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await teamApi.fetchTeamByName(name);
        if (cancelled) {
          return;
        }
        setTeam(data);
        await loadMembers(data.id);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Team not found');
          setTeam(null);
          setMembers([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadMembers, name]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Empty className="max-w-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users2 />
            </EmptyMedia>
            <EmptyTitle>Team unavailable</EmptyTitle>
            <EmptyDescription>{error ?? 'This team could not be loaded.'}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const handleDeleteTeam = async () => {
    if (!team || deletingTeam) {
      return;
    }

    setDeleteError(null);
    setDeletingTeam(true);
    try {
      await teamApi.deleteTeam(team.id);
      router.push('/lab');
      router.refresh();
    } catch (deleteTeamError) {
      setDeleteError(
        deleteTeamError instanceof Error ? deleteTeamError.message : 'Failed to delete team',
      );
    } finally {
      setDeletingTeam(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TeamHeader
        team={team}
        members={members}
        currentView="chart"
        onOpenConfig={() => setConfigOpen(true)}
        onDeleteTeam={handleDeleteTeam}
        deletingTeam={deletingTeam}
        deleteError={deleteError}
      />
      <TeamChartView team={team} members={members} />
      <ConfigTeamDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        team={team}
        onSaved={(updated) => {
          setTeam(updated);
          if (updated.name !== name) {
            router.replace(`/lab/teams/${encodeURIComponent(updated.name)}/chart`);
          }
        }}
      />
    </div>
  );
}
