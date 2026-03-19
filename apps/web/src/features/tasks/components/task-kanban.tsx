'use client';

import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskCard } from './task-card';
import type { Task } from '@/lib/api';

interface TaskKanbanProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onAddTask: (groupName?: string) => void;
}

const UNGROUPED = 'ungrouped';
const STATUS_GROUPS = ['Ready', 'Running', 'Failed'] as const;

function getTaskColumn(task: Task): string {
  if (task.status === 'running') return 'Running';
  if (task.status === 'failed') return 'Failed';
  const hasGroup = Boolean(task.groupName?.trim());
  return hasGroup ? 'Ready' : UNGROUPED;
}

export function TaskKanban({
  tasks,
  selectedTaskId,
  onSelectTask,
  onAddTask,
}: TaskKanbanProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>([
      [UNGROUPED, []],
      ['Ready', []],
      ['Running', []],
      ['Failed', []],
    ]);

    for (const task of tasks) {
      const group = getTaskColumn(task);
      const list = map.get(group) ?? [];
      list.push(task);
      map.set(group, list);
    }

    return map;
  }, [tasks]);

  const columnOrder = [UNGROUPED, ...STATUS_GROUPS];

  return (
    <ScrollArea className="h-full">
      <div className="flex gap-4 p-4">
        {columnOrder.map((groupName) => {
          const groupTasks = groups.get(groupName) ?? [];
          return (
            <div key={groupName} className="flex w-64 shrink-0 flex-col rounded-lg">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {groupName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {groupTasks.length}
                  </span>
                </h3>
              </div>

              <div className="flex flex-col gap-2">
                {groupTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isActive={task.id === selectedTaskId}
                    onClick={() => onSelectTask(task.id)}
                  />
                ))}
              </div>

              {groupName === UNGROUPED && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full justify-start text-muted-foreground"
                  onClick={() => onAddTask()}
                >
                  <Plus className="mr-1 size-4" />
                  New Task
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
