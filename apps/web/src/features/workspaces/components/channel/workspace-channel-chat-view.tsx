'use client';

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  fetchChannelMessages,
  fetchWorkspaceMembers,
  stopChannelRun,
  streamChannelChatMessageViaServer,
  type Channel,
  type ChannelAttachment,
  type ChannelChatStreamEvent,
  type ChannelMention,
  type ChannelMessage,
  type WorkspaceAgent,
} from '@/lib/api';
import { PaperclipIcon } from 'lucide-react';
import { useChannelRun } from '@/features/channels/stores/use-channel-run-store';
import { PromptInputDraftProvider } from '@/features/channels/components/prompt-input-draft-provider';
import { MessageCopyButton } from '@/features/channels/components/message-copy-button';

interface WorkspaceChannelChatViewProps {
  channel: Channel;
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

export function WorkspaceChannelChatView({
  channel,
  sessionId = null,
  placeholder,
  extraBody,
  headerActions,
  onChannelActivity,
  appearance = 'default',
}: WorkspaceChannelChatViewProps) {
  const runKey = sessionId ? `${channel.id}:${sessionId}` : channel.id;
  const draftKey = sessionId ? `workspace:${channel.id}:${sessionId}` : `workspace:${channel.id}`;
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
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
    startedAt: runStartedAt,
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
        const data = await fetchChannelMessages(channel.id, sessionId);
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
  }, [channel.id, sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceAgents() {
      try {
        const members = await fetchWorkspaceMembers(channel.workspaceId);
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
  }, [channel.workspaceId]);

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
        const data = await fetchChannelMessages(channel.id, sessionId);
        if (cancelled) {
          return;
        }
        setMessages(data);
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
  }, [channel.id, completeRun, runActive, sessionId]);

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
      setMessages((prev) => [...prev, optimisticUser]);

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
              setMessages((prev) => [
                ...prev.filter((message) => message.id !== optimisticUser.id),
                event.message,
              ]);
              onChannelActivity?.();
              return;
            }

            if (event.type === 'assistant_message_start') {
              updateStatus('Thinking...');
              setMessages((prev) => {
                if (prev.some((message) => message.id === event.message.id)) {
                  return prev;
                }
                return [...prev, event.message];
              });
              return;
            }

            if (event.type === 'assistant_message_content') {
              updateStatus('Thinking...');
              setMessages((prev) => prev.map((message) => (
                message.id === event.messageId
                  ? { ...message, content: event.content }
                  : message
              )));
              return;
            }

            if (event.type === 'assistant_message_complete') {
              completeRun();
              setMessages((prev) => {
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
              });
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
        setMessages((prev) => prev.filter((message) => (
          message.id !== optimisticUser.id && !message.id.startsWith('stream-')
        )));
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
    [channel.id, channel.workspaceId, completeRun, extraBody, failRun, onChannelActivity, selectedMentions, sessionId, startRun, updateStatus],
  );

  const mentionSuggestions = getMentionSuggestions(workspaceAgents, mentionQuery, selectedMentions);
  const hasMentionSuggestions = mentionSuggestions.length > 0 && mentionRange !== null;

  const updateMentionDraft = useCallback((textarea: HTMLTextAreaElement) => {
    textareaRef.current = textarea;
    setSelectedMentions((prev) => filterMentionsByContent(prev, textarea.value));

    const draft = findMentionDraft(textarea.value, textarea.selectionStart ?? textarea.value.length);
    setMentionQuery(draft?.query ?? null);
    setMentionRange(draft ? { start: draft.start, end: draft.end } : null);
    setHighlightedMentionIndex(0);
  }, []);

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
        void fetchChannelMessages(channel.id, sessionId).then(setMessages).catch(() => {});
      }, 250);
    }
  }, [channel.id, completeRun, sessionId, updateStatus]);

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
          <Conversation className="h-full min-h-0 overflow-y-auto">
            <ConversationContent
              className={cn('min-h-full', appearance === 'floating' && 'px-5 py-5')}
            >
              {messages.map((message) => (
                <ChannelMessageItem
                  key={message.id}
                  message={message}
                  appearance={appearance}
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
          appearance === 'default' ? 'border-t bg-background' : 'bg-transparent pt-3',
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

function ComposerAttachmentButton() {
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
      <PaperclipIcon className="size-3.5" />
      {attachments.files.length > 0 ? <span>{attachments.files.length}</span> : null}
    </Button>
  );
}

function ComposerAttachments() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <PromptInputHeader>
      <Attachments variant="inline" className="w-full">
        {attachments.files.map((file) => (
          <Attachment
            key={file.id}
            data={file}
            onRemove={() => attachments.remove(file.id)}
          >
            <AttachmentPreview />
            <AttachmentInfo />
            <AttachmentRemove label="Remove attachment" />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}

function ChannelMessageItem({
  message,
  appearance = 'default',
}: {
  message: ChannelMessage;
  appearance?: 'default' | 'floating';
}) {
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
        <ActorAvatar
          name={message.actorName}
          icon={message.actorIcon}
          className="mt-0.5 shrink-0"
        />

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

          <MessageContent
            className={cn(
              appearance === 'floating' &&
                'w-full rounded-none bg-transparent px-0 py-0 shadow-none',
            )}
          >
            {message.content ? (
              isAssistant ? (
                <MessageResponse>{message.content}</MessageResponse>
              ) : (
                <p className="whitespace-pre-wrap text-right">{message.content}</p>
              )
            ) : null}
            {message.mentions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.mentions.map((mention) => (
                  <Badge key={`${message.id}-${mention.id}`} variant="outline" className="text-[11px]">
                    {mention.label}
                  </Badge>
                ))}
              </div>
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

function MessageAttachments({ attachments }: { attachments: ChannelAttachment[] }) {
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

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function findMentionDraft(value: string, cursor: number) {
  const beforeCaret = value.slice(0, cursor);
  const match = /(^|\s)@([^\s@]*)$/.exec(beforeCaret);
  if (!match) {
    return null;
  }

  return {
    query: match[2] ?? '',
    start: beforeCaret.length - match[2].length - 1,
    end: cursor,
  };
}

function getMentionSuggestions(
  agents: WorkspaceAgent[],
  query: string | null,
  selectedMentions: ChannelMention[],
) {
  if (query === null) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const selectedIds = new Set(selectedMentions.map((mention) => mention.id));

  return agents
    .filter((agent) => !selectedIds.has(agent.id))
    .filter((agent) => {
      if (!normalizedQuery) {
        return true;
      }

      return agent.name.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 8);
}

function filterMentionsByContent(
  mentions: ChannelMention[],
  content: string,
) {
  const usageCount = new Map<string, number>();

  return mentions.filter((mention) => {
    const nextExpectedIndex = usageCount.get(mention.label) ?? 0;
    const matches = countOccurrences(content, mention.label);
    if (matches <= nextExpectedIndex) {
      return false;
    }

    usageCount.set(mention.label, nextExpectedIndex + 1);
    return true;
  });
}

function countOccurrences(content: string, value: string) {
  if (!value) {
    return 0;
  }

  let count = 0;
  let searchIndex = 0;

  while (searchIndex < content.length) {
    const foundIndex = content.indexOf(value, searchIndex);
    if (foundIndex === -1) {
      break;
    }
    count += 1;
    searchIndex = foundIndex + value.length;
  }

  return count;
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  );
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}
