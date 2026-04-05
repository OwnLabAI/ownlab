'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChannelMessage } from '@/lib/api';
import {
  EMPTY_CHANNEL_CONVERSATION_STATE,
  getChannelConversationState,
  useChannelConversationStore,
} from '@/features/channels/stores/use-channel-conversation-store';

type UsePersistentChannelConversationOptions = {
  conversationKey: string;
  fetchMessages: () => Promise<ChannelMessage[]>;
  runActive: boolean;
  hasCompletedReply: (messages: ChannelMessage[]) => boolean;
};

function isTransientMessage(message: ChannelMessage) {
  return message.id.startsWith('local-') || message.id.startsWith('stream-');
}

function normalizeAttachments(message: ChannelMessage) {
  return message.attachments.map((attachment) => ({
    type: attachment.type,
    filename: attachment.filename ?? null,
    mediaType: attachment.mediaType ?? null,
    url: attachment.url ?? null,
  }));
}

function areAttachmentListsEqual(a: ChannelMessage, b: ChannelMessage) {
  return JSON.stringify(normalizeAttachments(a)) === JSON.stringify(normalizeAttachments(b));
}

function matchesOptimisticMessage(optimistic: ChannelMessage, persisted: ChannelMessage) {
  if (optimistic.actorType !== persisted.actorType) {
    return false;
  }

  if (optimistic.content !== persisted.content) {
    return false;
  }

  if (!areAttachmentListsEqual(optimistic, persisted)) {
    return false;
  }

  const optimisticTime = new Date(optimistic.createdAt).getTime();
  const persistedTime = new Date(persisted.createdAt).getTime();
  return Math.abs(optimisticTime - persistedTime) <= 60_000;
}

function sortMessages(messages: ChannelMessage[]) {
  return [...messages].sort((left, right) => {
    const timeDelta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function mergeServerMessagesWithTransientState(
  serverMessages: ChannelMessage[],
  cachedMessages: ChannelMessage[],
  runActive: boolean,
  hasCompletedReply: (messages: ChannelMessage[]) => boolean,
) {
  const merged = [...serverMessages];
  const completed = hasCompletedReply(serverMessages);

  for (const message of cachedMessages) {
    if (!isTransientMessage(message)) {
      continue;
    }

    if (message.id.startsWith('local-')) {
      const alreadyPersisted = serverMessages.some((serverMessage) =>
        matchesOptimisticMessage(message, serverMessage),
      );
      if (!alreadyPersisted) {
        merged.push(message);
      }
      continue;
    }

    if (message.id.startsWith('stream-') && runActive && !completed) {
      merged.push(message);
    }
  }

  const deduped = merged.filter((message, index, all) =>
    all.findIndex((candidate) => candidate.id === message.id) === index,
  );

  return sortMessages(deduped);
}

export function usePersistentChannelConversation({
  conversationKey,
  fetchMessages,
  runActive,
  hasCompletedReply,
}: UsePersistentChannelConversationOptions) {
  const conversation = useChannelConversationStore(
    useCallback(
      (state) => state.conversations[conversationKey] ?? EMPTY_CHANNEL_CONVERSATION_STATE,
      [conversationKey],
    ),
  );
  const replaceMessages = useChannelConversationStore((state) => state.replaceMessages);
  const updateMessagesInStore = useChannelConversationStore((state) => state.updateMessages);
  const [loading, setLoading] = useState(
    !conversation.hydrated && conversation.messages.length === 0,
  );

  useEffect(() => {
    setLoading(!conversation.hydrated && conversation.messages.length === 0);
  }, [conversation.hydrated, conversation.messages.length, conversationKey]);

  const setMessages = useCallback(
    (messages: ChannelMessage[], hydrated = true) => {
      replaceMessages(conversationKey, messages, hydrated);
    },
    [conversationKey, replaceMessages],
  );

  const updateMessages = useCallback(
    (updater: (messages: ChannelMessage[]) => ChannelMessage[], hydrated?: boolean) => {
      updateMessagesInStore(conversationKey, updater, hydrated);
    },
    [conversationKey, updateMessagesInStore],
  );

  const refreshFromServer = useCallback(async () => {
    const serverMessages = await fetchMessages();
    const cachedMessages = getChannelConversationState(conversationKey).messages;
    const mergedMessages = mergeServerMessagesWithTransientState(
      serverMessages,
      cachedMessages,
      runActive,
      hasCompletedReply,
    );
    replaceMessages(conversationKey, mergedMessages, true);
    return mergedMessages;
  }, [conversationKey, fetchMessages, hasCompletedReply, replaceMessages, runActive]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await refreshFromServer();
      } catch {
        if (!cancelled && getChannelConversationState(conversationKey).messages.length === 0) {
          replaceMessages(conversationKey, [], true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [conversationKey, refreshFromServer, replaceMessages]);

  return {
    messages: conversation.messages,
    loading,
    setMessages,
    updateMessages,
    refreshFromServer,
  };
}
