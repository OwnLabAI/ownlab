const DEV_WWW_BASE_URL = 'http://localhost:3001';
const DEV_WWW_INTERNAL_URL = 'http://127.0.0.1:3001';
const PROD_WWW_BASE_URL = 'https://www.ownlab.app';
const PROD_WWW_INTERNAL_URL = 'https://www.ownlab.app';

const isProduction = process.env.NODE_ENV === 'production';

const wwwPublicBaseUrl =
  process.env.NEXT_PUBLIC_WWW_URL ??
  (isProduction ? PROD_WWW_BASE_URL : DEV_WWW_BASE_URL);

const wwwInternalBaseUrl =
  process.env.WWW_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_WWW_URL ??
  (isProduction ? PROD_WWW_INTERNAL_URL : DEV_WWW_INTERNAL_URL);

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
