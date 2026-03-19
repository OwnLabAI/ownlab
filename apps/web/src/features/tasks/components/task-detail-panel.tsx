'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Play, RefreshCw, Trash2, X } from 'lucide-react';
import { EntityIcon } from '@/components/entity-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  deleteTask,
  fetchAgents,
  fetchTaskDetail,
  fetchTeams,
  fetchWorkspaces,
  runTask,
  updateTask,
  type Task,
  type TaskDetail,
  type TaskRun,
  type TeamRecord,
  type Workspace,
} from '@/lib/api';

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onTasksChanged?: () => void;
}

type TaskPatch = Partial<{
  title: string;
  objective: string | null;
  workspaceId: string | null;
  assigneeAgentId: string | null;
  assigneeTeamId: string | null;
  mode: 'scheduled' | 'auto';
  scheduleEnabled: boolean;
  scheduleType: string;
  intervalSec: number | null;
}>;

function formatDateTime(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function getTaskStatusLabel(task: Task) {
  if (task.status === 'running') return 'Running';
  if (task.status === 'failed') return 'Failed';
  return 'Ready';
}

function getTaskMode(task: Task) {
  const value = task.metadata?.mode;
  return value === 'scheduled' ? 'scheduled' : 'auto';
}

function getTargetType(task: Task) {
  return task.metadata?.delegationTargetType === 'team' ? 'team' : 'agent';
}

function getTargetId(task: Task) {
  const value = task.metadata?.delegationTargetId;
  return typeof value === 'string' ? value : null;
}

function RunCard({ run }: { run: TaskRun }) {
  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer list-none text-sm font-medium">
        {run.summary ?? 'Run finished'}
      </summary>
      <div className="mt-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          {formatDateTime(run.startedAt)} • {run.status}
        </p>
        {run.error ? <div className="rounded-md border p-2 text-xs text-destructive">{run.error}</div> : null}
      </div>
    </details>
  );
}

export function TaskDetailPanel({
  taskId,
  onClose,
  onUpdated,
  onDeleted,
  onTasksChanged,
}: TaskDetailPanelProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string; icon: string | null }[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const task = detail?.task ?? null;

  const loadDetail = useCallback(async () => {
    const [taskDetail, agentData, teamData, workspaceData] = await Promise.all([
      fetchTaskDetail(taskId),
      fetchAgents(),
      fetchTeams(),
      fetchWorkspaces(),
    ]);
    setDetail(taskDetail);
    setAgents(agentData);
    setTeams(teamData.filter((team) => team.labId === taskDetail.task.labId));
    setWorkspaces(workspaceData.filter((workspace) => workspace.labId === taskDetail.task.labId));
    onUpdated(taskDetail.task);
  }, [taskId, onUpdated]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void loadDetail()
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadDetail]);

  useEffect(() => {
    if (!task || task.status !== 'running') return;

    const timer = window.setTimeout(() => {
      void loadDetail().catch(() => {});
      onTasksChanged?.();
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [task, loadDetail, onTasksChanged]);

  const handleUpdate = useCallback(
    async (patch: TaskPatch) => {
      if (!task) return;
      const updated = await updateTask(task.id, patch);
      setDetail((prev) => (prev ? { ...prev, task: updated } : prev));
      onUpdated(updated);
      onTasksChanged?.();
    },
    [task, onUpdated, onTasksChanged],
  );

  const handleRun = useCallback(async () => {
    if (!task) return;
    setRunning(true);
    try {
      await runTask(task.id);
      await loadDetail();
      onTasksChanged?.();
    } finally {
      setRunning(false);
    }
  }, [task, loadDetail, onTasksChanged]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    await deleteTask(task.id);
    onDeleted(task.id);
  }, [task, onDeleted]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail || !task) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Task not found</p>
      </div>
    );
  }

  const status = getTaskStatusLabel(task);
  const mode = getTaskMode(task);
  const targetType = getTargetType(task);
  const targetId = getTargetId(task);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="outline">{status}</Badge>
            </div>
            <Input
              value={task.title}
              onChange={(event) =>
                setDetail((prev) =>
                  prev ? { ...prev, task: { ...prev.task, title: event.target.value } } : prev,
                )
              }
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value && value !== task.title) {
                  void handleUpdate({ title: value });
                }
              }}
              className="h-9 border-0 px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadDetail()}>
              <RefreshCw className="mr-1 size-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => void handleRun()}
              disabled={running || task.status === 'running' || mode === 'auto'}
            >
              {running || task.status === 'running' ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Play className="mr-1 size-4" />
              )}
              Run
            </Button>
            <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => void handleDelete()}>
              <Trash2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select
              value={targetType}
              onValueChange={(value) => {
                if (value === 'team') {
                  void handleUpdate({
                    assigneeAgentId: null,
                    assigneeTeamId: teams[0]?.id ?? null,
                  });
                } else {
                  void handleUpdate({
                    assigneeTeamId: null,
                    assigneeAgentId: task.assigneeAgentId ?? agents[0]?.id ?? null,
                  });
                }
              }}
            >
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
            <label className="text-sm font-medium">{targetType === 'team' ? 'Team' : 'Agent'}</label>
            {targetType === 'team' ? (
              <Select
                value={targetId ?? 'none'}
                onValueChange={(value) =>
                  void handleUpdate({
                    assigneeTeamId: value === 'none' ? null : value,
                    assigneeAgentId: null,
                  })
                }
              >
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
            ) : (
              <Select
                value={task.assigneeAgentId ?? 'none'}
                onValueChange={(value) =>
                  void handleUpdate({
                    assigneeAgentId: value === 'none' ? null : value,
                    assigneeTeamId: null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <span className="flex items-center gap-2">
                        <EntityIcon
                          icon={agent.icon}
                          name={agent.name}
                          fallback="AI"
                          className="size-5 rounded-md"
                          fallbackClassName="rounded-md text-[9px]"
                        />
                        <span>{agent.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mode</label>
            <Select
              value={mode}
              onValueChange={(value) =>
                void handleUpdate({
                  mode: value as 'scheduled' | 'auto',
                  scheduleEnabled: value === 'scheduled',
                  scheduleType: value === 'scheduled' ? 'interval' : 'manual',
                  intervalSec: value === 'scheduled' ? (task.intervalSec ?? 1800) : null,
                })
              }
            >
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
              <label className="text-sm font-medium">Repeat Every (minutes)</label>
              <Input
                type="number"
                min="1"
                value={String(Math.max(1, Math.round((task.intervalSec ?? 1800) / 60)))}
                onChange={(event) =>
                  setDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          task: {
                            ...prev.task,
                            intervalSec: Math.max(1, Number(event.target.value) || 30) * 60,
                          },
                        }
                      : prev,
                  )
                }
                onBlur={(event) => {
                  const minutes = Math.max(1, Number(event.target.value) || 30);
                  if (minutes * 60 !== (task.intervalSec ?? 1800)) {
                    void handleUpdate({
                      intervalSec: minutes * 60,
                      scheduleEnabled: true,
                      scheduleType: 'interval',
                    });
                  }
                }}
              />
              <div className="text-xs text-muted-foreground">
                Next run: {formatDateTime(task.nextRunAt)}
              </div>
            </div>
          ) : null}

          {mode === 'auto' ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Auto mode is reserved for the next phase. Scheduled mode is the active execution path right now.
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace</label>
            <Select
              value={task.workspaceId ?? 'none'}
              onValueChange={(value) =>
                void handleUpdate({
                  workspaceId: value === 'none' ? null : value,
                })
              }
            >
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
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={task.objective ?? ''}
              onChange={(event) =>
                setDetail((prev) =>
                  prev ? { ...prev, task: { ...prev.task, objective: event.target.value } } : prev,
                )
              }
              onBlur={(event) => {
                if (event.target.value !== (task.objective ?? '')) {
                  void handleUpdate({ objective: event.target.value || null });
                }
              }}
              className="min-h-32"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Result</label>
            <div className="rounded-md border p-3 text-sm">
              {task.lastResultSummary?.trim() || 'No result yet.'}
            </div>
            <div className="text-xs text-muted-foreground">
              Last run: {formatDateTime(task.lastRunAt)}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Runs</label>
            {detail.runs.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No runs yet.
              </div>
            ) : (
              detail.runs.map((run) => <RunCard key={run.id} run={run} />)
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
