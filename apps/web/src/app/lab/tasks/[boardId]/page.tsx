import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { TaskBoardContent } from '@/features/tasks';

type Props = {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ task_id?: string }>;
};

export default async function TaskBoardPage({ params, searchParams }: Props) {
  const { boardId } = await params;
  const { task_id } = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TaskBoardContent boardId={boardId} initialTaskId={task_id ?? null} />
    </Suspense>
  );
}
