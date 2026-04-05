import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';
import { getAuth } from './auth';

export const getSession = cache(async () => {
  const auth = await getAuth();
  return auth.api.getSession({
    headers: await headers(),
  });
});
