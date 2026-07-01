'use client';

import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeWorkspaceSelectionPath } from '../path-utils';

type WorkspaceToolTab = 'file' | 'sources' | 'goal' | 'members' | 'tasks';

type WorkspaceViewState = {
  selectedFilePath: string | null;
  openFilePaths: string[];
  selectedSourceId: string | null;
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
  closeFileTab: (workspaceId: string, path: string) => void;
  setSelectedSourceId: (workspaceId: string, sourceId: string | null) => void;
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
  openFilePaths: [],
  selectedSourceId: null,
  selectedTaskId: null,
  selectedChannelId: null,
  channelOpen: false,
  activeToolTab: 'file',
  membersVersion: 0,
  channelsVersion: 0,
};

function getWorkspaceViewState(view?: Partial<WorkspaceViewState> | null): WorkspaceViewState {
  return {
    ...DEFAULT_WORKSPACE_VIEW,
    ...view,
    openFilePaths: Array.isArray(view?.openFilePaths) ? view.openFilePaths : [],
  };
}

export const useWorkspaceViewStore = create<WorkspaceViewStore>()(
  persist(
    (set, get) => ({
      views: {},
      ensureWorkspaceView: (workspaceId) => {
        return getWorkspaceViewState(get().views[workspaceId]);
      },
      setSelectedFilePath: (workspaceId, path) => {
        if (!workspaceId) return;
        const normalizedPath = normalizeWorkspaceSelectionPath(path);
        set((state) => {
          const current = getWorkspaceViewState(state.views[workspaceId]);
          const nextOpenFilePaths = normalizedPath
            ? current.openFilePaths.includes(normalizedPath)
              ? current.openFilePaths
              : [...current.openFilePaths, normalizedPath]
            : current.openFilePaths;
          const next: WorkspaceViewState = {
            ...current,
            selectedFilePath: normalizedPath,
            openFilePaths: nextOpenFilePaths,
            selectedSourceId: normalizedPath ? null : current.selectedSourceId,
            selectedTaskId: normalizedPath ? null : current.selectedTaskId,
          };
          if (
            current.selectedFilePath === next.selectedFilePath &&
            current.openFilePaths === next.openFilePaths &&
            current.selectedSourceId === next.selectedSourceId &&
            current.selectedTaskId === next.selectedTaskId
          ) {
            return state;
          }
          return {
            views: {
              ...state.views,
              [workspaceId]: next,
            },
          };
        });
      },
      closeFileTab: (workspaceId, path) => {
        if (!workspaceId) return;
        const normalizedPath = normalizeWorkspaceSelectionPath(path);
        if (!normalizedPath) return;
        set((state) => {
          const current = getWorkspaceViewState(state.views[workspaceId]);
          const closingIndex = current.openFilePaths.indexOf(normalizedPath);
          if (closingIndex === -1) return state;

          const nextOpenFilePaths = current.openFilePaths.filter((entry) => entry !== normalizedPath);
          let nextSelectedFilePath = current.selectedFilePath;
          if (current.selectedFilePath === normalizedPath) {
            nextSelectedFilePath =
              nextOpenFilePaths[Math.min(closingIndex, nextOpenFilePaths.length - 1)] ?? null;
          }

          return {
            views: {
              ...state.views,
              [workspaceId]: {
                ...current,
                openFilePaths: nextOpenFilePaths,
                selectedFilePath: nextSelectedFilePath,
              },
            },
          };
        });
      },
      setSelectedSourceId: (workspaceId, sourceId) => {
        if (!workspaceId) return;
        set((state) => {
          const current = getWorkspaceViewState(state.views[workspaceId]);
          const next: WorkspaceViewState = {
            ...current,
            selectedSourceId: sourceId,
            selectedFilePath: sourceId ? null : current.selectedFilePath,
            selectedTaskId: sourceId ? null : current.selectedTaskId,
          };
          if (
            current.selectedSourceId === next.selectedSourceId &&
            current.selectedFilePath === next.selectedFilePath &&
            current.selectedTaskId === next.selectedTaskId
          ) {
            return state;
          }
          return {
            views: {
              ...state.views,
              [workspaceId]: next,
            },
          };
        });
      },
      setSelectedTaskId: (workspaceId, taskId) => {
        if (!workspaceId) return;
        set((state) => {
          const current = getWorkspaceViewState(state.views[workspaceId]);
          const next: WorkspaceViewState = {
            ...current,
            selectedTaskId: taskId,
            selectedFilePath: taskId ? null : current.selectedFilePath,
            selectedSourceId: taskId ? null : current.selectedSourceId,
          };
          if (
            current.selectedTaskId === next.selectedTaskId &&
            current.selectedFilePath === next.selectedFilePath &&
            current.selectedSourceId === next.selectedSourceId
          ) {
            return state;
          }
          return {
            views: {
              ...state.views,
              [workspaceId]: next,
            },
          };
        });
      },
      setSelectedChannelId: (workspaceId, channelId) => {
        if (!workspaceId) return;
        set((state) => {
          const current = getWorkspaceViewState(state.views[workspaceId]);
          if (current.selectedChannelId === channelId) return state;
          return {
            views: {
              ...state.views,
              [workspaceId]: {
                ...current,
                selectedChannelId: channelId,
              },
            },
          };
        });
      },
      setChannelOpen: (workspaceId, open) => {
        if (!workspaceId) return;
        set((state) => {
          const current = getWorkspaceViewState(state.views[workspaceId]);
          if (current.channelOpen === open) return state;
          return {
            views: {
              ...state.views,
              [workspaceId]: {
                ...current,
                channelOpen: open,
              },
            },
          };
        });
      },
      setActiveToolTab: (workspaceId, tab) => {
        if (!workspaceId) return;
        set((state) => {
          const current = getWorkspaceViewState(state.views[workspaceId]);
          if (current.activeToolTab === tab) return state;
          return {
            views: {
              ...state.views,
              [workspaceId]: {
                ...current,
                activeToolTab: tab,
              },
            },
          };
        });
      },
      bumpMembersVersion: (workspaceId) => {
        if (!workspaceId) return;
        set((state) => ({
          views: {
            ...state.views,
            [workspaceId]: {
              ...getWorkspaceViewState(state.views[workspaceId]),
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
              ...getWorkspaceViewState(state.views[workspaceId]),
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
  closeFileTab: (path: string) => void;
  setSelectedSourceId: (sourceId: string | null) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setSelectedChannelId: (channelId: string | null) => void;
  setChannelOpen: (open: boolean) => void;
  setActiveToolTab: (tab: WorkspaceToolTab) => void;
  bumpMembersVersion: () => void;
  bumpChannelsVersion: () => void;
  resetWorkspaceView: () => void;
} {
  const view = useWorkspaceViewStore((state) => getWorkspaceViewState(state.views[workspaceId]));
  const setSelectedFilePath = useWorkspaceViewStore((state) => state.setSelectedFilePath);
  const closeFileTab = useWorkspaceViewStore((state) => state.closeFileTab);
  const setSelectedSourceId = useWorkspaceViewStore((state) => state.setSelectedSourceId);
  const setSelectedTaskId = useWorkspaceViewStore((state) => state.setSelectedTaskId);
  const setSelectedChannelId = useWorkspaceViewStore((state) => state.setSelectedChannelId);
  const setChannelOpen = useWorkspaceViewStore((state) => state.setChannelOpen);
  const setActiveToolTab = useWorkspaceViewStore((state) => state.setActiveToolTab);
  const bumpMembersVersion = useWorkspaceViewStore((state) => state.bumpMembersVersion);
  const bumpChannelsVersion = useWorkspaceViewStore((state) => state.bumpChannelsVersion);
  const resetWorkspaceView = useWorkspaceViewStore((state) => state.resetWorkspaceView);
  const selectFilePath = useCallback(
    (path: string | null) => setSelectedFilePath(workspaceId, path),
    [setSelectedFilePath, workspaceId],
  );
  const closeWorkspaceFileTab = useCallback(
    (path: string) => closeFileTab(workspaceId, path),
    [closeFileTab, workspaceId],
  );
  const selectSourceId = useCallback(
    (sourceId: string | null) => setSelectedSourceId(workspaceId, sourceId),
    [setSelectedSourceId, workspaceId],
  );
  const selectTaskId = useCallback(
    (taskId: string | null) => setSelectedTaskId(workspaceId, taskId),
    [setSelectedTaskId, workspaceId],
  );
  const selectChannelId = useCallback(
    (channelId: string | null) => setSelectedChannelId(workspaceId, channelId),
    [setSelectedChannelId, workspaceId],
  );
  const setWorkspaceChannelOpen = useCallback(
    (open: boolean) => setChannelOpen(workspaceId, open),
    [setChannelOpen, workspaceId],
  );
  const setWorkspaceActiveToolTab = useCallback(
    (tab: WorkspaceToolTab) => setActiveToolTab(workspaceId, tab),
    [setActiveToolTab, workspaceId],
  );
  const bumpWorkspaceMembersVersion = useCallback(
    () => bumpMembersVersion(workspaceId),
    [bumpMembersVersion, workspaceId],
  );
  const bumpWorkspaceChannelsVersion = useCallback(
    () => bumpChannelsVersion(workspaceId),
    [bumpChannelsVersion, workspaceId],
  );
  const resetCurrentWorkspaceView = useCallback(
    () => resetWorkspaceView(workspaceId),
    [resetWorkspaceView, workspaceId],
  );

  return {
    ...view,
    setSelectedFilePath: selectFilePath,
    closeFileTab: closeWorkspaceFileTab,
    setSelectedSourceId: selectSourceId,
    setSelectedTaskId: selectTaskId,
    setSelectedChannelId: selectChannelId,
    setChannelOpen: setWorkspaceChannelOpen,
    setActiveToolTab: setWorkspaceActiveToolTab,
    bumpMembersVersion: bumpWorkspaceMembersVersion,
    bumpChannelsVersion: bumpWorkspaceChannelsVersion,
    resetWorkspaceView: resetCurrentWorkspaceView,
  };
}
