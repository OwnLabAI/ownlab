import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/g)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const projectDir = process.cwd();
loadDotEnvFile(path.join(projectDir, '.env.local'));
loadDotEnvFile(path.join(projectDir, '.env'));

const connectionString =
  process.env.WWW_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error(
    'WWW_DATABASE_URL is not set. Configure the apps/www database before running Drizzle commands.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: connectionString,
  },
});
