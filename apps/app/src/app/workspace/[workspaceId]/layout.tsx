import { TooltipProvider } from '@/components/ui/tooltip';
import { getWorkspaces } from '@/features/lab';
import {
  WorkspaceContainer,
  getItemsByWorkspace,
} from '@/features/workspace';
import type { PropsWithChildren } from 'react';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({
  children,
  params,
}: PropsWithChildren<{
  params: Promise<{ workspaceId: string }>;
}>) {
  const { workspaceId } = await params;

  const [items, { workspaces }] = await Promise.all([
    getItemsByWorkspace(workspaceId),
    getWorkspaces(workspaceId),
  ]);

  return (
    <TooltipProvider delayDuration={0}>
      <main className="flex h-svh min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-sidebar">
        <WorkspaceContainer
          workspaceId={workspaceId}
          items={items}
          workspaces={workspaces ?? []}
        >
          {children}
        </WorkspaceContainer>
      </main>
    </TooltipProvider>
  );
}
