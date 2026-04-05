const wwwPublicBaseUrl =
  process.env.NEXT_PUBLIC_WWW_URL ??
  'http://localhost:3001';

const wwwInternalBaseUrl =
  process.env.WWW_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_WWW_URL ??
  'http://127.0.0.1:3001';

export function getWwwBaseUrl(): string {
  return wwwPublicBaseUrl;
}

export function getWwwInternalBaseUrl(): string {
  return wwwInternalBaseUrl;
}

export function getWwwUrl(path = ''): string {
  return `${wwwPublicBaseUrl}${path}`;
}

export function getWwwInternalUrl(path = ''): string {
  return `${wwwInternalBaseUrl}${path}`;
}
