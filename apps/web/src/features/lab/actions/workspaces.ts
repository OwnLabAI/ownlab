'use server';

import { revalidatePath } from 'next/cache';
import {
  createWorkspaceApi,
  updateWorkspaceApi,
  deleteWorkspaceApi,
} from '@/lib/api';

export async function createWorkspace(input: {
  name: string;
  worktreePath?: string | null;
}) {
  try {
    const ws = await createWorkspaceApi({
      name: input.name,
      worktreePath: input.worktreePath ?? null,
    });
    revalidatePath('/lab');
    revalidatePath('/lab/workspaces');
    return {
      data: {
        success: true,
        message: `Workspace "${ws.name}" created.`,
        id: ws.id,
      },
    };
  } catch (error) {
    console.error('Failed to create workspace:', error);
    return {
      data: {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create workspace.',
      },
    };
  }
}

export async function updateWorkspace(input: { id: string; name: string }) {
  try {
    await updateWorkspaceApi(input.id, { name: input.name });
    revalidatePath('/lab');
    revalidatePath('/lab/workspaces');
    return { data: { success: true, message: 'Workspace updated successfully.' } };
  } catch (error) {
    console.error('Failed to update workspace:', error);
    return { data: { success: false, error: 'Failed to update workspace.' } };
  }
}

export async function deleteWorkspace(input: { id: string }) {
  try {
    await deleteWorkspaceApi(input.id);
    revalidatePath('/lab');
    revalidatePath('/lab/workspaces');
    return { data: { success: true, message: 'Workspace deleted.' } };
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    return {
      data: {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete workspace.',
      },
    };
  }
}
