'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, UserPlus, UserMinus } from 'lucide-react';
import { EntityIcon } from '@/components/entity-icon';
import { Button } from '@/components/ui/button';
import {
  fetchWorkspaceMembers,
  fetchAvailableWorkspaceAgents,
  addWorkspaceMember,
  removeWorkspaceMember,
  type ChannelMember,
  type WorkspaceAgent,
} from '@/lib/api';

export function ToolPanelMembers({
  onMemberCountChange,
}: {
  onMemberCountChange?: (count: number) => void;
}) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [agents, setAgents] = useState<WorkspaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [membersRes, agentsRes] = await Promise.all([
        fetchWorkspaceMembers(workspaceId),
        fetchAvailableWorkspaceAgents(workspaceId),
      ]);
      setMembers(membersRes);
      setAgents(agentsRes);
      onMemberCountChange?.(membersRes.length);
    } catch (err) {
      console.error('Failed to load members:', err);
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId, onMemberCountChange]);

  const memberAgentIds = new Set(
    members
      .filter((member) => member.actorType === 'agent')
      .map((member) => member.actorId),
  );
  const agentMembers = members.filter((member) => member.actorType === 'agent');
  const notInChannel = agents.filter((a) => !memberAgentIds.has(a.id));
  const humanMembers = members.filter((member) => member.actorType === 'human');

  const handleAdd = async (agentId: string) => {
    try {
      await addWorkspaceMember(workspaceId, { actorId: agentId, actorType: 'agent' });
      await loadData();
    } catch (err) {
      console.error('Failed to add member:', err);
    }
  };

  const handleRemove = async (agentId: string) => {
    try {
      await removeWorkspaceMember(workspaceId, agentId);
      await loadData();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-4 overflow-auto p-3">
        {humanMembers.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Humans
            </h3>
            <ul className="space-y-1">
              {humanMembers.map((member) => (
                <li
                  key={member.actorId}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2 truncate text-sm">
                    <span>{member.icon ?? '🙂'}</span>
                    <span>{member.name ?? member.actorId}</span>
                    {member.role ? (
                      <span className="text-xs text-muted-foreground">
                        {member.role}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {agentMembers.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Agents in workspace
            </h3>
            <ul className="space-y-1">
              {agentMembers.map((agent) => (
                <li
                  key={agent.actorId}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2 truncate text-sm">
                    <EntityIcon icon={agent.icon} name={agent.name ?? agent.actorId} fallback="AI" className="size-6 rounded-md" fallbackClassName="rounded-md text-[10px]" />
                    <span>{agent.name ?? agent.actorId}</span>
                    {agent.status && (
                      <span className="text-xs text-muted-foreground">
                        {agent.status}
                      </span>
                    )}
                  </span>
                  {agent.source !== 'team' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleRemove(agent.actorId)}
                      title="Remove from workspace"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {notInChannel.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Add standalone agents
            </h3>
            <ul className="space-y-1">
              {notInChannel.map((agent) => (
                <li
                  key={agent.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2 truncate text-sm">
                    <EntityIcon icon={agent.icon} name={agent.name} fallback="AI" className="size-6 rounded-md" fallbackClassName="rounded-md text-[10px]" />
                    <span>{agent.name}</span>
                    {agent.status && (
                      <span className="text-xs text-muted-foreground">
                        {agent.status}
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleAdd(agent.id)}
                    title="Add to channel"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
