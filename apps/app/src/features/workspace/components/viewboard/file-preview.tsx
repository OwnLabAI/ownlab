'use client';

import { FileImage, FileText, FileWarning, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Loader } from '@/components/ai-elements/loader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getFileExtension,
  getFilePreviewUrl,
  isMarkdownFile,
  type LatexPreviewKind,
} from './use-file-preview';
import { CodeFileView } from './code-file-view';
import { LatexFileView } from './latex-file-view';
import { MarkdownFileView } from './markdown-file-view';
import { PdfPreviewFrame } from './pdf-preview-frame';

interface FilePreviewProps {
  workspaceId: string;
  filePath: string;
  content?: string;
  error: string | null;
  loading: boolean;
  previewKind: LatexPreviewKind;
  previewVersion: number;
  onRefreshText: () => void;
  onRefreshBinary: () => void;
  draftContent?: string;
  isDirty: boolean;
  onTextContentLoaded: (content: string) => void;
  onDraftChange: (nextContent: string) => void;
  onSaveDraft: () => Promise<void>;
}

export function FilePreview({
  workspaceId,
  filePath,
  content,
  error,
  loading,
  previewKind,
  previewVersion,
  onRefreshText,
  onRefreshBinary,
  draftContent,
  isDirty,
  onTextContentLoaded,
  onDraftChange,
  onSaveDraft,
}: FilePreviewProps) {
  const fileName = filePath.split('/').pop() ?? filePath;
  const fileExtension = getFileExtension(filePath);
  const previewUrl = `${getFilePreviewUrl(workspaceId, filePath)}&v=${previewVersion}`;
  const editableContent = typeof content === 'string' ? (draftContent ?? content) : content;
  const showPreviewHeader = previewKind !== 'pdf';

  useEffect(() => {
    if (typeof content !== 'string') {
      return;
    }

    if (isMarkdownFile(filePath) || previewKind === 'latex' || previewKind === 'text') {
      onTextContentLoaded(content);
    }
  }, [content, filePath, onTextContentLoaded, previewKind]);

  if (error) {
    return (
      <div className="ownlab-viewboard-scroll flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-4 py-3">
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
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <div className="max-w-md text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isMarkdownFile(filePath) && typeof content === 'string') {
    return (
      <MarkdownFileView
        filePath={filePath}
        content={typeof editableContent === 'string' ? editableContent : content}
        onChange={onDraftChange}
        onSave={onSaveDraft}
      />
    );
  }

  if (previewKind === 'latex' && typeof content === 'string') {
    return (
      <LatexFileView
        workspaceId={workspaceId}
        filePath={filePath}
        content={typeof editableContent === 'string' ? editableContent : content}
        isDirty={isDirty}
        onChange={onDraftChange}
        onSave={onSaveDraft}
      />
    );
  }

  if (previewKind === 'text' && typeof content === 'string') {
    return (
      <CodeFileView
        filePath={filePath}
        content={typeof editableContent === 'string' ? editableContent : content}
        onChange={onDraftChange}
        onSave={onSaveDraft}
      />
    );
  }

  return (
    <div className="ownlab-viewboard-scroll flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      {showPreviewHeader ? (
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-4 py-3">
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
      ) : null}
      <div
        className={cn(
          'min-h-0 flex-1 overflow-x-hidden',
          previewKind === 'pdf' ? 'bg-muted/10 px-0 py-0' : 'p-4',
        )}
      >
        {previewKind === 'pdf' ? (
          <PdfPreviewFrame
            src={previewUrl}
            title={fileName}
            onRefresh={onRefreshBinary}
            className="h-full min-h-[32rem] w-full"
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
