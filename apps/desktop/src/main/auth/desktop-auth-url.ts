const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

export function createLoopbackOriginMatchers(baseUrl: string): string[] {
  const parsed = new URL(baseUrl);
  const candidates = [parsed.hostname];

  if (isLoopbackHost(parsed.hostname)) {
    candidates.push(...[...LOOPBACK_HOSTS].filter((host) => host !== parsed.hostname));
  }

  return [...new Set(candidates)].map((hostname) => {
    const copy = new URL(parsed.toString());
    copy.hostname = hostname;
    copy.pathname = '';
    copy.search = '';
    copy.hash = '';
    return copy.origin;
  });
}

export function normalizeLoopbackUrl(targetUrl: string, preferredBaseUrl: string): string {
  const target = new URL(targetUrl);
  const preferred = new URL(preferredBaseUrl);

  if (!isLoopbackHost(target.hostname) || !isLoopbackHost(preferred.hostname)) {
    return target.toString();
  }

  target.protocol = preferred.protocol;
  target.hostname = preferred.hostname;
  target.port = preferred.port;
  return target.toString();
}

export function buildDesktopCallbackTarget(
  callbackUrl: string | null | undefined,
  appBaseUrl: string,
): string {
  if (!callbackUrl?.trim()) {
    return new URL('/lab/workspaces', appBaseUrl).toString();
  }

  return normalizeLoopbackUrl(callbackUrl, appBaseUrl);
}

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}
