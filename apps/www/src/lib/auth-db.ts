import 'server-only';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getDb } from '@/db';
import type * as schema from '@/db/schema';

declare global {
  // eslint-disable-next-line no-var
  var __ownlabWwwAuthDb:
    | PostgresJsDatabase<typeof schema>
    | undefined;
}

export async function getAuthDb() {
  if (!globalThis.__ownlabWwwAuthDb) {
    globalThis.__ownlabWwwAuthDb = await getDb();
  }

  return globalThis.__ownlabWwwAuthDb;
}
