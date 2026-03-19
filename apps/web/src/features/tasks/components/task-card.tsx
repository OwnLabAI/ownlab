'use client';

import { Circle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/api';

interface TaskCardProps {
  task: Task;
  isActive: boolean;
  onClick: () => void;
}

function getTaskStatusLabel(task: Task) {
  if (task.status === 'running') return 'Running';
  if (task.status === 'failed') return 'Failed';
  if (task.lastRunAt) return 'Ready';
  return 'Ready';
}

function getTaskSummary(task: Task) {
  return task.lastResultSummary?.trim() || task.objective?.trim() || 'No details yet.';
}

function getModeLabel(task: Task) {
  return task.metadata?.mode === 'scheduled' ? 'Scheduled' : 'Auto';
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  Running: <LoaderCircle className="size-4 animate-spin text-blue-500" />,
  Failed: <Circle className="size-4 fill-orange-500/20 text-orange-500" />,
  Ready: <CheckCircle2 className="size-4 text-muted-foreground" />,
};

export function TaskCard({ task, isActive, onClick }: TaskCardProps) {
  const status = getTaskStatusLabel(task);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:border-primary/40',
        isActive && 'border-primary ring-1 ring-primary/30',
      )}
      onClick={onClick}
    >
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start gap-2">
          {STATUS_ICON[status] ?? <Circle className="size-4 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-5">{task.title}</p>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="outline" className="text-[10px]">
                  {getModeLabel(task)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {status}
                </Badge>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {getTaskSummary(task)}
            </p>
            {task.metadata?.mode === 'scheduled' && task.intervalSec ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Every {Math.max(1, Math.round(task.intervalSec / 60))} min
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
