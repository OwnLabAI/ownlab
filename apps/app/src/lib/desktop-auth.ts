import { getWwwUrl } from './urls';

export const DESKTOP_SESSION_HEADER = 'x-ownlab-hosted-session';

export function isDesktopAuthEnabled(): boolean {
  return process.env.OWNLAB_DESKTOP_AUTH_ENABLED === 'true' || process.env.NEXT_PUBLIC_OWNLAB_DESKTOP === 'true';
}

export function isHostedAuthEnabled(): boolean {
  return process.env.OWNLAB_HOSTED_AUTH_ENABLED === 'true' || process.env.NEXT_PUBLIC_OWNLAB_HOSTED_AUTH_ENABLED === 'true';
}

export function isAuthRequired(): boolean {
  return process.env.OWNLAB_REQUIRE_AUTH === 'true' || process.env.NEXT_PUBLIC_OWNLAB_REQUIRE_AUTH === 'true';
}

export function buildLoginRedirectUrl(callbackUrl: string): string {
  const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl);

  if (isDesktopAuthEnabled()) {
    const desktopUrl = new URL('/desktop-auth/login', normalizedCallbackUrl);
    desktopUrl.searchParams.set('callbackUrl', normalizedCallbackUrl);
    return `${desktopUrl.pathname}${desktopUrl.search}`;
  }

  const loginUrl = new URL('/auth/login', getWwwUrl());
  loginUrl.searchParams.set('callbackUrl', normalizedCallbackUrl);
  return loginUrl.toString();
}

export function parseDesktopSessionHeader(encodedValue: string | null | undefined) {
  if (!encodedValue) {
    return null;
  }

  try {
    const json = Buffer.from(encodedValue, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeCallbackUrl(callbackUrl: string): string {
  if (/^https?:\/\//.test(callbackUrl)) {
    return callbackUrl;
  }

  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';

  return new URL(callbackUrl, appBaseUrl).toString();
}
