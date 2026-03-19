'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ChannelRunState = {
  active: boolean;
  status: string | null;
  startedAt: string | null;
  error: string | null;
};

type ChannelRunStore = {
  runs: Record<string, ChannelRunState>;
  startRun: (runKey: string, status: string) => void;
  updateStatus: (runKey: string, status: string | null) => void;
  failRun: (runKey: string, error: string) => void;
  completeRun: (runKey: string) => void;
  clearRun: (runKey: string) => void;
};

const DEFAULT_RUN_STATE: ChannelRunState = {
  active: false,
  status: null,
  startedAt: null,
  error: null,
};

export const useChannelRunStore = create<ChannelRunStore>()(
  persist(
    (set) => ({
      runs: {},
      startRun: (runKey, status) => {
        if (!runKey) return;
        set((state) => ({
          runs: {
            ...state.runs,
            [runKey]: {
              active: true,
              status,
              startedAt: new Date().toISOString(),
              error: null,
            },
          },
        }));
      },
      updateStatus: (runKey, status) => {
        if (!runKey) return;
        set((state) => ({
          runs: {
            ...state.runs,
            [runKey]: {
              ...(state.runs[runKey] ?? DEFAULT_RUN_STATE),
              active: true,
              status,
              error: null,
            },
          },
        }));
      },
      failRun: (runKey, error) => {
        if (!runKey) return;
        set((state) => ({
          runs: {
            ...state.runs,
            [runKey]: {
              ...(state.runs[runKey] ?? DEFAULT_RUN_STATE),
              active: false,
              status: null,
              error,
            },
          },
        }));
      },
      completeRun: (runKey) => {
        if (!runKey) return;
        set((state) => ({
          runs: {
            ...state.runs,
            [runKey]: {
              ...(state.runs[runKey] ?? DEFAULT_RUN_STATE),
              active: false,
              status: null,
              error: null,
            },
          },
        }));
      },
      clearRun: (runKey) => {
        if (!runKey) return;
        set((state) => ({
          runs: {
            ...state.runs,
            [runKey]: DEFAULT_RUN_STATE,
          },
        }));
      },
    }),
    {
      name: 'ownlab-channel-run',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ runs: state.runs }),
    },
  ),
);

export function useChannelRun(runKey: string): ChannelRunState & {
  startRun: (status: string) => void;
  updateStatus: (status: string | null) => void;
  failRun: (error: string) => void;
  completeRun: () => void;
  clearRun: () => void;
} {
  const run = useChannelRunStore((state) => state.runs[runKey] ?? DEFAULT_RUN_STATE);
  const startRun = useChannelRunStore((state) => state.startRun);
  const updateStatus = useChannelRunStore((state) => state.updateStatus);
  const failRun = useChannelRunStore((state) => state.failRun);
  const completeRun = useChannelRunStore((state) => state.completeRun);
  const clearRun = useChannelRunStore((state) => state.clearRun);

  return {
    ...run,
    startRun: (status) => startRun(runKey, status),
    updateStatus: (status) => updateStatus(runKey, status),
    failRun: (error) => failRun(runKey, error),
    completeRun: () => completeRun(runKey),
    clearRun: () => clearRun(runKey),
  };
}
