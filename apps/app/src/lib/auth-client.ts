import { createAuthClient } from 'better-auth/react';
import { getWwwBaseUrl } from './urls';

export const authClient = createAuthClient({
  baseURL: getWwwBaseUrl(),
});

export const useSession = authClient.useSession;
