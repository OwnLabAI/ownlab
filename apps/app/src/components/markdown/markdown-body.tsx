'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownBodyProps {
  markdown: string;
  className?: string;
}

export function MarkdownBody({ markdown, className }: MarkdownBodyProps) {
  return (
    <div
      className={cn(
        'ownlab-markdown-body max-w-none text-sm leading-7 text-foreground',
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </div>
  );
}
