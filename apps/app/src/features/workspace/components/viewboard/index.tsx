'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { updateWorkspaceFileContent } from '@/lib/api';
import { TaskDetailPanel } from '@/features/tasks';
import { cn } from '@/lib/utils';
import { dispatchWorkspaceTasksChanged } from '../tool-panel/tasks-panel';
import { SourceView } from './source-view';
import { WorkspaceDefaultView } from '../workspace-default-view';
import { useFilePreview } from './use-file-preview';
import { FilePreview } from './file-preview';

interface ViewboardProps {
  workspaceId: string;
  workspaceName?: string;
  selectedFilePath: string | null;
  openFilePaths: string[];
  selectedSourceId: string | null;
  selectedTaskId: string | null;
  fileDraftContent?: string;
  isFileDirty: (path: string) => boolean;
  onFileContentLoaded: (path: string, content: string) => void;
  onFileDraftChange: (path: string, nextContent: string, savedContent?: string) => void;
  onFileSaved: (path: string, nextContent: string) => void;
  onCloseSource: () => void;
  onCloseTask: () => void;
  onInvalidFilePath?: (path: string) => void;
  onOpenFiles?: () => void;
  onOpenSources?: () => void;
  onOpenTasks?: () => void;
  onOpenGoal?: () => void;
}

export function Viewboard({
  workspaceId,
  workspaceName,
  selectedFilePath,
  openFilePaths,
  selectedSourceId,
  selectedTaskId,
  fileDraftContent,
  isFileDirty,
  onFileContentLoaded,
  onFileDraftChange,
  onFileSaved,
  onCloseSource,
  onCloseTask,
  onInvalidFilePath,
  onOpenFiles,
  onOpenSources,
  onOpenTasks,
  onOpenGoal,
}: ViewboardProps) {
  const isShowingFile = Boolean(selectedFilePath) && !selectedSourceId && !selectedTaskId;
  const content = (() => {
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

    if (selectedSourceId) {
      return (
        <SourceView
          workspaceId={workspaceId}
          sourceId={selectedSourceId}
          onDeleted={onCloseSource}
        />
      );
    }

    if (!selectedFilePath) {
      return (
        <WorkspaceDefaultView
          workspaceName={workspaceName}
          onOpenFiles={onOpenFiles}
          onOpenSources={onOpenSources}
          onOpenTasks={onOpenTasks}
          onOpenGoal={onOpenGoal}
        />
      );
    }

    return null;
  })();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {openFilePaths.map((path) => {
          const isActive = isShowingFile && path === selectedFilePath;

          return (
            <WorkspaceFilePreviewSession
              key={path}
              workspaceId={workspaceId}
              filePath={path}
              draftContent={path === selectedFilePath ? fileDraftContent : undefined}
              isDirty={isFileDirty(path)}
              isActive={isActive}
              onFileContentLoaded={onFileContentLoaded}
              onFileDraftChange={onFileDraftChange}
              onFileSaved={onFileSaved}
              onInvalidFilePath={onInvalidFilePath}
            />
          );
        })}
        {content ? (
          <div
            className={cn(
              'min-h-0 flex-1 overflow-hidden',
              isShowingFile && 'pointer-events-none absolute inset-0 invisible',
            )}
          >
            {content}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface WorkspaceFilePreviewSessionProps {
  workspaceId: string;
  filePath: string;
  draftContent?: string;
  isDirty: boolean;
  isActive: boolean;
  onFileContentLoaded: (path: string, content: string) => void;
  onFileDraftChange: (path: string, nextContent: string, savedContent?: string) => void;
  onFileSaved: (path: string, nextContent: string) => void;
  onInvalidFilePath?: (path: string) => void;
}

function WorkspaceFilePreviewSession({
  workspaceId,
  filePath,
  draftContent,
  isDirty,
  isActive,
  onFileContentLoaded,
  onFileDraftChange,
  onFileSaved,
  onInvalidFilePath,
}: WorkspaceFilePreviewSessionProps) {
  const [hasBeenActivated, setHasBeenActivated] = useState(isActive);
  const {
    content: contentValue,
    error,
    filePath: normalizedFilePath,
    loading,
    previewKind,
    previewVersion,
    refreshBinaryPreview,
    refreshTextFile,
    setContent,
  } = useFilePreview(workspaceId, filePath, hasBeenActivated);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    setHasBeenActivated(true);
  }, [isActive]);

  const handleFileContentLoaded = useCallback(
    (nextContent: string) => {
      if (!normalizedFilePath) {
        return;
      }
      onFileContentLoaded(normalizedFilePath, nextContent);
    },
    [normalizedFilePath, onFileContentLoaded],
  );
  const handleDraftChange = useCallback(
    (nextContent: string) => {
      if (!normalizedFilePath) {
        return;
      }
      onFileDraftChange(normalizedFilePath, nextContent, contentValue);
    },
    [contentValue, normalizedFilePath, onFileDraftChange],
  );
  const handleSaveDraft = useCallback(async () => {
    if (!normalizedFilePath) {
      return;
    }

    const nextContent = draftContent ?? contentValue;
    if (typeof nextContent !== 'string') {
      return;
    }

    if (!isDirty) {
      return;
    }

    try {
      await updateWorkspaceFileContent(workspaceId, normalizedFilePath, nextContent);
      setContent(normalizedFilePath, nextContent);
      onFileSaved(normalizedFilePath, nextContent);
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save file');
      throw error;
    }
  }, [
    contentValue,
    draftContent,
    isDirty,
    normalizedFilePath,
    onFileSaved,
    setContent,
    workspaceId,
  ]);

  useEffect(() => {
    if (!normalizedFilePath || !error) {
      return;
    }

    if (error === 'Path is not a file') {
      onInvalidFilePath?.(normalizedFilePath);
    }
  }, [error, normalizedFilePath, onInvalidFilePath]);

  if (!hasBeenActivated || !normalizedFilePath) {
    return null;
  }

  return (
    <div
      className={cn(
        'min-h-0 overflow-hidden',
        isActive ? 'relative flex h-full flex-1 flex-col' : 'pointer-events-none absolute inset-0 invisible',
      )}
      aria-hidden={!isActive}
      data-active={isActive ? 'true' : 'false'}
    >
      <FilePreview
        workspaceId={workspaceId}
        filePath={normalizedFilePath}
        content={contentValue}
        error={error}
        loading={loading}
        previewKind={previewKind}
        previewVersion={previewVersion}
        onRefreshText={refreshTextFile}
        onRefreshBinary={refreshBinaryPreview}
        draftContent={draftContent}
        isDirty={isDirty}
        onTextContentLoaded={handleFileContentLoaded}
        onDraftChange={handleDraftChange}
        onSaveDraft={handleSaveDraft}
      />
    </div>
  );
}
