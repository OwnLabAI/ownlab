'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, FolderGit2, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { WorkspaceForSwitcher } from '@/features/lab/data/workspaces';

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceForSwitcher[];
}

export function WorkspaceSwitcher({ workspaces }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const active = workspaces.find((ws) => ws.isActive);

  if (!active) return null;

  const handleSelect = (workspaceId: string) => {
    router.push(`/workspace/${workspaceId}`);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger id={`workspace-switcher-trigger-${active.id}`} asChild>
            <SidebarMenuButton className="w-full justify-start text-left">
              <FolderGit2 className="mr-2 h-4 w-4 flex-shrink-0 text-amber-500" />
              <span className="truncate font-medium flex-grow">
                {active.name}
              </span>
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 p-2 rounded-lg"
            side="bottom"
            align="start"
            sideOffset={4}
          >
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onSelect={() => handleSelect(ws.id)}
                className="cursor-pointer"
              >
                <FolderGit2 className="mr-2 h-4 w-4 text-amber-500" />
                <span className="truncate">{ws.name}</span>
                <Check
                  className={cn(
                    'ml-auto h-4 w-4',
                    ws.isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => router.push('/lab/workspaces')}
              className="cursor-pointer"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Back to Lab</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
