'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { CreateAgentDialog } from '@/features/lab/components/agents/create-agent-dialog';
import { CreateTeamDialog } from '@/features/lab/components/teams/create-team-dialog';
import { CreateWorkspaceDialog } from '@/features/lab/components/workspaces/create-workspace-dialog';

type AgentRecord = {
  id: string;
  name: string;
  adapterType: string;
  icon: string | null;
  status: string;
};

type TeamRecord = {
  id: string;
  name: string;
};

export default function LabPage() {
  const router = useRouter();
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);

  const handleWorkspaceCreated = useCallback(
    (workspaceId: string) => {
      setWorkspaceDialogOpen(false);
      router.push(`/lab/workspace/${workspaceId}`);
    },
    [router],
  );

  const handleAgentCreated = useCallback(
    (agent: AgentRecord) => {
      setAgentDialogOpen(false);
      router.push(`/lab/agents/${agent.name}`);
    },
    [router],
  );

  const handleTeamCreated = useCallback(
    ({ team }: { team: TeamRecord }) => {
      setTeamDialogOpen(false);
      router.push(`/lab/teams/${team.name}`);
    },
    [router],
  );

  return (
    <>
      <main className="flex min-h-[calc(100vh-3.5rem)] flex-1 items-center justify-center px-4">
        <div className="flex max-w-xl flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <img
              src="/logo-name.svg"
              alt="OwnLab Logo"
              className="h-10 w-auto"
            />
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Build your own lab with AI agents.
            </h1>
            <p className="max-w-md text-sm text-muted-foreground sm:text-base">
              Start by creating a workspace or configuring an agent for your lab.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" size="lg" onClick={() => setWorkspaceDialogOpen(true)}>
              New Workspace
            </Button>
            <Button size="lg" onClick={() => setAgentDialogOpen(true)}>
              New Agent
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setTeamDialogOpen(true)}>
              New Team
            </Button>
          </div>
        </div>
      </main>

      <CreateWorkspaceDialog
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
        onCreated={handleWorkspaceCreated}
      />

      <CreateAgentDialog
        open={agentDialogOpen}
        onOpenChange={setAgentDialogOpen}
        onCreated={handleAgentCreated}
      />

      <CreateTeamDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
        onCreated={handleTeamCreated}
      />
    </>
  );
}
