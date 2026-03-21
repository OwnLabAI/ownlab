'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments';
import { Loader } from '@/components/ai-elements/loader';
import {
  Message,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as api from '@/lib/api';
import { PaperclipIcon } from 'lucide-react';
import { useChannelRun } from '@/features/channels/stores/use-channel-run-store';
import { MessageCopyButton } from '@/features/channels/components/message-copy-button';
import { PromptInputDraftProvider } from '@/features/channels/components/prompt-input-draft-provider';

type ChannelRecord = {
  id: string;
  workspaceId: string;
  scopeType: string;
  scopeRefId: string | null;
  name: string;
  title: string | null;
  description: string | null;
};

type ChannelAttachmentRecord = {
  type: 'file';
  filename?: string;
  mediaType?: string;
  url?: string;
  textContent?: string | null;
  textExtractionKind?: string | null;
};

type ChannelMessageRecord = {
  id: string;
  channelId: string;
  actorId: string;
  actorType: string;
  actorName: string | null;
  actorIcon: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  mentions: Array<{ actorId: string; actorType?: string | null; label?: string | null }>;
  attachments: ChannelAttachmentRecord[];
  createdAt: string;
};

type ChannelChatStreamEvent =
  | { type: 'user_message'; message: ChannelMessageRecord }
  | { type: 'assistant_message_start'; message: ChannelMessageRecord }
  | { type: 'assistant_message_content'; messageId: string; content: string }
  | { type: 'assistant_message_complete'; temporaryMessageId: string; message: ChannelMessageRecord }
  | { type: 'status'; message: string }
  | { type: 'error'; error: string };

type TeamApi = {
  fetchChannelMessages: (
    channelId: string,
    sessionId?: string | null,
  ) => Promise<ChannelMessageRecord[]>;
  stopChannelRun: (channelId: string) => Promise<unknown>;
  streamChannelChatMessageViaServer: (
    input: {
      channelId: string;
      workspaceId: string;
      content: string;
      actorId: string;
      attachments?: ChannelAttachmentRecord[];
      scopeType: 'team';
    },
    handlers: {
      signal?: AbortSignal;
      onEvent: (event: ChannelChatStreamEvent) => void;
    },
  ) => Promise<void>;
};

const teamApi = api as unknown as TeamApi;

function hasCompletedAssistantReply(messages: ChannelMessageRecord[]) {
  if (messages.some((message) => message.id.startsWith('stream-'))) {
    return false;
  }

  const latestMessage = messages.at(-1);
  if (!latestMessage) {
    return false;
  }

  return latestMessage.actorType === 'agent' && !latestMessage.id.startsWith('stream-');
}

export function TeamChatView({
  channel,
  placeholder,
}: {
  channel: ChannelRecord;
  placeholder?: string;
}) {
  const draftKey = `team:${channel.id}`;
  const [messages, setMessages] = useState<ChannelMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);
  const runState = useChannelRun(channel.id);
  const {
    active: runActive,
    status: runStatus,
    startRun,
    updateStatus,
    failRun,
    completeRun,
  } = runState;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await teamApi.fetchChannelMessages(channel.id);
        if (!cancelled) {
          setMessages(data);
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [channel.id]);

  useEffect(() => {
    if (!runActive || !hasCompletedAssistantReply(messages)) {
      return;
    }

    completeRun();
  }, [completeRun, messages, runActive]);

  useEffect(() => {
    if (!runActive || streamAbortRef.current) {
      return;
    }

    let cancelled = false;

    const refreshMessages = async () => {
      try {
        const data = await teamApi.fetchChannelMessages(channel.id);
        if (cancelled) {
          return;
        }
        setMessages(data);
        if (hasCompletedAssistantReply(data)) {
          completeRun();
        }
      } catch {
        return;
      }
    };

    void refreshMessages();
    const intervalId = window.setInterval(() => {
      void refreshMessages();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [channel.id, completeRun, runActive]);

  useEffect(() => {
    function hasFiles(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes('Files');
    }

    function handleDragEnter(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }
      dragDepthRef.current += 1;
      setDragActive(true);
    }

    function handleDragLeave(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setDragActive(false);
      }
    }

    function handleDrop(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }
      dragDepthRef.current = 0;
      setDragActive(false);
    }

    function handleDragEnd() {
      dragDepthRef.current = 0;
      setDragActive(false);
    }

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragend', handleDragEnd);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  const handleSubmit = useCallback(
    async ({ text, files }: PromptInputMessage) => {
      const content = text.trim();
      const attachments = files.map<ChannelAttachmentRecord>((file) => ({
        type: 'file',
        filename: file.filename,
        mediaType: file.mediaType,
        url: file.url,
      }));

      if (!content && attachments.length === 0) {
        return;
      }

      const optimisticUser: ChannelMessageRecord = {
        id: `local-${Date.now()}`,
        channelId: channel.id,
        actorId: 'local-user',
        actorType: 'human',
        actorName: 'You',
        actorIcon: null,
        content,
        metadata: attachments.length > 0 ? { attachments } : null,
        mentions: [],
        attachments,
        createdAt: new Date().toISOString(),
      };

      setSendError(null);
      startRun('Coordinating team...');
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        const controller = new AbortController();
        streamAbortRef.current = controller;

        await teamApi.streamChannelChatMessageViaServer(
          {
            channelId: channel.id,
            workspaceId: channel.workspaceId,
            content,
            actorId: 'local-user',
            attachments,
            scopeType: 'team',
          },
          {
            signal: controller.signal,
            onEvent(event) {
              if (event.type === 'user_message') {
                setMessages((prev) => [
                  ...prev.filter((message) => message.id !== optimisticUser.id),
                  event.message,
                ]);
                return;
              }

              if (event.type === 'assistant_message_start') {
                updateStatus('Coordinating team...');
                setMessages((prev) =>
                  prev.some((message) => message.id === event.message.id)
                    ? prev
                    : [...prev, event.message],
                );
                return;
              }

              if (event.type === 'assistant_message_content') {
                updateStatus('Coordinating team...');
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === event.messageId
                      ? { ...message, content: event.content }
                      : message,
                  ),
                );
                return;
              }

              if (event.type === 'assistant_message_complete') {
                completeRun();
                setMessages((prev) => {
                  const hasTemporary = prev.some(
                    (message) => message.id === event.temporaryMessageId,
                  );
                  if (hasTemporary) {
                    return prev.map((message) =>
                      message.id === event.temporaryMessageId ? event.message : message,
                    );
                  }

                  return prev.some((message) => message.id === event.message.id)
                    ? prev
                    : [...prev, event.message];
                });
                return;
              }

              if (event.type === 'status') {
                updateStatus(event.message);
                return;
              }

              if (event.type === 'error') {
                throw new Error(event.error);
              }
            },
          },
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setMessages((prev) =>
          prev.filter(
            (message) => message.id !== optimisticUser.id && !message.id.startsWith('stream-'),
          ),
        );
        const message = error instanceof Error ? error.message : 'Failed to send message';
        setSendError(message);
        failRun(message);
        throw error;
      } finally {
        streamAbortRef.current = null;
      }
    },
    [channel.id, channel.workspaceId, completeRun, failRun, startRun, updateStatus],
  );

  const handleStop = useCallback(async () => {
    updateStatus('Stopping response...');
    try {
      await teamApi.stopChannelRun(channel.id);
    } finally {
      streamAbortRef.current?.abort();
      completeRun();
      window.setTimeout(() => {
        void teamApi.fetchChannelMessages(channel.id).then(setMessages).catch(() => {});
      }, 250);
    }
  }, [channel.id, completeRun, updateStatus]);

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {dragActive ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-dashed border-primary/50 bg-background/90 px-6 py-4 text-sm font-medium text-foreground shadow-sm">
            Drop files anywhere in this team conversation
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader className="text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <div className="min-h-0 flex-1" />
        ) : (
          <Conversation className="h-full min-h-0 overflow-y-auto">
            <ConversationContent className="min-h-full px-5 py-5">
              {messages.map((message) => (
                <TeamMessageItem key={message.id} message={message} />
              ))}
              {runActive && runStatus ? (
                <Message from="assistant">
                  <MessageContent className="w-full rounded-none bg-transparent px-0 py-0 shadow-none">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Loader className="text-muted-foreground" />
                      <span className="whitespace-pre-wrap">{runStatus}</span>
                    </div>
                  </MessageContent>
                </Message>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}
      </div>

      <div className="shrink-0 bg-transparent p-4 pt-3">
        {sendError ? (
          <div className="mx-auto mb-3 max-w-3xl rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {sendError}
          </div>
        ) : null}
        <PromptInputDraftProvider draftKey={draftKey}>
          <PromptInput
            onSubmit={handleSubmit}
            globalDrop
            clearOnSubmitStart
            className="mx-auto max-w-3xl [&_[data-slot=input-group]]:border-border/40 [&_[data-slot=input-group]]:bg-background/60 [&_[data-slot=input-group]]:shadow-sm [&_[data-slot=input-group]]:backdrop-blur-md"
            multiple
            maxFiles={8}
          >
            <TeamComposerAttachments />
            <PromptInputTextarea placeholder={placeholder ?? 'Message team...'} />
            <PromptInputFooter>
              <TeamComposerAttachmentButton />
              <PromptInputSubmit status={runActive ? 'streaming' : 'ready'} onStop={handleStop} />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputDraftProvider>
      </div>
    </div>
  );
}

function TeamComposerAttachmentButton() {
  const attachments = usePromptInputAttachments();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 px-2 text-xs text-muted-foreground"
      onClick={() => attachments.openFileDialog()}
      aria-label="Attach files"
      title="Attach files"
    >
      <PaperclipIcon data-icon="inline-start" />
      {attachments.files.length > 0 ? <span>{attachments.files.length}</span> : null}
    </Button>
  );
}

function TeamComposerAttachments() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <PromptInputHeader>
      <Attachments variant="inline" className="w-full">
        {attachments.files.map((file) => (
          <Attachment key={file.id} data={file} onRemove={() => attachments.remove(file.id)}>
            <AttachmentPreview />
            <AttachmentInfo />
            <AttachmentRemove label="Remove attachment" />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}

function TeamMessageItem({ message }: { message: ChannelMessageRecord }) {
  const isAssistant = message.actorType === 'agent';
  const hasContent = message.content.trim().length > 0;

  return (
    <Message from={isAssistant ? 'assistant' : 'user'}>
      <div
        className={cn(
          'flex max-w-full gap-3',
          isAssistant ? 'items-start' : 'flex-row-reverse items-start',
        )}
      >
        <ActorAvatar name={message.actorName} icon={message.actorIcon} className="mt-0.5 shrink-0" />
        <div className={cn('flex min-w-0 max-w-full flex-col gap-2', !isAssistant && 'items-end')}>
          <div
            className={cn(
              'flex w-full items-center gap-2 text-xs text-muted-foreground',
              !isAssistant && 'justify-end',
            )}
          >
            <span className="font-medium text-foreground">{message.actorName ?? 'Unknown'}</span>
            <span className={cn('tabular-nums', !isAssistant && 'text-right')}>
              {formatTimestamp(message.createdAt)}
            </span>
            {hasContent ? (
              <MessageActions className={cn(!isAssistant && 'justify-end')}>
                <MessageCopyButton content={message.content} align={isAssistant ? 'left' : 'right'} />
              </MessageActions>
            ) : null}
          </div>

          <MessageContent className="w-full rounded-none bg-transparent px-0 py-0 shadow-none">
            {message.content ? (
              isAssistant ? (
                <MessageResponse>{message.content}</MessageResponse>
              ) : (
                <p className="whitespace-pre-wrap text-right">{message.content}</p>
              )
            ) : null}
            {message.attachments.length > 0 ? (
              <MessageAttachments attachments={message.attachments} />
            ) : null}
          </MessageContent>
        </div>
      </div>
    </Message>
  );
}

function MessageAttachments({ attachments }: { attachments: ChannelAttachmentRecord[] }) {
  return (
    <Attachments variant="list" className="mt-2 w-full max-w-xl">
      {attachments.map((attachment, index) => (
        <Attachment
          key={`${attachment.filename ?? attachment.url ?? 'attachment'}-${index}`}
          data={{
            id: `${attachment.filename ?? 'attachment'}-${index}`,
            type: 'file',
            filename: attachment.filename,
            mediaType: attachment.mediaType ?? 'application/octet-stream',
            url: attachment.url ?? '',
          }}
        >
          <AttachmentPreview />
          <AttachmentInfo showMediaType />
        </Attachment>
      ))}
    </Attachments>
  );
}

function ActorAvatar({
  name,
  icon,
  className,
}: {
  name: string | null;
  icon: string | null;
  className?: string;
}) {
  const initials = getInitials(name);
  const imageUrl = isImageUrl(icon) ? icon : null;
  const fallback = !imageUrl && icon ? icon : initials;

  return (
    <Avatar size="sm" className={className}>
      {imageUrl ? <AvatarImage src={imageUrl} alt={name ?? 'avatar'} /> : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

function getInitials(name: string | null) {
  if (!name) {
    return '?';
  }

  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

function isImageUrl(icon: string | null) {
  if (!icon) {
    return false;
  }

  return /^(https?:|data:image\/|blob:|\/)/.test(icon);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
