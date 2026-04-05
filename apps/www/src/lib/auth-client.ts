import { createAuthClient } from 'better-auth/react';
import { getBaseUrl } from './urls/urls';

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
});

export const useSession = authClient.useSession;
