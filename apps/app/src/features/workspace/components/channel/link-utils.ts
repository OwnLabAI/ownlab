export function getLocalWorkspaceTarget(
  href: string | undefined,
  workspaceRootPath: string | null,
  currentOrigin: string | null,
) {
  if (!href || !workspaceRootPath) {
    return null;
  }

  const normalizedRoot = normalizeFilesystemPath(workspaceRootPath);
  const resolvedHref = resolveLocalFilesystemHref(href, currentOrigin);
  const normalizedHref = normalizeFilesystemPath(resolvedHref);

  if (!normalizedRoot || !isLocalFilesystemPath(normalizedHref)) {
    return null;
  }

  if (normalizedHref !== normalizedRoot && !normalizedHref.startsWith(`${normalizedRoot}/`)) {
    return null;
  }

  const relativePath = normalizedHref === normalizedRoot
    ? ''
    : normalizedHref.slice(normalizedRoot.length + 1);
  const basename = relativePath.split('/').pop() ?? '';

  return {
    relativePath,
    looksLikeDirectory: !basename || !basename.includes('.'),
  };
}

export function isHttpUrl(value: string | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

function normalizeFilesystemPath(value: string): string {
  let normalized = value.trim();

  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the original string when decoding fails.
  }

  normalized = normalized.replace(/^file:\/\//, '').replace(/\\/g, '/');

  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, '');
  }

  return normalized;
}

function resolveLocalFilesystemHref(href: string, currentOrigin: string | null): string {
  if (!href) {
    return href;
  }

  if (href.startsWith('file://')) {
    return href;
  }

  try {
    const parsed = new URL(href, currentOrigin ?? undefined);
    if (parsed.protocol === 'file:') {
      return parsed.pathname;
    }
    if (currentOrigin && parsed.origin === currentOrigin && isLocalFilesystemPath(parsed.pathname)) {
      return parsed.pathname;
    }
  } catch {
    // Fall back to the raw href if URL parsing fails.
  }

  return href;
}

function isLocalFilesystemPath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:\//.test(value);
}
