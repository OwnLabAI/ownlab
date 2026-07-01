'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AgentViewState = {
  configOpen: boolean;
};

type AgentViewStore = {
  views: Record<string, AgentViewState>;
  setConfigOpen: (agentName: string, open: boolean) => void;
};

const DEFAULT_AGENT_VIEW: AgentViewState = {
  configOpen: false,
};

export const useAgentViewStore = create<AgentViewStore>()(
  persist(
    (set) => ({
      views: {},
      setConfigOpen: (agentName, open) => {
        if (!agentName) return;
        set((state) => ({
          views: {
            ...state.views,
            [agentName]: {
              ...(state.views[agentName] ?? DEFAULT_AGENT_VIEW),
              configOpen: open,
            },
          },
        }));
      },
    }),
    {
      name: 'ownlab-agent-view',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ views: state.views }),
    },
  ),
);

export function useAgentView(agentName: string): AgentViewState & {
  setConfigOpen: (open: boolean) => void;
} {
  const view = useAgentViewStore((state) => state.views[agentName] ?? DEFAULT_AGENT_VIEW);
  const setConfigOpen = useAgentViewStore((state) => state.setConfigOpen);

  return {
    ...view,
    setConfigOpen: (open) => setConfigOpen(agentName, open),
  };
}
