'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { FileCode2, FileImage, FileText, RefreshCw } from 'lucide-react';
import { TaskDetailPanel } from '@/features/tasks';
import { Loader } from '@/components/ai-elements/loader';
import { fetchWorkspaceFileContent } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { dispatchWorkspaceTasksChanged } from '../tool-panel-tasks';

interface ViewboardProps {
  workspaceId: string;
  selectedFilePath: string | null;
  selectedTaskId: string | null;
  onCloseTask: () => void;
}

type PreviewKind = 'text' | 'pdf' | 'png';

function getPreviewKind(filePath: string | null): PreviewKind {
  const normalizedPath = filePath?.toLowerCase() ?? '';

  if (normalizedPath.endsWith('.pdf')) {
    return 'pdf';
  }

  if (normalizedPath.endsWith('.png')) {
    return 'png';
  }

  return 'text';
}

function getWorkspaceFilePreviewUrl(workspaceId: string, filePath: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/files/content?path=${encodeURIComponent(filePath)}`;
}

export function Viewboard({
  workspaceId,
  selectedFilePath,
  selectedTaskId,
  onCloseTask,
}: ViewboardProps) {
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const requestIdRef = useRef(0);
  const previewKind = getPreviewKind(selectedFilePath);

  const loadFile = useEffectEvent(async (options?: { force?: boolean }) => {
    if (!selectedFilePath || !workspaceId) {
      setError(null);
      setLoading(false);
      return;
    }

    if (getPreviewKind(selectedFilePath) !== 'text') {
      setError(null);
      setLoading(false);
      return;
    }

    const force = options?.force ?? false;
    const hasCachedContent = Object.prototype.hasOwnProperty.call(fileContents, selectedFilePath);
    if (hasCachedContent && !force) {
      setError(null);
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError(null);
    setLoading(true);
    try {
      const nextContent = await fetchWorkspaceFileContent(workspaceId, selectedFilePath);
      if (requestIdRef.current !== requestId) {
        return;
      }
      setFileContents((prev) => ({
        ...prev,
        [selectedFilePath]: nextContent,
      }));
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  });

  useEffect(() => {
    requestIdRef.current += 1;
    setFileContents({});
    setError(null);
    setLoading(false);
    setPreviewVersion(0);
  }, [workspaceId]);

  useEffect(() => {
    void loadFile();
  }, [loadFile, selectedFilePath, workspaceId]);

  if (selectedTaskId) {
    return (
      <TaskDetailPanel
        taskId={selectedTaskId}
        onClose={onCloseTask}
        onUpdated={(_task) => dispatchWorkspaceTasksChanged(workspaceId)}
        onDeleted={(_taskId) => {
          dispatchWorkspaceTasksChanged(workspaceId);
          onCloseTask();
        }}
        onTasksChanged={() => dispatchWorkspaceTasksChanged(workspaceId)}
      />
    );
  }

  if (!selectedFilePath) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/60">
            <FileCode2 className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-lg font-medium text-foreground">Viewboard</h2>
          <p className="text-sm text-muted-foreground">
            Click a file in the Files panel and its content will open here.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <span className="truncate text-sm font-medium">
                {selectedFilePath.split('/').pop() ?? selectedFilePath}
              </span>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {selectedFilePath}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={() => void loadFile({ force: true })}
            title="Refresh file"
          >
            <RefreshCw className="size-4" />
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
          <div className="max-w-md text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const fileName = selectedFilePath.split('/').pop() ?? selectedFilePath;
  const content = fileContents[selectedFilePath];
  const hasContent = typeof content === 'string';
  const lineCount = hasContent ? content.split('\n').length : 0;
  const previewUrl = `${getWorkspaceFilePreviewUrl(workspaceId, selectedFilePath)}&v=${previewVersion}`;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {previewKind === 'text' ? (
              <FileText className="size-4 text-muted-foreground" />
            ) : (
              <FileImage className="size-4 text-muted-foreground" />
            )}
            <span className="truncate text-sm font-medium">{fileName}</span>
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {selectedFilePath}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {previewKind === 'text' ? (
            <span className="hidden text-xs text-muted-foreground md:inline">
              {lineCount} lines
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={() => {
              if (previewKind === 'text') {
                void loadFile({ force: true });
                return;
              }

              setPreviewVersion((current) => current + 1);
            }}
            title="Refresh file"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
        {previewKind === 'pdf' ? (
          <iframe
            key={previewUrl}
            src={previewUrl}
            title={`${fileName} preview`}
            className="h-full min-h-[32rem] w-full rounded-2xl border border-border/80 bg-background"
          />
        ) : previewKind === 'png' ? (
          <div className="flex min-h-full items-start justify-center">
            <img
              key={previewUrl}
              src={previewUrl}
              alt={fileName}
              className="h-auto max-w-full rounded-2xl border border-border/80 bg-background object-contain shadow-sm"
            />
          </div>
        ) : !hasContent && loading ? (
          <div className="flex h-full min-h-40 items-center justify-center">
            <Loader className="text-muted-foreground" />
          </div>
        ) : content?.length ? (
          <pre className="min-h-full whitespace-pre-wrap break-words font-mono text-sm leading-6 text-foreground">
            {content}
          </pre>
        ) : (
          <div className="flex h-full min-h-40 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/25 p-6 text-center">
            <div>
              <p className="text-sm font-medium text-foreground">Empty file</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {fileName} exists, but there is no content to preview yet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
