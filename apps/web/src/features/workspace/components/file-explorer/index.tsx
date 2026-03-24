'use client';

import { RefreshCw, FilePlus2, FolderPlus, ChevronDown, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CreateInput } from './create-input';
import { LoadingRow } from './loading-row';
import { Tree } from './tree';
import { useWorkspaceFileTree } from './use-workspace-file-tree';

interface FileExplorerProps {
  workspaceId: string;
  workspaceName: string;
  onFileSelect?: (path: string | null) => void;
}

export function FileExplorer({ workspaceId, workspaceName, onFileSelect }: FileExplorerProps) {
  const {
    createEntry,
    deleteEntry,
    error,
    isLoading,
    isRefreshing,
    moveEntry,
    nodes,
    refreshTree,
    renameEntry,
    rootName,
    rootPath,
    toggleFolder,
  } = useWorkspaceFileTree(workspaceId);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [creatingAt, setCreatingAt] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  async function handleCreate(parentPath: string, name: string, type: 'file' | 'folder') {
    try {
      await createEntry(parentPath, name, type);
      setCreatingAt(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create entry');
    }
  }

  async function handleDelete(path: string) {
    try {
      await deleteEntry(path);
      if (activePath === path || activePath?.startsWith(`${path}/`)) {
        setActivePath(null);
        onFileSelect?.(null);
      }
      if (renamingPath === path) {
        setRenamingPath(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  }

  async function handleRename(path: string, nextName: string) {
    try {
      const renamed = await renameEntry(path, nextName);
      if (activePath === path) {
        setActivePath(renamed.path);
        onFileSelect?.(renamed.path);
      } else if (activePath?.startsWith(`${path}/`)) {
        const nestedPath = activePath.slice(path.length + 1);
        const nextSelectedPath = `${renamed.path}/${nestedPath}`;
        setActivePath(nextSelectedPath);
        onFileSelect?.(nextSelectedPath);
      }
      setRenamingPath(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename entry');
    }
  }

  async function handleToggleFolder(path: string, open: boolean) {
    try {
      await toggleFolder(path, open);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load folder');
    }
  }

  async function handleStartCreate(parentPath: string, type: 'file' | 'folder') {
    try {
      if (parentPath) {
        await toggleFolder(parentPath, true);
      }
      setRenamingPath(null);
      setCreatingAt({ parentPath, type });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare folder');
    }
  }

  async function handleMove(path: string, destinationPath: string) {
    try {
      const moved = await moveEntry(path, destinationPath);
      if (activePath === path) {
        setActivePath(moved.path);
        onFileSelect?.(moved.path);
      } else if (activePath?.startsWith(`${path}/`)) {
        const nestedPath = activePath.slice(path.length + 1);
        const nextSelectedPath = `${moved.path}/${nestedPath}`;
        setActivePath(nextSelectedPath);
        onFileSelect?.(nextSelectedPath);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to move entry');
    }
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy to clipboard');
    }
  }

  async function handleCopyPath(relativePath: string) {
    const normalizedRoot = rootPath.replace(/[\\/]+$/, '');
    const normalizedRelative = relativePath.replace(/^[\\/]+/, '');
    const absolutePath =
      normalizedRoot && normalizedRelative
        ? `${normalizedRoot}/${normalizedRelative}`
        : normalizedRoot || normalizedRelative;
    await copyToClipboard(absolutePath, 'Absolute path copied');
  }

  async function handleCopyRelativePath(relativePath: string) {
    await copyToClipboard(relativePath, 'Relative path copied');
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="flex items-center justify-between px-2 pb-3 pt-1">
        <div className="flex min-w-0 items-center gap-2 text-foreground">
          <FolderOpen className="mt-0.5 size-4 text-primary" />
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[15px] font-medium">{rootName || workspaceName || 'Workspace'}</span>
            <ChevronDown className="mt-0.5 size-3 text-muted-foreground" />
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-full hover:bg-accent/70"
            title="Refresh"
            onClick={() => void refreshTree()}
          >
            <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-full hover:bg-accent/70"
            title="New File"
            onClick={() => void handleStartCreate('', 'file')}
          >
            <FilePlus2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-full hover:bg-accent/70"
            title="New Folder"
            onClick={() => void handleStartCreate('', 'folder')}
          >
            <FolderPlus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mb-2 border-b border-border/60" />

      <div className="flex h-full min-h-0 flex-col bg-transparent">
        <ScrollArea className="min-h-0 flex-1">
          <div
            className={cn(
              'min-h-full pb-3',
              dropTargetPath === '' && 'rounded-2xl bg-accent/45',
            )}
            onDragLeave={() => {
              if (dropTargetPath === '') {
                setDropTargetPath(null);
              }
            }}
            onDragOver={(event) => {
              if (!draggingPath) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropTargetPath('');
            }}
            onDrop={(event) => {
              event.preventDefault();
              const draggedPath = event.dataTransfer.getData('text/plain');
              setDropTargetPath(null);
              setDraggingPath(null);
              if (!draggedPath) {
                return;
              }
              void handleMove(draggedPath, '');
            }}
          >
          {error ? (
            <div className="px-2 py-4 text-sm text-destructive">{error}</div>
          ) : null}

          {isLoading ? <LoadingRow level={0} /> : null}

          {!isLoading && creatingAt?.parentPath === '' ? (
            <CreateInput
              type={creatingAt.type}
              level={0}
              onSubmit={(name) => void handleCreate('', name, creatingAt.type)}
              onCancel={() => setCreatingAt(null)}
            />
          ) : null}

          {!isLoading && nodes.length === 0 && !creatingAt ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              <FolderOpen className="mx-auto mb-2 size-5 text-primary" />
              <div>This folder is empty</div>
            </div>
          ) : null}

          {nodes.map((item) => (
            <Tree
              key={item.path}
              activePath={activePath}
              creatingAt={creatingAt}
              draggingPath={draggingPath}
              dropTargetPath={dropTargetPath}
              item={item}
              onCancelCreate={() => setCreatingAt(null)}
              onCancelRename={() => setRenamingPath(null)}
              onCreate={(parentPath, name, type) => void handleCreate(parentPath, name, type)}
              onDelete={(path) => void handleDelete(path)}
              onFileSelect={(path) => {
                setCreatingAt(null);
                setDraggingPath(null);
                setDropTargetPath(null);
                setRenamingPath(null);
                setActivePath(path);
                onFileSelect?.(path);
              }}
              onCopyPath={(path) => void handleCopyPath(path)}
              onCopyRelativePath={(path) => void handleCopyRelativePath(path)}
              onMove={(path, destinationPath) => void handleMove(path, destinationPath)}
              onSetDraggingPath={setDraggingPath}
              onSetDropTargetPath={setDropTargetPath}
              onStartCreate={(parentPath, type) => void handleStartCreate(parentPath, type)}
              onStartRename={(path) => {
                setCreatingAt(null);
                setRenamingPath(path || null);
              }}
              onToggleFolder={(path, open) => void handleToggleFolder(path, open)}
              onRename={(path, nextName) => void handleRename(path, nextName)}
              renamingPath={renamingPath}
            />
          ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
