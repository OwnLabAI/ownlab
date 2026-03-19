'use client';

import { useState } from 'react';
import { Plus, Pencil, Check, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { TaskBoard } from '@/lib/api';

interface TaskBoardHeaderProps {
  board: TaskBoard;
  onAddTask: () => void;
  onUpdateBoard: (name: string) => void;
  onDeleteBoard?: () => void | Promise<void>;
  deletingBoard?: boolean;
  deleteError?: string | null;
}

export function TaskBoardHeader({
  board,
  onAddTask,
  onUpdateBoard,
  onDeleteBoard,
  deletingBoard = false,
  deleteError = null,
}: TaskBoardHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(board.name);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleSave = () => {
    if (editName.trim()) {
      onUpdateBoard(editName.trim());
      setEditing(false);
    }
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b">
        <div className="flex flex-1 items-center gap-2 px-3">
          <SidebarTrigger />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="line-clamp-1">
                  {editing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave();
                          if (e.key === 'Escape') setEditing(false);
                        }}
                        className="h-7 w-48"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={handleSave}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditing(false)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditName(board.name);
                        setEditing(true);
                      }}
                      className="flex items-center gap-1.5 hover:text-foreground"
                    >
                      <span>{board.name}</span>
                      <Pencil className="size-3 opacity-0 group-hover:opacity-100" />
                    </button>
                  )}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center gap-2 pr-3">
          <Button size="sm" onClick={onAddTask}>
            <Plus className="mr-1 size-4" />
            New Task
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-transparent hover:text-destructive/80"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!onDeleteBoard}
            aria-label="Delete board"
            title="Delete board"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </header>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="flex flex-col p-0 sm:max-w-md">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="text-xl">Remove Taskboard</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this taskboard? All tasks on it will be deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <div className="mx-6 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{deleteError}</p>
            </div>
          ) : null}

          <DialogFooter className="px-6 py-4 border-t shrink-0 mx-0 mb-0 rounded-b-xl">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deletingBoard}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onDeleteBoard?.()}
              disabled={deletingBoard}
            >
              {deletingBoard ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
