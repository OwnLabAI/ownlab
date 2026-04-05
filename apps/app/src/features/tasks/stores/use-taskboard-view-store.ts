'use client';

import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type TaskBoardViewState = {
  selectedTaskId: string | null;
  createDialogOpen: boolean;
  defaultGroupName?: string;
};

type TaskBoardViewStore = {
  views: Record<string, TaskBoardViewState>;
  setSelectedTaskId: (boardId: string, taskId: string | null) => void;
  setCreateDialogOpen: (boardId: string, open: boolean) => void;
  setDefaultGroupName: (boardId: string, groupName?: string) => void;
};

const DEFAULT_TASK_BOARD_VIEW: TaskBoardViewState = {
  selectedTaskId: null,
  createDialogOpen: false,
  defaultGroupName: undefined,
};

export const useTaskBoardViewStore = create<TaskBoardViewStore>()(
  persist(
    (set) => ({
      views: {},
      setSelectedTaskId: (boardId, taskId) => {
        if (!boardId) return;
        set((state) => {
          const currentView = state.views[boardId] ?? DEFAULT_TASK_BOARD_VIEW;
          if (currentView.selectedTaskId === taskId) return state;
          return {
            views: {
              ...state.views,
              [boardId]: {
                ...currentView,
                selectedTaskId: taskId,
              },
            },
          };
        });
      },
      setCreateDialogOpen: (boardId, open) => {
        if (!boardId) return;
        set((state) => ({
          views: {
            ...state.views,
            [boardId]: {
              ...(state.views[boardId] ?? DEFAULT_TASK_BOARD_VIEW),
              createDialogOpen: open,
            },
          },
        }));
      },
      setDefaultGroupName: (boardId, groupName) => {
        if (!boardId) return;
        set((state) => ({
          views: {
            ...state.views,
            [boardId]: {
              ...(state.views[boardId] ?? DEFAULT_TASK_BOARD_VIEW),
              defaultGroupName: groupName,
            },
          },
        }));
      },
    }),
    {
      name: 'ownlab-taskboard-view',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ views: state.views }),
    },
  ),
);

export function useTaskBoardView(boardId: string): TaskBoardViewState & {
  setSelectedTaskId: (taskId: string | null) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setDefaultGroupName: (groupName?: string) => void;
} {
  const view = useTaskBoardViewStore((state) => state.views[boardId] ?? DEFAULT_TASK_BOARD_VIEW);
  const setSelectedTaskId = useTaskBoardViewStore((state) => state.setSelectedTaskId);
  const setCreateDialogOpen = useTaskBoardViewStore((state) => state.setCreateDialogOpen);
  const setDefaultGroupName = useTaskBoardViewStore((state) => state.setDefaultGroupName);

  const handleSetSelectedTaskId = useCallback(
    (taskId: string | null) => setSelectedTaskId(boardId, taskId),
    [boardId, setSelectedTaskId],
  );
  const handleSetCreateDialogOpen = useCallback(
    (open: boolean) => setCreateDialogOpen(boardId, open),
    [boardId, setCreateDialogOpen],
  );
  const handleSetDefaultGroupName = useCallback(
    (groupName?: string) => setDefaultGroupName(boardId, groupName),
    [boardId, setDefaultGroupName],
  );

  return useMemo(
    () => ({
      ...view,
      setSelectedTaskId: handleSetSelectedTaskId,
      setCreateDialogOpen: handleSetCreateDialogOpen,
      setDefaultGroupName: handleSetDefaultGroupName,
    }),
    [handleSetCreateDialogOpen, handleSetDefaultGroupName, handleSetSelectedTaskId, view],
  );
}
