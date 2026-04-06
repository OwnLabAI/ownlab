'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type * as React from 'react';

import { authClient } from '@/lib/auth-client';
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
  SidebarTrigger,
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
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user;
  const resolvedUser = currentUser
    ? {
        name: currentUser.name || currentUser.email || user.name,
        email: currentUser.email || user.email,
        avatar: currentUser.image || user.avatar,
      }
    : user;

  return (
    <Sidebar
      className="border-r border-border/60"
      collapsible="icon"
      {...props}
    >
      <SidebarHeader className="gap-0 p-0">
        <div className="desktop-macos-chrome-row flex h-10 min-h-10 shrink-0 items-center gap-1 px-2">
          <SidebarTrigger className="desktop-window-no-drag size-7 shrink-0" />
          <div
            className="hidden min-h-0 flex-1 self-stretch md:block desktop-window-drag"
            aria-hidden
          />
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
          <NavUser
            user={resolvedUser}
            isLoading={isPending}
            isAuthenticated={!!currentUser}
          />
        </ClientOnly>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
