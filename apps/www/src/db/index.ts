import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type DbType = PostgresJsDatabase<typeof schema>;

let db: DbType | null = null;
let dbPromise: Promise<DbType> | null = null;

function getConnectionString(): string {
  const connectionString =
    process.env.WWW_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      'WWW_DATABASE_URL is not set. Configure a dedicated cloud database for apps/www.',
    );
  }

  return connectionString;
}

export async function getDb(): Promise<DbType> {
  if (db) return db;

  if (!dbPromise) {
    dbPromise = (async () => {
      const client = postgres(getConnectionString(), { prepare: false });
      const instance = drizzle(client, { schema });
      db = instance;
      return instance;
    })();
  }

  return dbPromise;
}
