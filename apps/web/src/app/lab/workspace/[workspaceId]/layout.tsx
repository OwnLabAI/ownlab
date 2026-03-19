import { getWorkspaces } from '@/features/lab';
import {
  WorkspaceContainer,
  getItemsByWorkspace,
} from '@/features/workspaces';
import type { PropsWithChildren } from 'react';

export default async function LabWorkspaceLayout({
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

  const workspaceList = workspaces ?? [];

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <WorkspaceContainer
        workspaceId={workspaceId}
        items={items}
        workspaces={workspaceList}
      >
        {children}
      </WorkspaceContainer>
    </div>
  );
}
