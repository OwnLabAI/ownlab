import { createAuthClient } from 'better-auth/react';
import { useEffect, useState } from 'react';
import { isDesktopAuthEnabled } from './desktop-auth';
import { getWwwBaseUrl } from './urls';

type HostedSession = {
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

const browserAuthClient = createAuthClient({
  baseURL: getWwwBaseUrl(),
});

function useDesktopSession() {
  const [data, setData] = useState<HostedSession>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      if (!window.ownlabDesktop) {
        if (active) {
          setData(null);
          setIsPending(false);
        }
        return;
      }

      try {
        const session = await window.ownlabDesktop.auth.getSession();
        if (!active) return;
        setData(session);
        setError(null);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause : new Error('Failed to load desktop session'));
      } finally {
        if (active) {
          setIsPending(false);
        }
      }
    };

    void loadSession();
    window.addEventListener('focus', loadSession);

    return () => {
      active = false;
      window.removeEventListener('focus', loadSession);
    };
  }, []);

  return { data, isPending, error };
}

export const authClient = {
  useSession: () => {
    if (typeof window !== 'undefined' && isDesktopAuthEnabled() && window.ownlabDesktop) {
      return useDesktopSession();
    }

    return browserAuthClient.useSession();
  },
  signOut: async () => {
    if (typeof window !== 'undefined' && isDesktopAuthEnabled() && window.ownlabDesktop) {
      await window.ownlabDesktop.auth.signOut();
      return;
    }

    await browserAuthClient.signOut();
  },
};

export const useSession = authClient.useSession;
