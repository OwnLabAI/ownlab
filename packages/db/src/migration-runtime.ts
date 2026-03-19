import { existsSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensurePostgresDatabase } from "./client.js";

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

export type MigrationConnection = {
  connectionString: string;
  source: string;
  stop: () => Promise<void>;
};

function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

function resolveOwnLabHomeDir(): string {
  const envHome = process.env.OWNLAB_HOME?.trim();
  if (envHome) return path.resolve(expandHomePrefix(envHome));
  return path.resolve(os.homedir(), ".ownlab");
}

function resolveOwnLabInstanceId(): string {
  const raw = process.env.OWNLAB_INSTANCE_ID?.trim() || "default";
  if (!/^[a-zA-Z0-9_-]+$/.test(raw)) {
    throw new Error(`Invalid OWNLAB_INSTANCE_ID '${raw}'.`);
  }
  return raw;
}

function resolveEmbeddedPostgresDir(): string {
  return path.resolve(resolveOwnLabHomeDir(), "instances", resolveOwnLabInstanceId(), "db");
}

function resolvePreferredEmbeddedPort(): number {
  const raw = process.env.OWNLAB_EMBEDDED_PG_PORT?.trim();
  const parsed = raw ? Number(raw) : 54329;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 54329;
}

function readRunningPostmasterPid(postmasterPidFile: string): number | null {
  if (!existsSync(postmasterPidFile)) return null;
  try {
    const pid = Number(readFileSync(postmasterPidFile, "utf8").split("\n")[0]?.trim());
    if (!Number.isInteger(pid) || pid <= 0) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

function readPidFilePort(postmasterPidFile: string): number | null {
  if (!existsSync(postmasterPidFile)) return null;
  try {
    const lines = readFileSync(postmasterPidFile, "utf8").split("\n");
    const port = Number(lines[3]?.trim());
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

async function loadEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  const require = createRequire(import.meta.url);
  const resolveCandidates = [
    path.resolve(fileURLToPath(new URL("../..", import.meta.url))),
    path.resolve(fileURLToPath(new URL("../../../apps/server", import.meta.url))),
    process.cwd(),
  ];

  try {
    const resolvedModulePath = require.resolve("embedded-postgres", { paths: resolveCandidates });
    const mod = await import(pathToFileURL(resolvedModulePath).href);
    return mod.default as EmbeddedPostgresCtor;
  } catch {
    throw new Error(
      "Embedded PostgreSQL support requires dependency `embedded-postgres`. Install dependencies or set DATABASE_URL.",
    );
  }
}

async function ensureEmbeddedPostgresConnection(
  dataDir: string,
  preferredPort: number,
): Promise<MigrationConnection> {
  const EmbeddedPostgres = await loadEmbeddedPostgresCtor();
  const postmasterPidFile = path.resolve(dataDir, "postmaster.pid");
  const runningPid = readRunningPostmasterPid(postmasterPidFile);
  const runningPort = readPidFilePort(postmasterPidFile);

  if (runningPid) {
    const port = runningPort ?? preferredPort;
    const adminConnectionString = `postgres://ownlab:ownlab@127.0.0.1:${port}/postgres`;
    await ensurePostgresDatabase(adminConnectionString, "ownlab");
    return {
      connectionString: `postgres://ownlab:ownlab@127.0.0.1:${port}/ownlab`,
      source: `embedded-postgres@${port}`,
      stop: async () => {},
    };
  }

  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "ownlab",
    password: "ownlab",
    port: preferredPort,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });

  if (!existsSync(path.resolve(dataDir, "PG_VERSION"))) {
    await instance.initialise();
  }

  if (existsSync(postmasterPidFile)) {
    rmSync(postmasterPidFile, { force: true });
  }

  await instance.start();

  const adminConnectionString = `postgres://ownlab:ownlab@127.0.0.1:${preferredPort}/postgres`;
  await ensurePostgresDatabase(adminConnectionString, "ownlab");

  return {
    connectionString: `postgres://ownlab:ownlab@127.0.0.1:${preferredPort}/ownlab`,
    source: `embedded-postgres@${preferredPort}`,
    stop: async () => {
      await instance.stop();
    },
  };
}

export async function resolveMigrationConnection(): Promise<MigrationConnection> {
  const externalUrl = process.env.DATABASE_URL?.trim();
  if (externalUrl) {
    return {
      connectionString: externalUrl,
      source: "DATABASE_URL",
      stop: async () => {},
    };
  }

  return ensureEmbeddedPostgresConnection(
    resolveEmbeddedPostgresDir(),
    resolvePreferredEmbeddedPort(),
  );
}
