import { authClient } from '@/lib/auth-client';

export const useCurrentUser = () => {
  const { data: session, error } = authClient.useSession();

  if (error) {
    console.error('useCurrentUser, error:', error);
    return null;
  }

  return session?.user;
};
