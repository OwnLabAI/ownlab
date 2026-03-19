'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type * as React from 'react';

import { NavLab } from './nav-lab';
import { NavUser } from './nav-user';
import { NavAgents } from './agents/nav-agents';
import { LabToolbar } from './lab-toolbar';
import { NavTasks } from './tasks/nav-tasks';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';

type UserData = {
  name: string;
  email: string;
  avatar: string;
};

export type WorkspaceNavItem = {
  id: string;
  name: string;
};

/** Renders children only after mount to avoid Radix auto-id hydration mismatch. */
function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

export function LabSidebar({
  user,
  workspaces = [],
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: UserData;
  workspaces?: WorkspaceNavItem[];
}) {
  return (
    <Sidebar className="border-r border-border/60" {...props}>
      <SidebarHeader>
        <div className="flex items-center justify-start p-2">
          <a href="/lab">
            <img
              src="/logo-name.svg"
              alt="OwnLab Logo"
              className="h-6 w-auto"
            />
          </a>
        </div>
        <ClientOnly>
          <LabToolbar />
        </ClientOnly>
      </SidebarHeader>
      <SidebarContent>
        <ClientOnly>
          <NavLab workspaces={workspaces} />
          <NavAgents />
          <NavTasks />
        </ClientOnly>
      </SidebarContent>
      <SidebarFooter>
        <ClientOnly>
          <NavUser user={user} />
        </ClientOnly>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
