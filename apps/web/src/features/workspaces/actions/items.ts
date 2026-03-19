'use server';

import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import {
  addItem,
  updateItemById,
  deleteItemById,
  getItemById,
  type Item,
} from '@/features/workspaces/data/items';

const CREATOR_ID = 'local-user';

export async function createFolder(input: {
  workspaceId: string;
  name: string;
  parentId?: string | null;
}) {
  try {
    const { workspaceId, name, parentId = null } = input;
    const id = nanoid();
    const now = new Date();
    addItem({
      id,
      name,
      kind: 'folder',
      parentId,
      workspaceId,
      creatorId: CREATOR_ID,
      fileType: null,
      storageKey: null,
      url: null,
      content: null,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath(`/lab/workspace/${workspaceId}`);
    return { data: { success: true, message: 'Folder created.', id } };
  } catch (e) {
    console.error('createFolder:', e);
    return { data: { success: false, error: 'Failed to create folder.' } };
  }
}

export async function createNote(input: {
  workspaceId: string;
  name: string;
  parentId?: string | null;
}) {
  try {
    const { workspaceId, name, parentId = null } = input;
    const id = nanoid();
    const now = new Date();
    addItem({
      id,
      name,
      kind: 'note',
      parentId,
      workspaceId,
      creatorId: CREATOR_ID,
      fileType: null,
      storageKey: null,
      url: null,
      content: '',
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath(`/lab/workspace/${workspaceId}`);
    return { data: { success: true, message: 'Note created.', id, url: null } };
  } catch (e) {
    console.error('createNote:', e);
    return { data: { success: false, error: 'Failed to create note.' } };
  }
}

export async function createPdfRecord(input: {
  workspaceId: string;
  parentId?: string | null;
  name: string;
  storageKey: string;
  url: string;
}) {
  try {
    const { workspaceId, parentId = null, name, storageKey, url } = input;
    const id = nanoid();
    const now = new Date();
    addItem({
      id,
      name,
      kind: 'file',
      parentId,
      workspaceId,
      creatorId: CREATOR_ID,
      fileType: 'application/pdf',
      storageKey,
      url,
      content: null,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath(`/lab/workspace/${workspaceId}`);
    return { data: { success: true, message: 'File added.', id, url } };
  } catch (e) {
    console.error('createPdfRecord:', e);
    return { data: { success: false, error: 'Failed to add file.' } };
  }
}

export async function renameItem(input: { itemId: string; newName: string }) {
  try {
    const item = getItemById(input.itemId);
    if (!item) {
      return { data: { success: false, error: 'Item not found.' } };
    }
    updateItemById(input.itemId, { name: input.newName });
    revalidatePath(`/lab/workspace/${item.workspaceId}`);
    return { data: { success: true, message: 'Renamed.' } };
  } catch (e) {
    console.error('renameItem:', e);
    return { data: { success: false, error: 'Failed to rename.' } };
  }
}

export async function moveItem(input: {
  itemId: string;
  newParentId: string | null;
}) {
  try {
    const item = getItemById(input.itemId);
    if (!item) {
      return { data: { success: false, error: 'Item not found.' } };
    }
    updateItemById(input.itemId, { parentId: input.newParentId });
    revalidatePath(`/lab/workspace/${item.workspaceId}`);
    return { data: { success: true, message: 'Moved.' } };
  } catch (e) {
    console.error('moveItem:', e);
    return { data: { success: false, error: 'Failed to move.' } };
  }
}

export async function deleteItem(input: { itemId: string }) {
  try {
    const item = getItemById(input.itemId);
    if (!item) {
      return { data: { success: false, error: 'Item not found.' } };
    }
    deleteItemById(input.itemId);
    revalidatePath(`/lab/workspace/${item.workspaceId}`);
    return { data: { success: true, message: 'Deleted.' } };
  } catch (e) {
    console.error('deleteItem:', e);
    return { data: { success: false, error: 'Failed to delete.' } };
  }
}
