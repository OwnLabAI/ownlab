import { fetchWorkspaces, type Workspace } from '@/lib/api';

export type { Workspace };

export type WorkspaceForSwitcher = Workspace & {
  isActive: boolean;
};

export async function getWorkspaces(
  currentWorkspaceId?: string,
): Promise<{
  workspaces: WorkspaceForSwitcher[] | null;
  error: string | null;
}> {
  try {
    const workspaces = await fetchWorkspaces();

    return {
      workspaces: workspaces.map((workspace) => ({
        ...workspace,
        isActive: workspace.id === currentWorkspaceId,
      })),
      error: null,
    };
  } catch (error) {
    console.error('Failed to fetch workspaces:', error);

    return {
      workspaces: null,
      error: 'Failed to fetch workspaces.',
    };
  }
}
