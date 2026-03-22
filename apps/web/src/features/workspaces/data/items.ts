/**
 * In-memory store for workspace items (folders, notes, files).
 * Keyed by workspaceId. Persists only for the lifetime of the dev server.
 */

export type ItemKind = 'folder' | 'note' | 'file';

export type Item = {
  id: string;
  name: string;
  kind: ItemKind;
  parentId: string | null;
  workspaceId: string;
  creatorId: string;
  fileType: string | null;
  storageKey: string | null;
  url: string | null;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const itemsByWorkspace: Record<string, Item[]> = {};

function ensureWorkspace(workspaceId: string): Item[] {
  if (!itemsByWorkspace[workspaceId]) {
    itemsByWorkspace[workspaceId] = [];
  }
  return itemsByWorkspace[workspaceId];
}

export function getItemsByWorkspace(workspaceId: string): Item[] {
  const list = ensureWorkspace(workspaceId);
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

export function getItemById(itemId: string): Item | undefined {
  for (const list of Object.values(itemsByWorkspace)) {
    const found = list.find((i) => i.id === itemId);
    if (found) return found;
  }
  return undefined;
}

export function addItem(item: Item): void {
  const list = ensureWorkspace(item.workspaceId);
  list.push(item);
}

export function updateItemById(
  itemId: string,
  patch: Partial<Pick<Item, 'name' | 'parentId' | 'url' | 'content' | 'updatedAt'>>
): Item | undefined {
  const item = getItemById(itemId);
  if (!item) return undefined;
  Object.assign(item, patch);
  if (!patch.updatedAt) item.updatedAt = new Date();
  return item;
}

export function deleteItemById(itemId: string): boolean {
  for (const workspaceId of Object.keys(itemsByWorkspace)) {
    const list = itemsByWorkspace[workspaceId];
    const idx = list.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      list.splice(idx, 1);
      return true;
    }
  }
  return false;
}
