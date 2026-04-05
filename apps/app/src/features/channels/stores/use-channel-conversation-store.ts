'use client';

import type { ChannelMessage } from '@/lib/api';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ChannelConversationState = {
  messages: ChannelMessage[];
  hydrated: boolean;
};

type ChannelConversationStore = {
  conversations: Record<string, ChannelConversationState>;
  replaceMessages: (conversationKey: string, messages: ChannelMessage[], hydrated?: boolean) => void;
  updateMessages: (
    conversationKey: string,
    updater: (messages: ChannelMessage[]) => ChannelMessage[],
    hydrated?: boolean,
  ) => void;
  clearConversation: (conversationKey: string) => void;
};

const DEFAULT_CONVERSATION_STATE: ChannelConversationState = {
  messages: [],
  hydrated: false,
};

export const EMPTY_CHANNEL_CONVERSATION_STATE = DEFAULT_CONVERSATION_STATE;

export const useChannelConversationStore = create<ChannelConversationStore>()(
  persist(
    (set) => ({
      conversations: {},
      replaceMessages: (conversationKey, messages, hydrated = true) => {
        if (!conversationKey) return;
        set((state) => ({
          conversations: {
            ...state.conversations,
            [conversationKey]: {
              messages,
              hydrated,
            },
          },
        }));
      },
      updateMessages: (conversationKey, updater, hydrated) => {
        if (!conversationKey) return;
        set((state) => {
          const current = state.conversations[conversationKey] ?? DEFAULT_CONVERSATION_STATE;
          return {
            conversations: {
              ...state.conversations,
              [conversationKey]: {
                messages: updater(current.messages),
                hydrated: hydrated ?? current.hydrated,
              },
            },
          };
        });
      },
      clearConversation: (conversationKey) => {
        if (!conversationKey) return;
        set((state) => ({
          conversations: {
            ...state.conversations,
            [conversationKey]: DEFAULT_CONVERSATION_STATE,
          },
        }));
      },
    }),
    {
      name: 'ownlab-channel-conversation',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ conversations: state.conversations }),
    },
  ),
);

export function getChannelConversationState(conversationKey: string): ChannelConversationState {
  return useChannelConversationStore.getState().conversations[conversationKey] ?? DEFAULT_CONVERSATION_STATE;
}
