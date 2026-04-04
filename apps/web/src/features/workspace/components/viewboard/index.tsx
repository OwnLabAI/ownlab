'use client';

import { TaskDetailPanel } from '@/features/tasks';
import { dispatchWorkspaceTasksChanged } from '../tool-panel/tasks-panel';
import { WorkspaceSourceView } from './source-view';
import { WorkspaceDefaultView } from '../workspace-default-view';
import { useWorkspaceFilePreview } from './use-file-preview';
import { WorkspaceFilePreview } from './file-preview';

interface ViewboardProps {
  workspaceId: string;
  workspaceName?: string;
  selectedFilePath: string | null;
  selectedSourceId: string | null;
  selectedTaskId: string | null;
  onCloseSource: () => void;
  onCloseTask: () => void;
  onOpenFiles?: () => void;
  onOpenSources?: () => void;
  onOpenTasks?: () => void;
  onOpenGoal?: () => void;
}

export function Viewboard({
  workspaceId,
  workspaceName,
  selectedFilePath,
  selectedSourceId,
  selectedTaskId,
  onCloseSource,
  onCloseTask,
  onOpenFiles,
  onOpenSources,
  onOpenTasks,
  onOpenGoal,
}: ViewboardProps) {
  const {
    content,
    error,
    loading,
    previewKind,
    previewVersion,
    refreshBinaryPreview,
    refreshTextFile,
    setContent,
  } = useWorkspaceFilePreview(workspaceId, selectedFilePath);

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
      <WorkspaceSourceView
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

  return (
    <WorkspaceFilePreview
      workspaceId={workspaceId}
      filePath={selectedFilePath}
      content={content}
      error={error}
      loading={loading}
      previewKind={previewKind}
      previewVersion={previewVersion}
      onRefreshText={refreshTextFile}
      onRefreshBinary={refreshBinaryPreview}
      onMarkdownSaved={(nextContent) => setContent(selectedFilePath, nextContent)}
    />
  );
}
