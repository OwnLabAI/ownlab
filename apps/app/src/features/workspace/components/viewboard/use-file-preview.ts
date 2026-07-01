'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { buildOwnlabApiUrl, fetchWorkspaceFileContent } from '@/lib/api';
import { normalizeWorkspaceSelectionPath } from '../../path-utils';

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

export function getFilePreviewUrl(workspaceId: string, filePath: string): string {
  return buildOwnlabApiUrl(
    `/api/workspace/${encodeURIComponent(workspaceId)}/files/content?path=${encodeURIComponent(filePath)}`,
  );
}

export function useFilePreview(
  workspaceId: string,
  selectedFilePath: string | null,
  enabled = true,
) {
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const requestIdRef = useRef(0);
  const normalizedSelectedFilePath = normalizeWorkspaceSelectionPath(selectedFilePath);

  const previewKind = getPreviewKind(normalizedSelectedFilePath);
  const content = normalizedSelectedFilePath ? fileContents[normalizedSelectedFilePath] : undefined;

  const loadFile = useEffectEvent(async (options?: { force?: boolean }) => {
    if (!normalizedSelectedFilePath || !workspaceId || (previewKind !== 'text' && previewKind !== 'latex')) {
      setError(null);
      setLoading(false);
      return;
    }

    const force = options?.force ?? false;
    const hasCachedContent = Object.prototype.hasOwnProperty.call(fileContents, normalizedSelectedFilePath);
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
      const nextContent = await fetchWorkspaceFileContent(workspaceId, normalizedSelectedFilePath);
      if (requestIdRef.current !== requestId) {
        return;
      }
      setFileContents((prev) => ({
        ...prev,
        [normalizedSelectedFilePath]: nextContent,
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
    if (!enabled) {
      return;
    }

    void loadFile();
  }, [enabled, loadFile, normalizedSelectedFilePath, workspaceId]);

  return {
    content,
    error,
    loading,
    filePath: normalizedSelectedFilePath,
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
