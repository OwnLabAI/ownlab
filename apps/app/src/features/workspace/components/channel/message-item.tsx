'use client';

import type { ComponentProps } from 'react';
import { toast } from 'sonner';
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
} from '@/components/ai-elements/attachments';
import {
  Message,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ChannelAttachment, ChannelMessage } from '@/lib/api';
import { MessageCopyButton } from '@/features/channels/components/message-copy-button';
import { getLocalWorkspaceTarget, isHttpUrl } from './link-utils';

interface ChannelMessageItemProps {
  message: ChannelMessage;
  appearance?: 'default' | 'floating';
  markdownComponents?: ComponentProps<typeof MessageResponse>['components'];
}

export function ChannelMessageItem({
  message,
  appearance = 'default',
  markdownComponents,
}: ChannelMessageItemProps) {
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
                <MessageResponse components={markdownComponents}>{message.content}</MessageResponse>
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

export function WorkspaceMessageLink({
  href,
  children,
  className,
  workspaceRootPath,
  onOpenLocalPath,
  ...props
}: ComponentProps<'a'> & {
  node?: unknown;
  workspaceRootPath: string | null;
  onOpenLocalPath: (relativePath: string) => void;
}) {
  const localTarget = getLocalWorkspaceTarget(
    href,
    workspaceRootPath,
    typeof window !== 'undefined' ? window.location.origin : null,
  );
  const linkClassName = cn('underline underline-offset-4 hover:text-primary', className);

  if (localTarget) {
    return (
      <button
        type="button"
        className={cn('inline cursor-pointer text-left', linkClassName)}
        onClick={() => {
          if (!localTarget.relativePath || localTarget.looksLikeDirectory) {
            toast.info('Local folders are not previewable in the viewboard yet.');
            return;
          }
          onOpenLocalPath(localTarget.relativePath);
        }}
        title={href}
      >
        {children}
      </button>
    );
  }

  if (isHttpUrl(href)) {
    return (
      <a
        {...props}
        href={href}
        className={linkClassName}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <a {...props} href={href} className={linkClassName}>
      {children}
    </a>
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
