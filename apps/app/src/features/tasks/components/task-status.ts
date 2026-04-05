'use client';

import type { Task } from '@/lib/api';

export const TASK_COLUMNS = ['Undo', 'Ready', 'Running', 'Failed'] as const;

export function getTaskStatusLabel(task: Task) {
  if (task.status === 'running') return 'Running';
  if (task.status === 'failed') return 'Failed';
  if (task.status === 'ready') return 'Ready';
  return 'Undo';
}
