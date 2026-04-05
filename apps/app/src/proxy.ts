import { type NextRequest, NextResponse } from 'next/server';
import { getWwwBaseUrl, getWwwInternalUrl } from './lib/urls';

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

  if (!isProtectedRoute(nextUrl.pathname)) {
    return NextResponse.next();
  }

  const session = await getHostedSession(req);

  if (session?.user) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/auth/login', getWwwBaseUrl());
  const callbackUrl = `${nextUrl.origin}${nextUrl.pathname}${nextUrl.search}`;
  loginUrl.searchParams.set('callbackUrl', callbackUrl);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
