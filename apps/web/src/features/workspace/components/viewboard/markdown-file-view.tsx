'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownEditor } from '@/components/markdown';
import { Button } from '@/components/ui/button';
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
  const [isSaving, startSaveTransition] = useTransition();
  const latestSavedRef = useRef(content);

  useEffect(() => {
    setDraft(content);
    latestSavedRef.current = content;
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
        <h2 className="truncate text-base font-medium text-foreground">{filePath.split('/').pop() ?? filePath}</h2>
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
      </div>
    </div>
  );
}
