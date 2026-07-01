'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ChannelDraftStore = {
  drafts: Record<string, string>;
  setDraft: (draftKey: string, value: string) => void;
  clearDraft: (draftKey: string) => void;
};

export const useChannelDraftStore = create<ChannelDraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (draftKey, value) => {
        if (!draftKey) {
          return;
        }

        const nextValue = value.trim().length > 0 ? value : '';
        set((state) => {
          if (!nextValue) {
            if (!(draftKey in state.drafts)) {
              return state;
            }

            const { [draftKey]: _removed, ...rest } = state.drafts;
            return { drafts: rest };
          }

          if (state.drafts[draftKey] === nextValue) {
            return state;
          }

          return {
            drafts: {
              ...state.drafts,
              [draftKey]: nextValue,
            },
          };
        });
      },
      clearDraft: (draftKey) => {
        if (!draftKey) {
          return;
        }

        set((state) => {
          if (!(draftKey in state.drafts)) {
            return state;
          }

          const { [draftKey]: _removed, ...rest } = state.drafts;
          return { drafts: rest };
        });
      },
    }),
    {
      name: 'ownlab-channel-draft',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ drafts: state.drafts }),
    },
  ),
);

export function useChannelDraft(draftKey: string) {
  const draft = useChannelDraftStore((state) => state.drafts[draftKey] ?? '');
  const setDraft = useChannelDraftStore((state) => state.setDraft);
  const clearDraft = useChannelDraftStore((state) => state.clearDraft);

  return {
    draft,
    setDraft: (value: string) => setDraft(draftKey, value),
    clearDraft: () => clearDraft(draftKey),
  };
}
