'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, Clock3, ListTodo, Plus } from 'lucide-react';
import { CreateTaskDialog } from '@/features/tasks';
import { Button } from '@/components/ui/button';
import { fetchAgents, fetchWorkspaceTasks, type Task, type Workspace } from '@/lib/api';
import { cn } from '@/lib/utils';

const WORKSPACE_TASKS_CHANGED_EVENT = 'workspace-tasks-changed';

function formatRelativeDate(value: string | null) {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Never';
  return parsed.toLocaleString();
}

function getStatusIcon(status: string) {
  if (status === 'done' || status === 'completed') {
    return CheckCircle2;
  }
  if (status === 'running' || status === 'ready') {
    return Clock3;
  }
  return CircleDashed;
}

export function dispatchWorkspaceTasksChanged(workspaceId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_TASKS_CHANGED_EVENT, { detail: { workspaceId } }));
}

export function ToolPanelTasks({
  workspace,
  selectedTaskId,
  onTaskSelect,
}: {
  workspace: Workspace;
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string | null) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [taskRows, agents] = await Promise.all([
        fetchWorkspaceTasks(workspace.id),
        fetchAgents(),
      ]);
      setTasks(taskRows);
      setAgentNames(
        Object.fromEntries(
          agents
            .filter((agent) => agent.labId === workspace.labId)
            .map((agent) => [agent.id, agent.name]),
        ),
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load workspace tasks');
    } finally {
      setIsLoading(false);
    }
  }, [workspace.id, workspace.labId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    function handleTasksChanged(event: Event) {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail;
      if (!detail?.workspaceId || detail.workspaceId !== workspace.id) {
        return;
      }
      void loadTasks();
    }

    window.addEventListener(WORKSPACE_TASKS_CHANGED_EVENT, handleTasksChanged);
    return () => {
      window.removeEventListener(WORKSPACE_TASKS_CHANGED_EVENT, handleTasksChanged);
    };
  }, [loadTasks, workspace.id]);

  const selectedTaskExists = useMemo(
    () => (selectedTaskId ? tasks.some((task) => task.id === selectedTaskId) : false),
    [selectedTaskId, tasks],
  );

  useEffect(() => {
    if (!selectedTaskId || selectedTaskExists) return;
    onTaskSelect(null);
  }, [onTaskSelect, selectedTaskExists, selectedTaskId]);

  function getAssigneeLabel(task: Task) {
    const targetType = task.metadata?.delegationTargetType;
    const targetLabel = task.metadata?.delegationTargetLabel;
    if (targetType === 'team' && typeof targetLabel === 'string' && targetLabel.trim()) {
      return targetLabel;
    }
    if (task.assigneeAgentId && agentNames[task.assigneeAgentId]) {
      return agentNames[task.assigneeAgentId];
    }
    return 'Unassigned';
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading tasks…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadTasks()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Tasks</h3>
            <p className="text-xs text-muted-foreground">
              Commitments and execution for this workspace.
            </p>
          </div>
          <Button type="button" size="sm" className="rounded-full" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-1 size-4" />
            New
          </Button>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-2xl border border-border/50 bg-card/80 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
              <ListTodo className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No tasks yet</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
              This workspace does not have any commitments yet. Create the first task to start tracking work here.
            </p>
            <Button type="button" className="mt-5 rounded-full" onClick={() => setCreateDialogOpen(true)}>
              Create Task
            </Button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3">
            <div className="space-y-2">
              {tasks.map((task) => {
                const StatusIcon = getStatusIcon(task.status);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskSelect(task.id)}
                    className={cn(
                      'w-full rounded-2xl border px-3 py-3 text-left transition-colors',
                      selectedTaskId === task.id
                        ? 'border-foreground/10 bg-background shadow-sm'
                        : 'border-transparent bg-card/70 hover:border-border hover:bg-accent/45',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StatusIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{task.status}</span>
                          <span>{getAssigneeLabel(task)}</span>
                          <span>Updated {formatRelativeDate(task.updatedAt)}</span>
                          <span>Last run {formatRelativeDate(task.lastRunAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <CreateTaskDialog
        labId={workspace.labId}
        initialWorkspaceId={workspace.id}
        lockWorkspace
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(task) => {
          setTasks((prev) => [task, ...prev]);
          setCreateDialogOpen(false);
          onTaskSelect(task.id);
          dispatchWorkspaceTasksChanged(workspace.id);
        }}
      />
    </>
  );
}
