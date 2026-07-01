'use client';

export function normalizeWorkspaceSelectionPath(path: string | null | undefined): string | null {
  if (typeof path !== 'string') {
    return null;
  }

  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return null;
  }

  const withoutHash = trimmedPath.replace(/#L?\d+(?:-L?\d+)?$/i, '');
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;

  const match = withoutQuery.match(/^(.*\.[^./:\\]+):(\d+)(?::(\d+))?$/);
  const normalizedPath = match ? match[1] : withoutQuery;

  return normalizedPath.trim() || null;
}
