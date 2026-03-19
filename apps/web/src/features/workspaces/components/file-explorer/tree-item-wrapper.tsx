'use client';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { getItemPadding } from './constants';
import type { FileTreeNode } from '@/lib/api';

export function TreeItemWrapper({
  item,
  children,
  level,
  isActive,
  onClick,
  onDoubleClick,
  onToggle,
  onDragEnd,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDrop,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
  onCopyPath,
  onCopyRelativePath,
}: {
  item: FileTreeNode;
  children: React.ReactNode;
  level: number;
  isActive?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onToggle?: () => void;
  onDragEnd?: () => void;
  onDragLeave?: () => void;
  onDragOver?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragStart?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onRename?: () => void;
  onDelete?: () => void;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onCopyPath?: () => void;
  onCopyRelativePath?: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          draggable
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onDragEnd={onDragEnd}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDragStart={onDragStart}
          onDrop={onDrop}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onClick?.();
            }
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              onToggle?.();
            }
          }}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-xl pr-2 text-left outline-none transition-colors focus:ring-1 focus:ring-inset focus:ring-ring/60 hover:bg-white/70',
            isActive && 'bg-white/92 shadow-[0_1px_0_rgba(255,255,255,0.85),0_8px_16px_rgba(15,23,42,0.04)]',
          )}
          style={{ paddingLeft: getItemPadding(level, item.type === 'file') }}
        >
          {children}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()} className="w-64">
        {item.type === 'folder' && (
          <>
            <ContextMenuItem onClick={onCreateFile} className="text-sm">
              New File
            </ContextMenuItem>
            <ContextMenuItem onClick={onCreateFolder} className="text-sm">
              New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={onRename} className="text-sm">
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopyPath} className="text-sm">
          Copy Path
        </ContextMenuItem>
        <ContextMenuItem onClick={onCopyRelativePath} className="text-sm">
          Copy Relative Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete} className="text-sm">
          Delete Permanently
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
