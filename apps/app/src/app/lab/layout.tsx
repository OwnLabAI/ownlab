import { LabSidebar } from '@/features/lab';
import { SidebarProvider } from '@/components/ui/sidebar';
import { getWorkspaces } from '@/features/lab';
import { getSession } from '@/lib/server';
import type { PropsWithChildren } from 'react';

export const dynamic = 'force-dynamic';

export default async function LabLayout({ children }: PropsWithChildren) {
  const session = await getSession();
  const user = session?.user;

  const userData = {
    name: user?.name || user?.email || 'OwnLab Guest',
    email: user?.email || '',
    avatar: user?.image || '',
  };

  const { workspaces } = await getWorkspaces();
  const workspaceList = (workspaces || []).map((ws) => ({
    id: ws.id,
    name: ws.name,
  }));

  return (
    <SidebarProvider
      className="desktop-lab-root h-svh overflow-hidden"
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <LabSidebar
        user={userData}
        workspaces={workspaceList}
      />
      <main className="desktop-lab-main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-sidebar">
        {children}
      </main>
    </SidebarProvider>
  );
}
