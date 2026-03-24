'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type WorkspaceToolTab = 'file' | 'goal' | 'members' | 'tasks';

type WorkspaceViewState = {
  selectedFilePath: string | null;
  selectedTaskId: string | null;
  selectedChannelId: string | null;
  channelOpen: boolean;
  activeToolTab: WorkspaceToolTab;
  membersVersion: number;
  channelsVersion: number;
};

type WorkspaceViewStore = {
  views: Record<string, WorkspaceViewState>;
  ensureWorkspaceView: (workspaceId: string) => WorkspaceViewState;
  setSelectedFilePath: (workspaceId: string, path: string | null) => void;
  setSelectedTaskId: (workspaceId: string, taskId: string | null) => void;
  setSelectedChannelId: (workspaceId: string, channelId: string | null) => void;
  setChannelOpen: (workspaceId: string, open: boolean) => void;
  setActiveToolTab: (workspaceId: string, tab: WorkspaceToolTab) => void;
  bumpMembersVersion: (workspaceId: string) => void;
  bumpChannelsVersion: (workspaceId: string) => void;
  resetWorkspaceView: (workspaceId: string) => void;
};

const DEFAULT_WORKSPACE_VIEW: WorkspaceViewState = {
  selectedFilePath: null,
  selectedTaskId: null,
  selectedChannelId: null,
  channelOpen: false,
  activeToolTab: 'file',
  membersVersion: 0,
  channelsVersion: 0,
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
              selectedTaskId: path ? null : (state.views[workspaceId]?.selectedTaskId ?? null),
            },
          },
        }));
      },
      setSelectedTaskId: (workspaceId, taskId) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: {
              ...(state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW),
              selectedTaskId: taskId,
              selectedFilePath: taskId ? null : (state.views[workspaceId]?.selectedFilePath ?? null),
            },
          },
        }));
      },
      setSelectedChannelId: (workspaceId, channelId) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: {
              ...(state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW),
              selectedChannelId: channelId,
            },
          },
        }));
      },
      setChannelOpen: (workspaceId, open) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: {
              ...(state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW),
              channelOpen: open,
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
      bumpMembersVersion: (workspaceId) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: {
              ...(state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW),
              membersVersion: (state.views[workspaceId]?.membersVersion ?? 0) + 1,
            },
          },
        }));
      },
      bumpChannelsVersion: (workspaceId) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: {
              ...(state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW),
              channelsVersion: (state.views[workspaceId]?.channelsVersion ?? 0) + 1,
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
  setSelectedTaskId: (taskId: string | null) => void;
  setSelectedChannelId: (channelId: string | null) => void;
  setChannelOpen: (open: boolean) => void;
  setActiveToolTab: (tab: WorkspaceToolTab) => void;
  bumpMembersVersion: () => void;
  bumpChannelsVersion: () => void;
  resetWorkspaceView: () => void;
} {
  const view = useWorkspaceViewStore((state) => state.views[workspaceId] ?? DEFAULT_WORKSPACE_VIEW);
  const setSelectedFilePath = useWorkspaceViewStore((state) => state.setSelectedFilePath);
  const setSelectedTaskId = useWorkspaceViewStore((state) => state.setSelectedTaskId);
  const setSelectedChannelId = useWorkspaceViewStore((state) => state.setSelectedChannelId);
  const setChannelOpen = useWorkspaceViewStore((state) => state.setChannelOpen);
  const setActiveToolTab = useWorkspaceViewStore((state) => state.setActiveToolTab);
  const bumpMembersVersion = useWorkspaceViewStore((state) => state.bumpMembersVersion);
  const bumpChannelsVersion = useWorkspaceViewStore((state) => state.bumpChannelsVersion);
  const resetWorkspaceView = useWorkspaceViewStore((state) => state.resetWorkspaceView);

  return {
    ...view,
    setSelectedFilePath: (path) => setSelectedFilePath(workspaceId, path),
    setSelectedTaskId: (taskId) => setSelectedTaskId(workspaceId, taskId),
    setSelectedChannelId: (channelId) => setSelectedChannelId(workspaceId, channelId),
    setChannelOpen: (open) => setChannelOpen(workspaceId, open),
    setActiveToolTab: (tab) => setActiveToolTab(workspaceId, tab),
    bumpMembersVersion: () => bumpMembersVersion(workspaceId),
    bumpChannelsVersion: () => bumpChannelsVersion(workspaceId),
    resetWorkspaceView: () => resetWorkspaceView(workspaceId),
  };
}
