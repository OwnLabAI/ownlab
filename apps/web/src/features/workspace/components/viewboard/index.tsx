'use client';

import { TaskDetailPanel } from '@/features/tasks';
import { dispatchWorkspaceTasksChanged } from '../tool-panel-tasks';
import { WorkspaceDefaultView } from '../workspace-default-view';
import { WorkspacePluginView } from './workspace-plugin-view';
import { useWorkspaceFilePreview } from './use-workspace-file-preview';
import { WorkspaceFilePreview } from './workspace-file-preview';

interface ViewboardProps {
  workspaceId: string;
  workspaceName?: string;
  selectedFilePath: string | null;
  selectedTaskId: string | null;
  selectedPluginId: string | null;
  onCloseTask: () => void;
  onOpenFiles?: () => void;
  onOpenTasks?: () => void;
  onOpenGoal?: () => void;
  onOpenPlugins?: () => void;
}

export function Viewboard({
  workspaceId,
  workspaceName,
  selectedFilePath,
  selectedTaskId,
  selectedPluginId,
  onCloseTask,
  onOpenFiles,
  onOpenTasks,
  onOpenGoal,
  onOpenPlugins,
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

  if (selectedPluginId) {
    return (
      <WorkspacePluginView
        workspaceId={workspaceId}
        pluginId={selectedPluginId}
      />
    );
  }

  if (!selectedFilePath) {
    return (
      <WorkspaceDefaultView
        workspaceName={workspaceName}
        onOpenFiles={onOpenFiles}
        onOpenTasks={onOpenTasks}
        onOpenGoal={onOpenGoal}
        onOpenPlugins={onOpenPlugins}
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
