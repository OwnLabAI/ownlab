'use client';

import { ChevronRight, FileText } from 'lucide-react';
import { useState } from 'react';
import { MarkdownEditor } from '@/components/markdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CodeEditor } from './code-editor';

interface MarkdownFileViewProps {
  filePath: string;
  content: string;
  onChange: (nextContent: string) => void;
  onSave: () => void | Promise<void>;
}

export function MarkdownFileView({ filePath, content, onChange, onSave }: MarkdownFileViewProps) {
  const [mode, setMode] = useState<'preview' | 'markdown'>('preview');
  const pathSegments = filePath.split('/').filter(Boolean);
  const fileName = pathSegments[pathSegments.length - 1] ?? filePath;
  const parentSegments = pathSegments.slice(0, -1);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          event.stopPropagation();
          void onSave();
        }
      }}
    >
      <header className="shrink-0 border-b border-border/70 bg-background px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex items-center overflow-hidden text-muted-foreground">
              {parentSegments.length > 0 ? (
                <>
                  <span className="truncate">{parentSegments.join(' / ')}</span>
                  <ChevronRight className="mx-1 size-3.5 shrink-0 text-muted-foreground/70" />
                </>
              ) : null}
              <span className="truncate font-medium text-foreground">{fileName}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant={mode === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 rounded-md px-3 text-sm shadow-none',
                mode === 'preview'
                  ? 'border border-border/70 bg-muted/60 text-foreground hover:bg-muted/60'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => {
                if (mode === 'preview') {
                  return;
                }

                setMode('preview');
              }}
            >
              Preview
            </Button>
            <Button
              type="button"
              variant={mode === 'markdown' ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 rounded-md px-3 text-sm shadow-none',
                mode === 'markdown'
                  ? 'border border-border/70 bg-muted/60 text-foreground hover:bg-muted/60'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setMode('markdown')}
            >
              Markdown
            </Button>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === 'preview' ? (
          <div className="ownlab-viewboard-scroll h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-[980px] px-8 pb-10 pt-6">
              <MarkdownEditor
                markdown={content}
                onChange={(nextValue) => {
                  onChange(nextValue);
                }}
                bordered={false}
                className="bg-transparent"
                contentClassName={cn(
                  'ownlab-source-article min-h-[calc(100vh-14rem)] text-[1rem] leading-8 text-foreground',
                  '[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4',
                  '[&_img]:my-6 [&_img]:w-full [&_img]:rounded-2xl',
                  '[&_p]:text-foreground',
                  '[&_strong]:font-semibold [&_strong]:text-foreground',
                  '[&_blockquote]:border-border/70 [&_blockquote]:text-muted-foreground',
                  '[&_pre]:border [&_pre]:border-border/70 [&_pre]:bg-muted/40 [&_pre]:text-foreground',
                  '[&_code]:bg-muted/60 [&_code]:text-foreground',
                )}
              />
            </div>
          </div>
        ) : (
          <div className="min-h-0 h-full overflow-hidden">
            <CodeEditor
              filePath={filePath}
              language="markdown"
              value={content}
              onChange={onChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
