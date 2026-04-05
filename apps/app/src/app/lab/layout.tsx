import { LabSidebar } from '@/features/lab';
import { SidebarProvider } from '@/components/ui/sidebar';
import { getWorkspaces } from '@/features/lab';
import { getSession } from '@/lib/server';
import { getWwwUrl } from '@/lib/urls';
import { redirect } from 'next/navigation';
import type { PropsWithChildren } from 'react';

export const dynamic = 'force-dynamic';

export default async function LabLayout({ children }: PropsWithChildren) {
  const session = await getSession();
  if (!session?.user) {
    redirect(getWwwUrl('/auth/login'));
  }

  const userData = {
    name: session.user.name || session.user.email || 'OwnLab User',
    email: session.user.email || '',
    avatar: session.user.image || '',
  };

  const { workspaces } = await getWorkspaces();
  const workspaceList = (workspaces || []).map((ws) => ({
    id: ws.id,
    name: ws.name,
  }));

  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
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
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-sidebar">
        {children}
      </main>
    </SidebarProvider>
  );
}
