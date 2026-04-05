import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';
import { getWwwInternalUrl } from './urls';

export type HostedSession = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  session?: {
    id?: string;
  } | null;
} | null;

export const getSession = cache(async (): Promise<HostedSession> => {
  try {
    const requestHeaders = await headers();
    const response = await fetch(getWwwInternalUrl('/api/auth/get-session'), {
      headers: {
        cookie: requestHeaders.get('cookie') ?? '',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as HostedSession;
  } catch (error) {
    console.error('[ownlab-app] failed to fetch hosted session:', error);
    return null;
  }
});
