'use client';

import { ChevronRight, FileText, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateInput } from './create-input';
import { RenameInput } from './rename-input';
import { TreeItemWrapper } from './tree-item-wrapper';
import type { ExplorerNode } from './use-workspace-file-tree';

interface TreeProps {
  activePath: string | null;
  creatingAt: { parentPath: string; type: 'file' | 'folder' } | null;
  draggingPath: string | null;
  dropTargetPath: string | null;
  item: ExplorerNode;
  level?: number;
  onCancelCreate: () => void;
  onCancelRename: () => void;
  onCreate: (parentPath: string, name: string, type: 'file' | 'folder') => void;
  onDelete: (path: string) => void;
  onFileSelect: (path: string) => void;
  onCopyPath: (path: string) => void;
  onCopyRelativePath: (path: string) => void;
  onMove: (path: string, destinationPath: string) => void;
  onStartCreate: (parentPath: string, type: 'file' | 'folder') => void;
  onSetDraggingPath: (path: string | null) => void;
  onSetDropTargetPath: (path: string | null) => void;
  onStartRename: (path: string) => void;
  onToggleFolder: (path: string, open: boolean) => void;
  onRename: (path: string, nextName: string) => void;
  renamingPath: string | null;
}

export function Tree({
  activePath,
  creatingAt,
  draggingPath,
  dropTargetPath,
  item,
  level = 0,
  onCancelCreate,
  onCancelRename,
  onCreate,
  onDelete,
  onFileSelect,
  onCopyPath,
  onCopyRelativePath,
  onMove,
  onSetDraggingPath,
  onSetDropTargetPath,
  onStartCreate,
  onStartRename,
  onToggleFolder,
  onRename,
  renamingPath,
}: TreeProps) {
  const isOpen = Boolean(item.children);
  const isCreatingHere = creatingAt?.parentPath === item.path;
  const isDropTarget = dropTargetPath === item.path;
  const isRenaming = renamingPath === item.path;

  if (item.type === 'file') {
    if (isRenaming) {
      return (
        <RenameInput
          type="file"
          defaultValue={item.name}
          level={level}
          onSubmit={(nextName) => onRename(item.path, nextName)}
          onCancel={onCancelRename}
        />
      );
    }

    return (
      <TreeItemWrapper
        item={item}
        level={level}
        isActive={activePath === item.path}
        onClick={() => onFileSelect(item.path)}
        onDoubleClick={() => onFileSelect(item.path)}
        onDragEnd={() => {
          onSetDraggingPath(null);
          onSetDropTargetPath(null);
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', item.path);
          onSetDraggingPath(item.path);
        }}
        onRename={() => onStartRename(item.path)}
        onCopyPath={() => onCopyPath(item.path)}
        onCopyRelativePath={() => onCopyRelativePath(item.path)}
        onDelete={() => onDelete(item.path)}
      >
        <FileText className="size-4 shrink-0 text-[#8a8a8a]" />
        <span className="truncate text-[15px] text-[#313131]">{item.name}</span>
      </TreeItemWrapper>
    );
  }

  const folderChildren = item.children ?? [];

  return (
    <>
      {isRenaming ? (
        <RenameInput
          type="folder"
          defaultValue={item.name}
          isOpen={isOpen}
          level={level}
          onSubmit={(nextName) => onRename(item.path, nextName)}
          onCancel={onCancelRename}
        />
      ) : (
        <TreeItemWrapper
          item={item}
          level={level}
          isActive={isDropTarget}
          onClick={() => onToggleFolder(item.path, !isOpen)}
          onDragEnd={() => {
            onSetDraggingPath(null);
            onSetDropTargetPath(null);
          }}
          onDragLeave={() => {
            if (dropTargetPath === item.path) {
              onSetDropTargetPath(null);
            }
          }}
          onDragOver={(event) => {
            if (!draggingPath || draggingPath === item.path || draggingPath.startsWith(`${item.path}/`)) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            onSetDropTargetPath(item.path);
          }}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.path);
            onSetDraggingPath(item.path);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const draggedPath = event.dataTransfer.getData('text/plain');
            onSetDropTargetPath(null);
            onSetDraggingPath(null);
            if (!draggedPath || draggedPath === item.path || draggedPath.startsWith(`${item.path}/`)) {
              return;
            }
            onMove(draggedPath, item.path);
          }}
          onToggle={() => onToggleFolder(item.path, !isOpen)}
          onRename={() => onStartRename(item.path)}
          onCopyPath={() => onCopyPath(item.path)}
          onCopyRelativePath={() => onCopyRelativePath(item.path)}
          onDelete={() => onDelete(item.path)}
          onCreateFile={() => onStartCreate(item.path, 'file')}
          onCreateFolder={() => onStartCreate(item.path, 'folder')}
        >
          {item.hasChildren ? (
            <ChevronRight
              className={cn('size-4 shrink-0 text-[#8f8f8f] transition-transform', isOpen && 'rotate-90')}
            />
          ) : (
            <span className="size-4 shrink-0" />
          )}
          <Folder className="size-4 shrink-0 fill-[#d8ebff] text-[#4a90e2]" />
          <span className="truncate text-[15px] text-[#313131]">{item.name}</span>
        </TreeItemWrapper>
      )}

      {isOpen && (
        <>
          {isCreatingHere ? (
            <CreateInput
              type={creatingAt.type}
              level={level + 1}
              onSubmit={(name) => onCreate(item.path, name, creatingAt.type)}
              onCancel={onCancelCreate}
            />
          ) : null}
          {folderChildren.map((child) => (
            <Tree
              key={child.path}
              activePath={activePath}
              creatingAt={creatingAt}
              draggingPath={draggingPath}
              dropTargetPath={dropTargetPath}
              item={child}
              level={level + 1}
              onCancelCreate={onCancelCreate}
              onCancelRename={onCancelRename}
              onCreate={onCreate}
              onDelete={onDelete}
              onFileSelect={onFileSelect}
              onCopyPath={onCopyPath}
              onCopyRelativePath={onCopyRelativePath}
              onMove={onMove}
              onSetDraggingPath={onSetDraggingPath}
              onSetDropTargetPath={onSetDropTargetPath}
              onStartCreate={onStartCreate}
              onStartRename={onStartRename}
              onToggleFolder={onToggleFolder}
              onRename={onRename}
              renamingPath={renamingPath}
            />
          ))}
        </>
      )}
    </>
  );
}
