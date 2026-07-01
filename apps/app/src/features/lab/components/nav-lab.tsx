'use client';

import { usePathname } from 'next/navigation';
import { NavWorkspaces } from './workspaces/nav-workspaces';
import type { WorkspaceNavItem } from './lab-sidebar';

export function NavLab({
  workspaces = [],
}: {
  workspaces?: WorkspaceNavItem[];
}) {
  const pathname = usePathname();
  const workspaceIdMatch = pathname.match(/^\/workspace\/([^/]+)/);
  const currentWorkspaceId = workspaceIdMatch?.[1] ?? null;

  return (
    <>
      <NavWorkspaces
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
      />
    </>
  );
}
