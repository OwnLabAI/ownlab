'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Loader2, ChevronDown, Users } from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { EntityIcon } from '@/components/entity-icon';
import { CreateAgentDialog } from './create-agent-dialog';
import { fetchAgents, fetchTeams } from '@/lib/api';
import { CreateTeamDialog } from '../teams/create-team-dialog';

type AgentItem = {
  id: string;
  name: string;
  adapterType: string;
  runtimeConfig?: Record<string, unknown>;
  icon: string | null;
  status: string;
};

type TeamItem = {
  id: string;
  name: string;
  icon: string | null;
  status: string;
  memberAgentIds?: string[];
};

export function NavAgents() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [open, setOpen] = useState(true);
  const [openTeams, setOpenTeams] = useState<Record<string, boolean>>({});
  const pathname = usePathname();
  const router = useRouter();

  const loadAgents = useCallback(async () => {
    try {
      const [agentsResult, teamsResult] = await Promise.allSettled([
        fetchAgents(),
        fetchTeams(),
      ]);

      if (agentsResult.status === 'fulfilled') {
        setAgents(agentsResult.value);
      } else {
        setAgents([]);
      }

      if (teamsResult.status === 'fulfilled') {
        setTeams(teamsResult.value);
      } else {
        setTeams([]);
      }
    } catch {
      // Server might not be running yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents, pathname]);

  const handleAgentCreated = useCallback(
    (agent: AgentItem) => {
      setAgents((prev) => [agent, ...prev]);
      setAgentDialogOpen(false);
      router.push(`/lab/agents/${agent.name}`);
    },
    [router],
  );

  const handleTeamCreated = useCallback(
    ({ team }: { team: TeamItem }) => {
      setTeams((prev) => [team, ...prev]);
      setTeamDialogOpen(false);
      router.push(`/lab/teams/${team.name}`);
    },
    [router],
  );

  const setTeamOpen = useCallback((teamId: string, nextOpen: boolean) => {
    setOpenTeams((prev) => ({
      ...prev,
      [teamId]: nextOpen,
    }));
  }, []);

  const memberTeamIdByAgentId = useCallback(
    (agentId: string) => teams.find((team) => team.memberAgentIds?.includes(agentId))?.id ?? null,
    [teams],
  );

  const standaloneAgents = agents.filter((agent) => memberTeamIdByAgentId(agent.id) === null);

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden pl-1">
          <SidebarGroupLabel className="flex items-center gap-1 text-sm font-medium text-sidebar-foreground/70 w-full px-1">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label={open ? 'Collapse Agents' : 'Expand Agents'}
              >
                <ChevronDown
                  className={`size-4 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>
            </CollapsibleTrigger>
            <span>Agents</span>
          </SidebarGroupLabel>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarGroupAction title="Add agent or team">
                <Plus className="size-4" />
              </SidebarGroupAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setAgentDialogOpen(true)}>
                  New Agent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTeamDialogOpen(true)}>
                  New Team
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <CollapsibleContent>
            <SidebarMenu>
              {loading && (
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-muted-foreground">Loading...</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {!loading && agents.length === 0 && teams.length === 0 && (
                <SidebarMenuItem>
                    <SidebarMenuButton
                    onClick={() => setAgentDialogOpen(true)}
                    className="text-muted-foreground"
                  >
                    <Plus className="size-4" />
                    <span>Create your first agent</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {teams.map((team) => {
                const isActive = pathname === `/lab/teams/${team.name}`;
                const teamAgents = agents.filter((agent) => team.memberAgentIds?.includes(agent.id));
                const teamOpen = openTeams[team.id] ?? true;
                return (
                  <Collapsible key={team.id} open={teamOpen} onOpenChange={(nextOpen) => setTeamOpen(team.id, nextOpen)}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={`/lab/teams/${team.name}`} title={team.name}>
                          <EntityIcon icon={team.icon} name={team.name} fallback="TM" className="size-6 rounded-md" fallbackClassName="rounded-md text-[10px]" />
                          <span className="flex-1 truncate font-medium">
                            {team.name}
                          </span>
                          <Users className="size-3.5 text-muted-foreground" />
                        </Link>
                      </SidebarMenuButton>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction
                          aria-label={teamOpen ? `Collapse ${team.name}` : `Expand ${team.name}`}
                        >
                          <ChevronDown
                            className={`size-3.5 transition-transform ${teamOpen ? 'rotate-0' : '-rotate-90'}`}
                          />
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {teamAgents.map((agent) => {
                            const isAgentActive = pathname === `/lab/agents/${agent.name}`;
                            return (
                              <SidebarMenuSubItem key={agent.id}>
                                <SidebarMenuSubButton asChild isActive={isAgentActive}>
                                  <Link href={`/lab/agents/${agent.name}`} title={agent.name}>
                                    <EntityIcon icon={agent.icon} name={agent.name} fallback="AI" className="size-5 rounded-md" fallbackClassName="rounded-md text-[9px]" />
                                    <span>{agent.name}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
              {standaloneAgents.map((agent) => {
                const isActive = pathname === `/lab/agents/${agent.name}`;
                return (
                  <SidebarMenuItem key={agent.id}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={`/lab/agents/${agent.name}`} title={agent.name}>
                        <EntityIcon icon={agent.icon} name={agent.name} fallback="AI" className="size-6 rounded-md" fallbackClassName="rounded-md text-[10px]" />
                        <span className="flex-1 truncate font-medium">
                          {agent.name}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

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
