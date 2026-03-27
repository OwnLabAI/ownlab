'use client';

import { FileImage, FileText, FileWarning, RefreshCw } from 'lucide-react';
import { Loader } from '@/components/ai-elements/loader';
import { Button } from '@/components/ui/button';
import {
  getFileExtension,
  getWorkspaceFilePreviewUrl,
  isMarkdownFile,
  type PreviewKind,
} from './use-workspace-file-preview';
import { WorkspaceMarkdownFileView } from './workspace-markdown-file-view';

interface WorkspaceFilePreviewProps {
  workspaceId: string;
  filePath: string;
  content?: string;
  error: string | null;
  loading: boolean;
  previewKind: PreviewKind;
  previewVersion: number;
  onRefreshText: () => void;
  onRefreshBinary: () => void;
  onMarkdownSaved: (nextContent: string) => void;
}

export function WorkspaceFilePreview({
  workspaceId,
  filePath,
  content,
  error,
  loading,
  previewKind,
  previewVersion,
  onRefreshText,
  onRefreshBinary,
  onMarkdownSaved,
}: WorkspaceFilePreviewProps) {
  const fileName = filePath.split('/').pop() ?? filePath;
  const fileExtension = getFileExtension(filePath);
  const previewUrl = `${getWorkspaceFilePreviewUrl(workspaceId, filePath)}&v=${previewVersion}`;

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="truncate text-base font-medium text-foreground">{fileName}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={onRefreshText}
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

  if (isMarkdownFile(filePath) && typeof content === 'string') {
    return (
      <WorkspaceMarkdownFileView
        workspaceId={workspaceId}
        filePath={filePath}
        content={content}
        onSaved={onMarkdownSaved}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {previewKind === 'text' ? (
              <FileText className="size-4 text-muted-foreground" />
            ) : previewKind === 'unsupported' ? (
              <FileWarning className="size-4 text-muted-foreground" />
            ) : (
              <FileImage className="size-4 text-muted-foreground" />
            )}
            <span className="truncate text-sm font-medium">{fileName}</span>
          </div>
        </div>
        {previewKind !== 'unsupported' ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={previewKind === 'text' ? onRefreshText : onRefreshBinary}
            title="Refresh file"
          >
            <RefreshCw className="size-4" />
          </Button>
        ) : null}
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
        ) : previewKind === 'unsupported' ? (
          <div className="flex h-full min-h-40 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/25 p-6 text-center">
            <div className="max-w-md">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                <FileWarning className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Preview not supported yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {fileExtension || 'This file type'} cannot be previewed in the viewboard yet. You can
                still keep it in the workspace and open it with a local editor when needed.
              </p>
            </div>
          </div>
        ) : typeof content !== 'string' && loading ? (
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
