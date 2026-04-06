'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Edit3, Eye, Save } from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownBody, MarkdownEditor } from '@/components/markdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateWorkspaceFileContent } from '@/lib/api';

interface WorkspaceMarkdownFileViewProps {
  workspaceId: string;
  filePath: string;
  content: string;
  onSaved: (nextContent: string) => void;
}

export function WorkspaceMarkdownFileView({
  workspaceId,
  filePath,
  content,
  onSaved,
}: WorkspaceMarkdownFileViewProps) {
  const [draft, setDraft] = useState(content);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [isSaving, startSaveTransition] = useTransition();
  const latestSavedRef = useRef(content);

  useEffect(() => {
    setDraft(content);
    latestSavedRef.current = content;
    setMode('preview');
  }, [content, filePath]);

  const hasUnsavedChanges = draft !== latestSavedRef.current;
  const lineCount = useMemo(() => (draft ? draft.split('\n').length : 0), [draft]);

  function handleSave() {
    if (!hasUnsavedChanges) {
      return;
    }

    startSaveTransition(async () => {
      try {
        await updateWorkspaceFileContent(workspaceId, filePath, draft);
        latestSavedRef.current = draft;
        onSaved(draft);
      } catch (error) {
        console.error('Failed to save markdown file:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save markdown file');
      }
    });
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          event.stopPropagation();
          handleSave();
        }
      }}
    >
      <header className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="truncate text-base font-medium text-foreground">{filePath.split('/').pop() ?? filePath}</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={mode === 'preview' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('preview')}
            >
              <Eye className="size-4" />
              Preview
            </Button>
            <Button
              type="button"
              variant={mode === 'edit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('edit')}
            >
              <Edit3 className="size-4" />
              Edit
            </Button>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs text-muted-foreground">{lineCount > 0 ? `${lineCount} lines` : 'Empty file'}</div>
          <Button
            type="button"
            variant={hasUnsavedChanges ? 'default' : 'outline'}
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
          >
            <Save className="size-4" />
            Save
          </Button>
        </div>
        {mode === 'preview' ? (
          <div className="px-4 pb-8">
            <div className="rounded-[1.5rem] border border-border/60 bg-card/70 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
              {draft.trim() ? (
                <MarkdownBody
                  markdown={draft}
                  className={cn(
                    'ownlab-source-article text-[1rem] leading-8 text-foreground',
                    '[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4',
                    '[&_img]:my-6 [&_img]:w-full [&_img]:rounded-2xl',
                    '[&_p]:text-foreground',
                    '[&_strong]:font-semibold [&_strong]:text-foreground',
                    '[&_blockquote]:border-border/70 [&_blockquote]:text-muted-foreground',
                    '[&_pre]:border [&_pre]:border-border/70 [&_pre]:bg-muted/40 [&_pre]:text-foreground',
                    '[&_code]:bg-muted/60 [&_code]:text-foreground',
                  )}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">Empty markdown file</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Switch to Edit mode to start writing.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 pb-6">
            <MarkdownEditor
              markdown={draft}
              onChange={setDraft}
              placeholder="Write markdown..."
              bordered={false}
              className="bg-transparent"
              contentClassName="ownlab-workspace-markdown-content min-h-[24rem]"
              autoFocus={false}
              onBlur={handleSave}
              onSubmit={handleSave}
            />
          </div>
        )}
      </div>
    </div>
  );
}
