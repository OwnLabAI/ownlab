import { existsSync, readFileSync, rmSync } from "node:fs";
import type { Server as HttpServer } from "node:http";
import net from "node:net";
import os from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDb,
  ensurePostgresDatabase,
  inspectMigrations,
  applyPendingMigrations,
  reconcilePendingMigrationHistory,
} from "@ownlab/db";
import { createApp } from "./app.js";
import { createTaskScheduler } from "./tasks/scheduler.js";

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

export type StartedOwnlabServer = {
  host: string;
  port: number;
  apiUrl: string;
  connectionString: string;
  stop(): Promise<void>;
};

export function resolveOwnLabHomeDir(): string {
  const envHome = process.env.OWNLAB_HOME?.trim();
  if (envHome) return resolve(envHome.replace(/^~/, os.homedir()));
  return resolve(os.homedir(), ".ownlab");
}

export function resolveInstanceId(): string {
  return process.env.OWNLAB_INSTANCE_ID?.trim() || "default";
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

async function findAvailablePort(preferredPort: number, host: string): Promise<number> {
  const canListen = (port: number) =>
    new Promise<boolean>((resolvePromise) => {
      const server = net.createServer();
      server.once("error", () => resolvePromise(false));
      server.listen(port, host, () => {
        server.close(() => resolvePromise(true));
      });
    });

  if (await canListen(preferredPort)) {
    return preferredPort;
  }

  const ephemeral = await new Promise<number>((resolvePromise, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not resolve an ephemeral port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePromise(port);
      });
    });
  });

  return ephemeral;
}

async function ensureMigrations(connectionString: string): Promise<void> {
  let state = await inspectMigrations(connectionString);

  if (state.status === "needsMigrations" && state.reason === "pending-migrations") {
    const repair = await reconcilePendingMigrationHistory(connectionString);
    if (repair.repairedMigrations.length > 0) {
      console.log(`Repaired ${repair.repairedMigrations.length} migration journal entries`);
      state = await inspectMigrations(connectionString);
      if (state.status === "upToDate") return;
    }
  }

  if (state.status === "upToDate") {
    console.log("Database migrations up to date");
    return;
  }

  if (state.status === "needsMigrations") {
    console.log(`Applying ${state.pendingMigrations.length} pending migration(s)...`);
    await applyPendingMigrations(connectionString);
    console.log("Migrations applied successfully");
  }
}

async function resolveDatabase(): Promise<{
  connectionString: string;
  embeddedPostgres: EmbeddedPostgresInstance | null;
}> {
  const externalUrl = process.env.DATABASE_URL?.trim();
  if (externalUrl) {
    console.log("Using external PostgreSQL via DATABASE_URL");
    await ensureMigrations(externalUrl);
    return { connectionString: externalUrl, embeddedPostgres: null };
  }

  console.log("No DATABASE_URL set — starting embedded PostgreSQL...");

  let EmbeddedPostgres: EmbeddedPostgresCtor;
  try {
    const mod = await import("embedded-postgres");
    EmbeddedPostgres = mod.default as EmbeddedPostgresCtor;
  } catch {
    throw new Error(
      "embedded-postgres not found. Either install it (pnpm add embedded-postgres) or set DATABASE_URL.",
    );
  }

  const dataDir = resolve(
    resolveOwnLabHomeDir(),
    "instances",
    resolveInstanceId(),
    "db",
  );
  const configuredPort = Number(process.env.OWNLAB_EMBEDDED_PG_PORT) || 54329;
  const configuredHost = process.env.OWNLAB_EMBEDDED_PG_HOST?.trim() || "127.0.0.1";
  const clusterVersionFile = resolve(dataDir, "PG_VERSION");
  const clusterAlreadyInitialized = existsSync(clusterVersionFile);
  const postmasterPidFile = resolve(dataDir, "postmaster.pid");
  const runningPid = readRunningPostmasterPid(postmasterPidFile);
  const runningPort = readPidFilePort(postmasterPidFile);

  if (runningPid) {
    const reusedPort = runningPort ?? configuredPort;
    console.log(`Reusing embedded PostgreSQL already running on port ${reusedPort}`);
    const adminUrl = `postgres://ownlab:ownlab@127.0.0.1:${reusedPort}/postgres`;
    const dbStatus = await ensurePostgresDatabase(adminUrl, "ownlab");
    if (dbStatus === "created") {
      console.log("Created database: ownlab");
    }
    const connectionString = `postgres://ownlab:ownlab@127.0.0.1:${reusedPort}/ownlab`;
    await ensureMigrations(connectionString);
    return { connectionString, embeddedPostgres: null };
  }

  const port = await findAvailablePort(configuredPort, configuredHost);
  if (port !== configuredPort) {
    console.log(`Port ${configuredPort} in use, using ${port} instead`);
  }

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "ownlab",
    password: "ownlab",
    port,
    persistent: true,
    onLog: (msg) => {
      if (process.env.OWNLAB_EMBEDDED_PG_VERBOSE === "true") {
        console.log(`[embedded-pg] ${msg}`);
      }
    },
    onError: (msg) => console.error(`[embedded-pg] ${msg}`),
  });

  if (!clusterAlreadyInitialized) {
    console.log(`Initialising embedded PostgreSQL cluster at ${dataDir}...`);
    try {
      await pg.initialise();
    } catch (initErr) {
      console.error("Failed to initialise embedded PostgreSQL:", initErr);
      throw initErr;
    }
  } else {
    console.log(`Embedded PostgreSQL cluster exists at ${dataDir}`);
  }

  if (existsSync(postmasterPidFile)) {
    console.log("Removing stale postmaster.pid");
    rmSync(postmasterPidFile, { force: true });
  }

  try {
    await pg.start();
  } catch (startErr) {
    console.error("Failed to start embedded PostgreSQL:", startErr);
    throw startErr;
  }
  console.log(`Embedded PostgreSQL started on port ${port}`);

  const adminUrl = `postgres://ownlab:ownlab@127.0.0.1:${port}/postgres`;
  const dbStatus = await ensurePostgresDatabase(adminUrl, "ownlab");
  if (dbStatus === "created") {
    console.log("Created database: ownlab");
  }

  const connectionString = `postgres://ownlab:ownlab@127.0.0.1:${port}/ownlab`;
  await ensureMigrations(connectionString);

  return { connectionString, embeddedPostgres: pg };
}

export async function startServer(opts?: {
  host?: string;
  port?: number;
}): Promise<StartedOwnlabServer> {
  const { connectionString, embeddedPostgres } = await resolveDatabase();
  const db = createDb(connectionString);

  const listenPort = opts?.port ?? (Number(process.env.PORT) || 3100);
  const listenHost = opts?.host ?? process.env.HOST?.trim() ?? "127.0.0.1";

  const app = createApp(db);
  const taskScheduler = createTaskScheduler(db);
  const httpServer = await new Promise<HttpServer>((resolvePromise, reject) => {
    const server = app.listen(listenPort, listenHost, () => {
      server.off("error", reject);
      resolvePromise(server);
    });
    server.once("error", reject);
  });

  console.log(`@ownlab/server listening on http://${listenHost}:${listenPort}`);
  taskScheduler.start();

  const stop = async () => {
    taskScheduler.stop();
    await new Promise<void>((resolvePromise, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePromise();
      });
    }).catch(() => {});

    if (embeddedPostgres) {
      console.log("Stopping embedded PostgreSQL...");
      await embeddedPostgres.stop().catch(() => {});
    }
  };

  return {
    host: listenHost,
    port: listenPort,
    apiUrl: `http://${listenHost}:${listenPort}`,
    connectionString,
    stop,
  };
}

async function main() {
  const started = await startServer();

  const shutdown = async () => {
    await started.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("Server startup failed:");
    if (err instanceof Error) {
      console.error(err.message);
      if (err.stack) console.error(err.stack);
    } else {
      console.error("Non-Error thrown:", JSON.stringify(err, null, 2) ?? String(err));
    }
    process.exit(1);
  });
}
