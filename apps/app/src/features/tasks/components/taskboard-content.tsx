'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  fetchTaskBoard,
  fetchTasksByBoard,
  updateTaskBoard,
  deleteTaskBoard,
} from '@/lib/api';
import type { TaskBoard, Task } from '@/lib/api';
import { TaskBoardHeader } from './taskboard-header';
import { TaskKanban } from './task-kanban';
import { TaskDetailPanel } from './task-detail-panel';
import { CreateTaskDialog } from './create-task-dialog';
import { useTaskBoardView } from '../stores/use-taskboard-view-store';

interface TaskBoardContentProps {
  boardId: string;
  initialTaskId: string | null;
}

export function TaskBoardContent({
  boardId,
  initialTaskId,
}: TaskBoardContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [board, setBoard] = useState<TaskBoard | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingBoard, setDeletingBoard] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const {
    selectedTaskId,
    createDialogOpen,
    defaultGroupName,
    setSelectedTaskId,
    setCreateDialogOpen,
    setDefaultGroupName,
  } = useTaskBoardView(boardId);

  useEffect(() => {
    if (initialTaskId !== null) {
      setSelectedTaskId(initialTaskId);
    }
  }, [initialTaskId, setSelectedTaskId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [boardData, tasksData] = await Promise.all([
          fetchTaskBoard(boardId),
          fetchTasksByBoard(boardId),
        ]);
        if (cancelled) return;
        setBoard(boardData);
        setTasks(tasksData);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const reloadTasks = useCallback(async () => {
    try {
      const data = await fetchTasksByBoard(boardId);
      setTasks(data);
    } catch {
      // ignore
    }
  }, [boardId]);

  const handleSelectTask = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId);
      const params = new URLSearchParams(searchParams.toString());
      params.set('task_id', taskId);
      router.replace(`/lab/tasks/${boardId}?${params.toString()}`, {
        scroll: false,
      });
    },
    [boardId, router, searchParams],
  );

  const handleCloseTask = useCallback(() => {
    setSelectedTaskId(null);
    router.replace(`/lab/tasks/${boardId}`, { scroll: false });
  }, [boardId, router]);

  const handleAddTask = useCallback((groupName?: string) => {
    setDefaultGroupName(groupName);
    setCreateDialogOpen(true);
  }, [setCreateDialogOpen, setDefaultGroupName]);

  const handleTaskCreated = useCallback(
    (task: Task) => {
      setTasks((prev) => [task, ...prev]);
      setCreateDialogOpen(false);
      handleSelectTask(task.id);
    },
    [handleSelectTask],
  );

  const handleTaskUpdated = useCallback((updated: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t)),
    );
  }, []);

  const handleTaskDeleted = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (selectedTaskId === taskId) {
        handleCloseTask();
      }
    },
    [selectedTaskId, handleCloseTask],
  );

  const handleUpdateBoard = useCallback(
    async (name: string) => {
      if (!board) return;
      try {
        const updated = await updateTaskBoard(board.id, { name });
        setBoard(updated);
      } catch {
        // ignore
      }
    },
    [board],
  );

  const handleDeleteBoard = useCallback(async () => {
    if (!board) return;
    setDeleteError(null);
    setDeletingBoard(true);
    try {
      await deleteTaskBoard(board.id);
      window.dispatchEvent(new CustomEvent('taskboard-deleted'));
      router.push('/lab');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete taskboard');
    } finally {
      setDeletingBoard(false);
    }
  }, [board, router]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Task board not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TaskBoardHeader
        board={board}
        onAddTask={() => handleAddTask()}
        onUpdateBoard={handleUpdateBoard}
        onDeleteBoard={handleDeleteBoard}
        deletingBoard={deletingBoard}
        deleteError={deleteError}
      />

      {selectedTaskId ? (
        <ResizablePanelGroup
          id="taskboard-panels"
          direction="horizontal"
          className="flex-1"
        >
          <ResizablePanel
            id="taskboard-panels-kanban"
            order={1}
            defaultSize={60}
            minSize={35}
          >
            <TaskKanban
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={handleSelectTask}
              onAddTask={handleAddTask}
            />
          </ResizablePanel>
          <ResizableHandle
            id="taskboard-panels-handle-detail"
            className="w-px bg-border hover:bg-primary/50 transition-colors"
          />
          <ResizablePanel
            id="taskboard-panels-detail"
            order={2}
            defaultSize={40}
            minSize={25}
            maxSize={55}
          >
            <TaskDetailPanel
              taskId={selectedTaskId}
              onClose={handleCloseTask}
              onUpdated={handleTaskUpdated}
              onDeleted={handleTaskDeleted}
              onTasksChanged={reloadTasks}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <TaskKanban
          tasks={tasks}
          selectedTaskId={null}
          onSelectTask={handleSelectTask}
          onAddTask={handleAddTask}
        />
      )}

      <CreateTaskDialog
        boardId={boardId}
        labId={board.labId}
        defaultGroupName={defaultGroupName}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleTaskCreated}
      />
    </div>
  );
}
