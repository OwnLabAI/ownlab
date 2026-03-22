'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  createWorkspaceFileOrFolder,
  deleteWorkspaceFileOrFolder,
  fetchWorkspaceFileTree,
  fetchWorkspaceFolderContents,
  moveWorkspaceFileOrFolder,
  renameWorkspaceFileOrFolder,
  type FileTreeNode,
} from '@/lib/api';

export type ExplorerNode = FileTreeNode & {
  children?: ExplorerNode[];
};

function buildTree(
  nodes: FileTreeNode[],
  expandedPaths: Set<string>,
  childrenByPath: Map<string, FileTreeNode[]>,
): ExplorerNode[] {
  return nodes.map((node) => {
    if (node.type !== 'folder') {
      return node;
    }

    const children = expandedPaths.has(node.path)
      ? buildTree(childrenByPath.get(node.path) ?? [], expandedPaths, childrenByPath)
      : undefined;

    return {
      ...node,
      children,
    };
  });
}

export function useWorkspaceFileTree(workspaceId: string) {
  const [rootName, setRootName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [rootItems, setRootItems] = useState<FileTreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [childrenByPath, setChildrenByPath] = useState<Map<string, FileTreeNode[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const expandedPathsRef = useRef(expandedPaths);

  useEffect(() => {
    expandedPathsRef.current = expandedPaths;
  }, [expandedPaths]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshTree = useCallback(async (forceLoading = false) => {
    if (forceLoading) {
      setIsLoading(true);
    }

    try {
      const root = await fetchWorkspaceFileTree(workspaceId);
      const nextChildrenEntries = await Promise.all(
        Array.from(expandedPathsRef.current).map(async (folderPath) => [
          folderPath,
          await fetchWorkspaceFolderContents(workspaceId, folderPath),
        ] as const),
      );

      if (!mountedRef.current) {
        return;
      }

      startRefreshTransition(() => {
        setRootName(root.rootName);
        setRootPath(root.rootPath);
        setRootItems(root.items);
        setChildrenByPath(new Map(nextChildrenEntries));
        setError(null);
      });
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }

      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [startRefreshTransition, workspaceId]);

  useEffect(() => {
    expandedPathsRef.current = new Set();
    setExpandedPaths(new Set());
    setChildrenByPath(new Map());
    void refreshTree(true);
  }, [workspaceId, refreshTree]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshTree();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshTree]);

  const nodes = useMemo(
    () => buildTree(rootItems, expandedPaths, childrenByPath),
    [childrenByPath, expandedPaths, rootItems],
  );

  async function toggleFolder(path: string, open: boolean) {
    if (!open) {
      setExpandedPaths((prev) => {
        const next = new Set(
          Array.from(prev).filter((entryPath) => entryPath !== path && !entryPath.startsWith(`${path}/`)),
        );
        expandedPathsRef.current = next;
        return next;
      });
      setChildrenByPath((prev) => {
        const next = new Map(prev);
        for (const key of next.keys()) {
          if (key === path || key.startsWith(`${path}/`)) {
            next.delete(key);
          }
        }
        return next;
      });
      return;
    }

    const folderItems = await fetchWorkspaceFolderContents(workspaceId, path);
    if (!mountedRef.current) {
      return;
    }

    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.add(path);
      expandedPathsRef.current = next;
      return next;
    });
    setChildrenByPath((prev) => {
      const next = new Map(prev);
      next.set(path, folderItems);
      return next;
    });
  }

  async function createEntry(parentPath: string, name: string, type: 'file' | 'folder') {
    const nextPath = parentPath ? `${parentPath}/${name}` : name;
    await createWorkspaceFileOrFolder(workspaceId, nextPath, type);
    await refreshTree();
  }

  async function renameEntry(path: string, newName: string) {
    const result = await renameWorkspaceFileOrFolder(workspaceId, path, newName);
    setExpandedPaths((prev) => {
      const next = new Set<string>();
      for (const entryPath of prev) {
        if (entryPath === path) {
          next.add(result.path);
        } else if (entryPath.startsWith(`${path}/`)) {
          next.add(`${result.path}/${entryPath.slice(path.length + 1)}`);
        } else {
          next.add(entryPath);
        }
      }
      expandedPathsRef.current = next;
      return next;
    });
    setChildrenByPath((prev) => {
      const next = new Map<string, FileTreeNode[]>();
      for (const [entryPath, entryChildren] of prev.entries()) {
        if (entryPath === path) {
          next.set(result.path, entryChildren);
        } else if (entryPath.startsWith(`${path}/`)) {
          next.set(`${result.path}/${entryPath.slice(path.length + 1)}`, entryChildren);
        } else {
          next.set(entryPath, entryChildren);
        }
      }
      return next;
    });
    await refreshTree();
    return result;
  }

  async function deleteEntry(path: string) {
    await deleteWorkspaceFileOrFolder(workspaceId, path);
    setExpandedPaths((prev) => {
      const next = new Set(
        Array.from(prev).filter((entryPath) => entryPath !== path && !entryPath.startsWith(`${path}/`)),
      );
      expandedPathsRef.current = next;
      return next;
    });
    setChildrenByPath((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (key === path || key.startsWith(`${path}/`)) {
          next.delete(key);
        }
      }
      return next;
    });
    await refreshTree();
  }

  async function moveEntry(path: string, destinationPath = '') {
    const result = await moveWorkspaceFileOrFolder(workspaceId, path, destinationPath);
    setExpandedPaths((prev) => {
      const next = new Set<string>();
      for (const entryPath of prev) {
        if (entryPath === path) {
          next.add(result.path);
        } else if (entryPath.startsWith(`${path}/`)) {
          next.add(`${result.path}/${entryPath.slice(path.length + 1)}`);
        } else {
          next.add(entryPath);
        }
      }
      expandedPathsRef.current = next;
      return next;
    });
    setChildrenByPath((prev) => {
      const next = new Map<string, FileTreeNode[]>();
      for (const [entryPath, entryChildren] of prev.entries()) {
        if (entryPath === path) {
          next.set(result.path, entryChildren);
        } else if (entryPath.startsWith(`${path}/`)) {
          next.set(`${result.path}/${entryPath.slice(path.length + 1)}`, entryChildren);
        } else {
          next.set(entryPath, entryChildren);
        }
      }
      return next;
    });
    await refreshTree();
    return result;
  }

  function collapseAll() {
    expandedPathsRef.current = new Set();
    setExpandedPaths(new Set());
    setChildrenByPath(new Map());
  }

  return {
    collapseAll,
    createEntry,
    deleteEntry,
    error,
    expandedPaths,
    isLoading,
    isRefreshing,
    moveEntry,
    nodes,
    refreshTree,
    renameEntry,
    rootName,
    rootPath,
    toggleFolder,
  };
}
