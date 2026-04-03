'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { fetchWorkspaceFileContent } from '@/lib/api';

const UNSUPPORTED_PREVIEW_EXTENSIONS = new Set([
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
]);

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx', '.mdown', '.mkd']);

export type PreviewKind = 'text' | 'pdf' | 'png' | 'unsupported';
export type LatexPreviewKind = PreviewKind | 'latex';

export function getFileExtension(filePath: string | null): string {
  if (!filePath) {
    return '';
  }

  const fileName = filePath.split('/').pop() ?? filePath;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) {
    return '';
  }

  return fileName.slice(dotIndex).toLowerCase();
}

export function isLatexFile(filePath: string | null): boolean {
  return getFileExtension(filePath) === '.tex';
}

export function getPreviewKind(filePath: string | null): LatexPreviewKind {
  const normalizedPath = filePath?.toLowerCase() ?? '';
  const extension = getFileExtension(filePath);

  if (extension === '.tex') {
    return 'latex';
  }

  if (normalizedPath.endsWith('.pdf')) {
    return 'pdf';
  }

  if (normalizedPath.endsWith('.png')) {
    return 'png';
  }

  if (UNSUPPORTED_PREVIEW_EXTENSIONS.has(extension)) {
    return 'unsupported';
  }

  return 'text';
}

export function isMarkdownFile(filePath: string | null): boolean {
  return MARKDOWN_EXTENSIONS.has(getFileExtension(filePath));
}

export function getWorkspaceFilePreviewUrl(workspaceId: string, filePath: string): string {
  return `/api/workspace/${encodeURIComponent(workspaceId)}/files/content?path=${encodeURIComponent(filePath)}`;
}

export function useWorkspaceFilePreview(workspaceId: string, selectedFilePath: string | null) {
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const requestIdRef = useRef(0);

  const previewKind = getPreviewKind(selectedFilePath);
  const content = selectedFilePath ? fileContents[selectedFilePath] : undefined;

  const loadFile = useEffectEvent(async (options?: { force?: boolean }) => {
    if (!selectedFilePath || !workspaceId || (previewKind !== 'text' && previewKind !== 'latex')) {
      setError(null);
      setLoading(false);
      return;
    }

    const force = options?.force ?? false;
    const hasCachedContent = Object.prototype.hasOwnProperty.call(fileContents, selectedFilePath);
    if (hasCachedContent && !force) {
      setError(null);
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError(null);
    setLoading(true);

    try {
      const nextContent = await fetchWorkspaceFileContent(workspaceId, selectedFilePath);
      if (requestIdRef.current !== requestId) {
        return;
      }
      setFileContents((prev) => ({
        ...prev,
        [selectedFilePath]: nextContent,
      }));
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  });

  useEffect(() => {
    requestIdRef.current += 1;
    setFileContents({});
    setError(null);
    setLoading(false);
    setPreviewVersion(0);
  }, [workspaceId]);

  useEffect(() => {
    void loadFile();
  }, [loadFile, selectedFilePath, workspaceId]);

  return {
    content,
    error,
    loading,
    previewKind,
    previewVersion,
    refreshTextFile: () => void loadFile({ force: true }),
    refreshBinaryPreview: () => setPreviewVersion((current) => current + 1),
    setContent: (filePath: string, nextContent: string) => {
      setFileContents((prev) => ({
        ...prev,
        [filePath]: nextContent,
      }));
    },
  };
}
