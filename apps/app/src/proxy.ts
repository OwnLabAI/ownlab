import { type NextRequest, NextResponse } from 'next/server';
import {
  buildLoginRedirectUrl,
  DESKTOP_SESSION_HEADER,
  isAuthRequired,
  isHostedAuthEnabled,
  parseDesktopSessionHeader,
} from './lib/desktop-auth';
import { getWwwInternalUrl } from './lib/urls';

function isProtectedRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/lab') ||
    pathname.startsWith('/workspace')
  );
}

type HostedSession = {
  user?: {
    id?: string;
  } | null;
} | null;

async function getHostedSession(req: NextRequest): Promise<HostedSession> {
  const desktopSession = parseDesktopSessionHeader(
    req.headers.get(DESKTOP_SESSION_HEADER),
  ) as HostedSession;
  if (desktopSession?.user) {
    return desktopSession;
  }

  if (!isHostedAuthEnabled()) {
    return null;
  }

  try {
    const response = await fetch(getWwwInternalUrl('/api/auth/get-session'), {
      headers: {
        cookie: req.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as HostedSession;
  } catch (error) {
    console.error('[ownlab-app] auth proxy session lookup failed:', error);
    return null;
  }
}

export default async function proxy(req: NextRequest) {
  const { nextUrl } = req;

  if (!isProtectedRoute(nextUrl.pathname) || !isAuthRequired()) {
    return NextResponse.next();
  }

  const session = await getHostedSession(req);

  if (session?.user) {
    return NextResponse.next();
  }

  const callbackUrl = `${nextUrl.origin}${nextUrl.pathname}${nextUrl.search}`;
  const loginUrl = buildLoginRedirectUrl(callbackUrl);
  const redirectUrl = loginUrl.startsWith('http://') || loginUrl.startsWith('https://')
    ? loginUrl
    : new URL(loginUrl, nextUrl.origin).toString();

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
