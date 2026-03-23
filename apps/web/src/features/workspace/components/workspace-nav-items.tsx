'use client';

import { useState, useTransition } from 'react';
import {
  ChevronRight,
  Edit,
  File,
  FileText,
  Folder,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { deleteItem, renameItem } from '@/features/workspace/actions/items';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import type { Item } from '@/features/workspace/data/items';
import { cn } from '@/lib/utils';

interface WorkspaceNavItemsProps {
  items: Item[];
  onItemDeleted?: (itemId: string) => void;
  onItemUpdated?: (item: Item) => void;
}

function ItemRow({
  item,
  level,
  expandedIds,
  onToggle,
  onDeleted,
  onUpdated,
}: {
  item: Item;
  level: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onDeleted?: (id: string) => void;
  onUpdated?: (item: Item) => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(item.name);
  const [pending, startTransition] = useTransition();
  const isFolder = item.kind === 'folder';
  const isExpanded = expandedIds.has(item.id);

  const Icon =
    item.kind === 'folder'
      ? Folder
      : item.kind === 'note'
        ? FileText
        : File;
  const iconColor =
    item.kind === 'folder'
      ? 'text-amber-500'
      : item.kind === 'note'
        ? 'text-blue-500'
        : 'text-red-500';

  const handleRename = () => {
    if (!newName.trim() || newName === item.name) {
      setRenameOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await renameItem({ itemId: item.id, newName: newName.trim() });
      if (result?.data?.success) {
        onUpdated?.({ ...item, name: newName.trim() });
        toast.success('Renamed');
        setRenameOpen(false);
      } else {
        toast.error(result?.data?.error ?? 'Rename failed');
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteItem({ itemId: item.id });
      if (result?.data?.success) {
        onDeleted?.(item.id);
        toast.success('Deleted');
      } else {
        toast.error(result?.data?.error ?? 'Delete failed');
      }
    });
  };

  return (
    <>
      <div
        className={cn(
          'group flex items-center h-8 w-full pr-2 rounded-md gap-1',
          'hover:bg-muted/50',
        )}
        style={{ paddingLeft: `${level * 1.25}rem` }}
      >
        {isFolder ? (
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            className="p-1 rounded-sm hover:bg-muted shrink-0"
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform shrink-0',
                isExpanded && 'rotate-90',
              )}
            />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
        <span className="truncate text-sm flex-1">{item.name}</span>
        <DropdownMenu>
          <DropdownMenuTrigger id={`workspace-item-menu-trigger-${item.id}`} asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>
              Enter a new name for this item.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={pending || !newName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WorkspaceNavItems({
  items: initialItems,
  onItemDeleted,
  onItemUpdated,
}: WorkspaceNavItemsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleted = (itemId: string) => {
    onItemDeleted?.(itemId);
  };

  const handleUpdated = (updated: Item) => {
    onItemUpdated?.(updated);
  };

  if (initialItems.length === 0) {
    return (
      <SidebarGroup>
        <div className="px-4 py-2 text-sm text-muted-foreground">
          No items. Use &quot;New&quot; to add a note or folder.
        </div>
      </SidebarGroup>
    );
  }

  const rootItems = initialItems.filter((i) => i.parentId === null);

  const renderTree = (item: Item, level: number) => {
    const children = initialItems.filter((i) => i.parentId === item.id);
    return (
      <div key={item.id}>
        <ItemRow
          item={item}
          level={level}
          expandedIds={expandedIds}
          onToggle={handleToggle}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
        {item.kind === 'folder' &&
          expandedIds.has(item.id) &&
          children.map((child) => renderTree(child, level + 1))}
      </div>
    );
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Files</SidebarGroupLabel>
      <div className="flex flex-col gap-0.5 min-h-[80px]">
        {rootItems.map((item) => renderTree(item, 0))}
      </div>
    </SidebarGroup>
  );
}
