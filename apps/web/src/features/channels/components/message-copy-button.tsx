'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MessageAction } from '@/components/ai-elements/message';

interface MessageCopyButtonProps {
  content: string;
  align?: 'left' | 'right';
}

export function MessageCopyButton({
  content,
  align = 'left',
}: MessageCopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsCopied(false);
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isCopied]);

  const handleCopy = useCallback(async () => {
    const text = content.trim();
    if (!text) {
      return;
    }

    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      toast.error('Clipboard is not available in this browser');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy message');
    }
  }, [content]);

  return (
    <MessageAction
      tooltip={isCopied ? 'Copied' : 'Copy message'}
      label={isCopied ? 'Copied' : 'Copy message'}
      onClick={() => void handleCopy()}
      className={align === 'right' ? 'order-first' : undefined}
    >
      {isCopied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </MessageAction>
  );
}
