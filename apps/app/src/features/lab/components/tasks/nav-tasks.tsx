'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Plus,
  Loader2,
  ChevronDown,
  ClipboardList,
  ListPlus,
} from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchTaskBoards, createTaskBoard } from '@/lib/api';
import type { TaskBoard } from '@/lib/api';

export function NavTasks() {
  const [boards, setBoards] = useState<TaskBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const loadBoards = useCallback(async () => {
    try {
      const data = await fetchTaskBoards();
      setBoards(data);
    } catch {
      // Server might not be running yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    const onDeleted = () => loadBoards();
    window.addEventListener('taskboard-deleted', onDeleted);
    return () => window.removeEventListener('taskboard-deleted', onDeleted);
  }, [loadBoards]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const board = await createTaskBoard({ name: newName.trim() });
      setBoards((prev) => [board, ...prev]);
      setDialogOpen(false);
      setNewName('');
      router.push(`/lab/tasks/${board.id}`);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }, [newName, router]);

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden pl-1">
          <SidebarGroupLabel className="flex items-center gap-1 text-sm font-medium text-sidebar-foreground/70 w-full px-1">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label={open ? 'Collapse Tasks' : 'Expand Tasks'}
              >
                <ChevronDown
                  className={`size-4 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>
            </CollapsibleTrigger>
            <span>Tasks</span>
          </SidebarGroupLabel>

          <DropdownMenu>
            <DropdownMenuTrigger id="lab-taskboards-create-trigger" asChild>
              <SidebarGroupAction title="Add taskboard">
                <Plus className="size-4" />
              </SidebarGroupAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48">
              <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                <ListPlus className="size-4" />
                <span>New Taskboard</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <CollapsibleContent>
            <SidebarMenu>
              {loading && (
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-muted-foreground">Loading...</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {!loading && boards.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setDialogOpen(true)}
                    className="text-muted-foreground"
                  >
                    <Plus className="size-4" />
                    <span>Create your first board</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {boards.map((board) => {
                const isActive = pathname.startsWith(`/lab/tasks/${board.id}`);
                return (
                  <SidebarMenuItem key={board.id}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        href={`/lab/tasks/${board.id}`}
                        title={board.name}
                      >
                        <ClipboardList className="size-4 text-blue-500" />
                        <span className="flex-1 truncate font-medium">
                          {board.name}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Taskboard</DialogTitle>
            <DialogDescription>
              Enter a name to create a new taskboard.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Board name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
