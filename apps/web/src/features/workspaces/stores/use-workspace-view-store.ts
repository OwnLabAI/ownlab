'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type WorkspaceToolTab = 'file' | 'members';

type WorkspaceViewState = {
  selectedFilePath: string | null;
  viewboardOpen: boolean;
  activeToolTab: WorkspaceToolTab;
};

type WorkspaceViewStore = {
  views: Record<string, WorkspaceViewState>;
  ensureWorkspaceView: (workspaceId: string) => WorkspaceViewState;
  setSelectedFilePath: (workspaceId: string, path: string | null) => void;
  setViewboardOpen: (workspaceId: string, open: boolean) => void;
  setActiveToolTab: (workspaceId: string, tab: WorkspaceToolTab) => void;
  resetWorkspaceView: (workspaceId: string) => void;
};

const DEFAULT_WORKSPACE_VIEW: WorkspaceViewState = {
  selectedFilePath: null,
  viewboardOpen: false,
  activeToolTab: 'file',
};

export const useWorkspaceViewStore = create<WorkspaceViewStore>()(
  persist(
    (set, get) => ({
      views: {},
      ensureWorkspaceView: (workspaceId) => {
        return get().views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW;
      },
      setSelectedFilePath: (workspaceId, path) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: {
              ...(state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW),
              selectedFilePath: path,
              viewboardOpen: path ? true : (state.views[workspaceId]?.viewboardOpen ?? false),
            },
          },
        }));
      },
      setViewboardOpen: (workspaceId, open) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: {
              ...(state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW),
              viewboardOpen: open,
            },
          },
        }));
      },
      setActiveToolTab: (workspaceId, tab) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: {
              ...(state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW),
              activeToolTab: tab,
            },
          },
        }));
      },
      resetWorkspaceView: (workspaceId) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: DEFAULT_WORKSPACE_VIEW,
          },
        }));
      },
    }),
    {
      name: 'ownlab-workspace-view',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ views: state.views }),
    },
  ),
);

export function useWorkspaceView(workspaceId: string): WorkspaceViewState & {
  setSelectedFilePath: (path: string | null) => void;
  setViewboardOpen: (open: boolean) => void;
  setActiveToolTab: (tab: WorkspaceToolTab) => void;
  resetWorkspaceView: () => void;
} {
  const view = useWorkspaceViewStore((state) => state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW);
  const setSelectedFilePath = useWorkspaceViewStore((state) => state.setSelectedFilePath);
  const setViewboardOpen = useWorkspaceViewStore((state) => state.setViewboardOpen);
  const setActiveToolTab = useWorkspaceViewStore((state) => state.setActiveToolTab);
  const resetWorkspaceView = useWorkspaceViewStore((state) => state.resetWorkspaceView);

  return {
    ...view,
    setSelectedFilePath: (path) => setSelectedFilePath(workspaceId, path),
    setViewboardOpen: (open) => setViewboardOpen(workspaceId, open),
    setActiveToolTab: (tab) => setActiveToolTab(workspaceId, tab),
    resetWorkspaceView: () => resetWorkspaceView(workspaceId),
  };
}
