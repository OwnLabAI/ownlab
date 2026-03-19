'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ChevronDown, FolderGit2, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
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
import { CreateWorkspaceDialog } from './create-workspace-dialog';
import { useState, useCallback } from 'react';
import { deleteWorkspaceApi } from '@/lib/api';

type WorkspaceItem = { id: string; name: string };

export function NavWorkspaces({
  workspaces = [],
  currentWorkspaceId,
}: {
  workspaces?: WorkspaceItem[];
  currentWorkspaceId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreated = useCallback(
    (workspaceId: string) => {
      setDialogOpen(false);
      router.refresh();
      router.push(`/lab/workspace/${workspaceId}`);
    },
    [router],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteWorkspaceApi(id);
        if (currentWorkspaceId === id) {
          router.push('/lab');
        }
        router.refresh();
      } catch {
        // ignore
      }
    },
    [currentWorkspaceId, router],
  );

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden pl-1">
          <SidebarGroupLabel className="flex items-center gap-1 text-sm font-medium text-sidebar-foreground/70 w-full px-1">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label={open ? 'Collapse Workspaces' : 'Expand Workspaces'}
              >
                <ChevronDown
                  className={`size-4 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>
            </CollapsibleTrigger>
            <span>Workspaces</span>
          </SidebarGroupLabel>
          <SidebarGroupAction
            onClick={() => setDialogOpen(true)}
            title="Add workspace"
          >
            <Plus className="size-4" />
          </SidebarGroupAction>
          <CollapsibleContent>
            <SidebarMenu>
              {workspaces.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setDialogOpen(true)}
                    className="text-muted-foreground"
                  >
                    <Plus className="size-4" />
                    <span>Create your first workspace</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {workspaces.map((ws) => {
                const isActive = currentWorkspaceId === ws.id;
                return (
                  <SidebarMenuItem key={ws.id}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        href={`/lab/workspace/${ws.id}`}
                        title={ws.name}
                      >
                        <FolderGit2 className="size-4 text-amber-500" />
                        <span className="flex-1 truncate font-medium">
                          {ws.name}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        id={`lab-workspace-menu-trigger-${ws.id}`}
                        asChild
                      >
                        <SidebarMenuAction showOnHover>
                          <MoreHorizontal />
                          <span className="sr-only">More</span>
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-48">
                        <DropdownMenuItem
                          onClick={() => handleDelete(ws.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="size-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </>
  );
}
