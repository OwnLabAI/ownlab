'use client';

import type { ComponentProps, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Loader } from '@/components/ai-elements/loader';
import {
  Message,
  MessageContent,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { cn } from '@/lib/utils';
import {
  fetchChannelMessages,
  fetchChannelMembers,
  stopChannelRun,
  streamChannelChatMessageViaServer,
  type Channel,
  type ChannelAttachment,
  type ChannelChatStreamEvent,
  type ChannelMention,
  type ChannelMessage,
  type WorkspaceAgent,
} from '@/lib/api';
import { toast } from 'sonner';
import { useChannelRun } from '@/features/channels/stores/use-channel-run-store';
import { PromptInputDraftProvider } from '@/features/channels/components/prompt-input-draft-provider';
import { usePersistentChannelConversation } from '@/features/channels/hooks/use-persistent-channel-conversation';
import { useWorkspaceView } from '@/features/workspace/stores/use-workspace-view-store';
import { ComposerAttachmentButton, ComposerAttachments } from './composer';
import {
  filterMentionsByContent,
  findMentionDraft,
  getMentionSuggestions,
  setTextareaValue,
} from './mention-utils';
import { ChannelMessageItem, WorkspaceMessageLink } from './message-item';
import { getLocalWorkspaceTarget } from './link-utils';

interface ChannelChatViewProps {
  channel: Channel;
  workspaceRootPath?: string | null;
  sessionId?: string | null;
  placeholder?: string;
  extraBody?: Record<string, unknown>;
  headerActions?: ReactNode;
  onChannelActivity?: () => void;
  appearance?: 'default' | 'floating';
}

function hasCompletedAssistantReply(messages: ChannelMessage[]) {
  if (messages.some((message) => message.id.startsWith('stream-'))) {
    return false;
  }

  const latestMessage = messages.at(-1);
  if (!latestMessage) {
    return false;
  }

  return latestMessage.actorType === 'agent' && !latestMessage.id.startsWith('stream-');
}

export function ChannelChatView({
  channel,
  workspaceRootPath = null,
  sessionId = null,
  placeholder,
  extraBody,
  headerActions,
  onChannelActivity,
  appearance = 'default',
}: ChannelChatViewProps) {
  const { membersVersion, setActiveToolTab, setSelectedFilePath } = useWorkspaceView(channel.workspaceId);
  const runKey = sessionId ? `${channel.id}:${sessionId}` : channel.id;
  const conversationKey = `workspace-chat:${runKey}`;
  const draftKey = sessionId ? `workspace:${channel.id}:${sessionId}` : `workspace:${channel.id}`;
  const [sendError, setSendError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [workspaceAgents, setWorkspaceAgents] = useState<WorkspaceAgent[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<ChannelMention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0);
  const dragDepthRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const runState = useChannelRun(runKey);
  const {
    active: runActive,
    status: runStatus,
    startRun,
    updateStatus,
    failRun,
    completeRun,
  } = runState;
  const {
    messages,
    loading,
    updateMessages,
    refreshFromServer,
  } = usePersistentChannelConversation({
    conversationKey,
    fetchMessages: useCallback(
      () => fetchChannelMessages(channel.id, sessionId),
      [channel.id, sessionId],
    ),
    runActive,
    hasCompletedReply: hasCompletedAssistantReply,
  });
  const handleOpenLocalPath = useCallback(
    (relativePath: string) => {
      setActiveToolTab('file');
      setSelectedFilePath(relativePath);
    },
    [setActiveToolTab, setSelectedFilePath],
  );
  const handleMessageLinkClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const localTarget = getLocalWorkspaceTarget(
        anchor.getAttribute('href') ?? anchor.href,
        workspaceRootPath,
        typeof window !== 'undefined' ? window.location.origin : null,
      );

      if (!localTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!localTarget.relativePath || localTarget.looksLikeDirectory) {
        toast.info('Local folders are not previewable in the viewboard yet.');
        return;
      }

      handleOpenLocalPath(localTarget.relativePath);
    },
    [handleOpenLocalPath, workspaceRootPath],
  );
  const markdownComponents = useMemo<ComponentProps<typeof ChannelMessageItem>['markdownComponents']>(
    () => ({
      a: (props: ComponentProps<'a'> & { node?: unknown }) => (
        <WorkspaceMessageLink
          {...props}
          workspaceRootPath={workspaceRootPath}
          onOpenLocalPath={handleOpenLocalPath}
        />
      ),
    }),
    [handleOpenLocalPath, workspaceRootPath],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceAgents() {
      try {
        const members = await fetchChannelMembers(channel.id);
        const nextAgents = members
          .filter((member) => member.actorType === 'agent' && !!member.name)
          .map((member) => ({
            id: member.actorId,
            name: member.name ?? member.actorId,
            icon: member.icon,
            status: member.status ?? 'unknown',
            adapterType: 'unknown',
          }));
        if (!cancelled) {
          setWorkspaceAgents(nextAgents);
        }
      } catch {
        if (!cancelled) {
          setWorkspaceAgents([]);
        }
      }
    }

    void loadWorkspaceAgents();

    return () => {
      cancelled = true;
    };
  }, [channel.id, membersVersion]);

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
        const data = await refreshFromServer();
        if (cancelled) {
          return;
        }
        if (hasCompletedAssistantReply(data)) {
          completeRun();
        }
      } catch {
        // Leave the current local state in place and retry on the next interval.
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
  }, [completeRun, refreshFromServer, runActive]);

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
      const mentions = selectedMentions;
      const attachments = files.map<ChannelAttachment>((file) => ({
        type: 'file',
        filename: file.filename,
        mediaType: file.mediaType,
        url: file.url,
      }));

      if (!content && attachments.length === 0) return;

      const optimisticUser: ChannelMessage = {
        id: `local-${Date.now()}`,
        channelId: channel.id,
        actorId: 'local-user',
        actorType: 'human',
        actorName: 'You',
        actorIcon: null,
        content,
        metadata: attachments.length > 0 ? { attachments } : null,
        mentions,
        attachments,
        createdAt: new Date().toISOString(),
      };

      setSendError(null);
      setSelectedMentions([]);
      setMentionQuery(null);
      setMentionRange(null);
      setHighlightedMentionIndex(0);
      startRun('Thinking...');
      updateMessages((prev) => [...prev, optimisticUser], true);

      try {
        const controller = new AbortController();
        streamAbortRef.current = controller;
        await streamChannelChatMessageViaServer({
          channelId: channel.id,
          workspaceId: channel.workspaceId,
          content,
          actorId: 'local-user',
          sessionId: sessionId ?? undefined,
          attachments,
          mentions,
          ...(extraBody ?? {}),
        }, {
          signal: controller.signal,
          onEvent(event: ChannelChatStreamEvent) {
            if (event.type === 'user_message') {
              updateMessages((prev) => [
                ...prev.filter((message) => message.id !== optimisticUser.id),
                event.message,
              ], true);
              onChannelActivity?.();
              return;
            }

            if (event.type === 'assistant_message_start') {
              updateStatus('Thinking...');
              updateMessages((prev) => {
                if (prev.some((message) => message.id === event.message.id)) {
                  return prev;
                }
                return [...prev, event.message];
              }, true);
              return;
            }

            if (event.type === 'assistant_message_content') {
              updateStatus('Thinking...');
              updateMessages((prev) => prev.map((message) => (
                message.id === event.messageId
                  ? { ...message, content: event.content }
                  : message
              )), true);
              return;
            }

            if (event.type === 'assistant_message_complete') {
              completeRun();
              updateMessages((prev) => {
                const hasTemporary = prev.some(
                  (message) => message.id === event.temporaryMessageId,
                );
                if (hasTemporary) {
                  return prev.map((message) => (
                    message.id === event.temporaryMessageId ? event.message : message
                  ));
                }
                if (prev.some((message) => message.id === event.message.id)) {
                  return prev;
                }
                return [...prev, event.message];
              }, true);
              onChannelActivity?.();
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
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        updateMessages((prev) => prev.filter((message) => (
          message.id !== optimisticUser.id && !message.id.startsWith('stream-')
        )), true);
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to send message with attachments';
        setSendError(message);
        failRun(message);
        throw error;
      } finally {
        streamAbortRef.current = null;
      }
    },
    [
      channel.id,
      channel.workspaceId,
      completeRun,
      extraBody,
      failRun,
      onChannelActivity,
      selectedMentions,
      sessionId,
      startRun,
      updateMessages,
      updateStatus,
    ],
  );

  const mentionSuggestions = getMentionSuggestions(workspaceAgents, mentionQuery, selectedMentions);
  const hasMentionSuggestions = mentionSuggestions.length > 0 && mentionRange !== null;

  const updateMentionDraft = useCallback((textarea: HTMLTextAreaElement) => {
    textareaRef.current = textarea;
    setSelectedMentions((prev) => filterMentionsByContent(prev, textarea.value));

    const draft = findMentionDraft(textarea.value, textarea.selectionStart ?? textarea.value.length);
    const nextQuery = draft?.query ?? null;
    setMentionQuery((prev) => (prev === nextQuery ? prev : nextQuery));
    setMentionRange((prev) => {
      if (!draft) {
        return prev === null ? prev : null;
      }

      if (prev && prev.start === draft.start && prev.end === draft.end) {
        return prev;
      }

      return { start: draft.start, end: draft.end };
    });
  }, []);

  useEffect(() => {
    setHighlightedMentionIndex(0);
  }, [mentionQuery, mentionRange?.start, mentionRange?.end]);

  const insertMention = useCallback((agent: WorkspaceAgent) => {
    const textarea = textareaRef.current;
    if (!textarea || !mentionRange) {
      return;
    }

    const label = `@${agent.name}`;
    const nextValue = `${textarea.value.slice(0, mentionRange.start)}${label} ${textarea.value.slice(mentionRange.end)}`;
    setTextareaValue(textarea, nextValue);
    setSelectedMentions((prev) => {
      if (prev.some((mention) => mention.id === agent.id)) {
        return prev;
      }

      return [...prev, { id: agent.id, type: 'agent', label }];
    });
    setMentionQuery(null);
    setMentionRange(null);
    setHighlightedMentionIndex(0);

    window.requestAnimationFrame(() => {
      const nextCaret = mentionRange.start + label.length + 1;
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }, [mentionRange]);

  const handleTextareaKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!hasMentionSuggestions) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedMentionIndex((prev) => (
        prev === 0 ? mentionSuggestions.length - 1 : prev - 1
      ));
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      insertMention(mentionSuggestions[highlightedMentionIndex] ?? mentionSuggestions[0]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setMentionQuery(null);
      setMentionRange(null);
      setHighlightedMentionIndex(0);
    }
  }, [hasMentionSuggestions, highlightedMentionIndex, insertMention, mentionSuggestions.length, mentionSuggestions]);

  const handleStop = useCallback(async () => {
    updateStatus('Stopping response...');
    try {
      await stopChannelRun(channel.id);
    } finally {
      streamAbortRef.current?.abort();
      completeRun();
      window.setTimeout(() => {
        void refreshFromServer().catch(() => {});
      }, 250);
    }
  }, [channel.id, completeRun, refreshFromServer, updateStatus]);

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {dragActive ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-dashed border-primary/50 bg-background/90 px-6 py-4 text-sm font-medium text-foreground shadow-sm">
            Drop images, PDFs, or files anywhere in this conversation
          </div>
        </div>
      ) : null}
      {headerActions ? (
        <div
          className={cn(
            'flex shrink-0 justify-end px-4 py-3',
            appearance === 'default' && 'border-b',
          )}
        >
          {headerActions}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader className="text-muted-foreground" />
          </div>
        ) : isEmpty ? null : (
          <Conversation className="h-full min-h-0">
            <ConversationContent
              className={cn('min-h-full', appearance === 'floating' && 'px-5 py-5')}
              onClickCapture={handleMessageLinkClickCapture}
            >
              {messages.map((message) => (
                <ChannelMessageItem
                  key={message.id}
                  message={message}
                  appearance={appearance}
                  markdownComponents={markdownComponents}
                />
              ))}
              {runActive && runStatus ? (
                <Message from="assistant">
                  <MessageContent
                    className={cn(
                      appearance === 'floating' &&
                        'w-full rounded-none bg-transparent px-0 py-0 shadow-none',
                    )}
                  >
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

      <div
        className={cn(
          'shrink-0 p-4',
          appearance === 'default' ? 'bg-background' : 'bg-transparent pt-3',
        )}
      >
        {sendError ? (
          <div className="mx-auto mb-3 max-w-3xl rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {sendError}
          </div>
        ) : null}
        <div className="relative mx-auto max-w-3xl">
          {mentionRange !== null ? (
            <div className="pointer-events-none absolute bottom-full left-0 right-0 z-30 mb-2">
              {mentionRange !== null ? (
                <div className="pointer-events-auto overflow-hidden rounded-xl border bg-popover shadow-lg">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Mention an agent to choose who should answer
                  </div>
                  {mentionSuggestions.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto p-1">
                      {mentionSuggestions.map((agent, index) => {
                        const active = index === highlightedMentionIndex;
                        return (
                          <button
                            key={agent.id}
                            type="button"
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                              active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                            )}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              insertMention(agent);
                            }}
                          >
                            <span className="truncate font-medium">@{agent.name}</span>
                            <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                              {agent.status}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-3 py-3 text-sm text-muted-foreground">
                      No matching agents in this workspace.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <PromptInputDraftProvider draftKey={draftKey}>
            <PromptInput
              onSubmit={handleSubmit}
              globalDrop
              clearOnSubmitStart
              className={cn(
                'max-w-3xl',
                appearance === 'floating' && [
                  '[&_[data-slot=input-group]]:border-border/40',
                  '[&_[data-slot=input-group]]:bg-background/60',
                  '[&_[data-slot=input-group]]:shadow-sm',
                  '[&_[data-slot=input-group]]:backdrop-blur-md',
                ],
              )}
              multiple
              maxFiles={8}
            >
              <ComposerAttachments />
              <PromptInputTextarea
                placeholder={placeholder ?? ''}
                onChange={(event) => updateMentionDraft(event.currentTarget)}
                onClick={(event) => updateMentionDraft(event.currentTarget)}
                onKeyUp={(event) => updateMentionDraft(event.currentTarget)}
                onSelect={(event) => updateMentionDraft(event.currentTarget)}
                onFocus={(event) => updateMentionDraft(event.currentTarget)}
                onKeyDown={handleTextareaKeyDown}
              />
              <PromptInputFooter>
                <ComposerAttachmentButton />
                <PromptInputSubmit status={runActive ? 'streaming' : 'ready'} onStop={handleStop} />
              </PromptInputFooter>
            </PromptInput>
          </PromptInputDraftProvider>
        </div>
      </div>
    </div>
  );
}
