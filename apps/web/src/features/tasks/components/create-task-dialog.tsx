'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createTask, fetchAgents, fetchTeams, fetchWorkspaces } from '@/lib/api';
import type { Task, TeamRecord, Workspace } from '@/lib/api';

interface CreateTaskDialogProps {
  boardId?: string | null;
  labId: string;
  defaultGroupName?: string;
  initialWorkspaceId?: string | null;
  lockWorkspace?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (task: Task) => void;
}

export function CreateTaskDialog({
  boardId,
  labId,
  defaultGroupName,
  initialWorkspaceId = null,
  lockWorkspace = false,
  open,
  onOpenChange,
  onCreated,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [mode, setMode] = useState<'scheduled' | 'auto'>('scheduled');
  const [targetType, setTargetType] = useState<'agent' | 'team'>('agent');
  const [workspaceId, setWorkspaceId] = useState<string>(initialWorkspaceId ?? 'none');
  const [agentId, setAgentId] = useState<string>('none');
  const [teamId, setTeamId] = useState<string>('none');
  const [intervalMinutes, setIntervalMinutes] = useState('30');
  const [creating, setCreating] = useState(false);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; icon: string | null }>>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void Promise.all([
      fetchAgents(),
      fetchTeams(),
      fetchWorkspaces({ labId }),
    ]).then(([agentRows, teamRows, workspaceRows]) => {
      if (cancelled) {
        return;
      }
      setAgents(agentRows.filter((agent) => agent.labId === labId));
      setTeams(teamRows.filter((team) => team.labId === labId));
      setWorkspaces(workspaceRows);
    }).catch(() => {
      if (cancelled) {
        return;
      }
      setAgents([]);
      setTeams([]);
      setWorkspaces([]);
    });

    return () => {
      cancelled = true;
    };
  }, [open, labId]);

  useEffect(() => {
    if (!open) return;
    setWorkspaceId(initialWorkspaceId ?? 'none');
  }, [initialWorkspaceId, open]);

  const canCreate = useMemo(() => {
    if (!title.trim()) {
      return false;
    }
    if (targetType === 'agent' && agentId === 'none') {
      return false;
    }
    if (targetType === 'team' && teamId === 'none') {
      return false;
    }
    if (mode === 'scheduled') {
      const parsed = Number(intervalMinutes);
      return Number.isFinite(parsed) && parsed > 0;
    }
    return true;
  }, [agentId, intervalMinutes, mode, targetType, teamId, title]);

  const handleCreate = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;

    setCreating(true);
    try {
      const task = await createTask({
        boardId: boardId ?? undefined,
        title: nextTitle,
        objective: objective.trim() || undefined,
        priority: 'medium',
        workspaceId: workspaceId === 'none' ? null : workspaceId,
        groupName: defaultGroupName ?? undefined,
        assigneeAgentId: targetType === 'agent' && agentId !== 'none' ? agentId : null,
        assigneeTeamId: targetType === 'team' && teamId !== 'none' ? teamId : null,
        mode,
        scheduleEnabled: mode === 'scheduled',
        scheduleType: mode === 'scheduled' ? 'interval' : 'manual',
        intervalSec:
          mode === 'scheduled' ? Math.max(1, Number(intervalMinutes) || 30) * 60 : null,
      });

      onCreated(task);
      setTitle('');
      setObjective('');
      setMode('scheduled');
      setTargetType('agent');
      setWorkspaceId(initialWorkspaceId ?? 'none');
      setAgentId('none');
      setTeamId('none');
      setIntervalMinutes('30');
    } finally {
      setCreating(false);
    }
  };

  const selectedWorkspaceName =
    workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'Current workspace';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Goal</Label>
            <Input
              id="task-title"
              autoFocus
              placeholder="Keep dependencies updated in this workspace"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-objective">Notes</Label>
            <Textarea
              id="task-objective"
              placeholder="Optional instructions for the assignee"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              className="min-h-24"
            />
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as 'scheduled' | 'auto')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'scheduled' ? (
            <div className="space-y-2">
              <Label htmlFor="task-interval">Repeat Every (minutes)</Label>
              <Input
                id="task-interval"
                inputMode="numeric"
                placeholder="30"
                value={intervalMinutes}
                onChange={(event) => setIntervalMinutes(event.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Workspace</Label>
            {lockWorkspace ? (
              <div className="flex h-10 items-center rounded-md border px-3 text-sm text-foreground">
                {selectedWorkspaceName}
              </div>
            ) : (
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No workspace</SelectItem>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={targetType} onValueChange={(value) => setTargetType(value as 'agent' | 'team')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{targetType === 'agent' ? 'Agent' : 'Team'}</Label>
              {targetType === 'agent' ? (
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => void handleCreate()} disabled={creating || !canCreate}>
            {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
