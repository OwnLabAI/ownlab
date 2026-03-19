import { existsSync, rmSync } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import detectPort from "detect-port";
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

function resolveOwnLabHomeDir(): string {
  const envHome = process.env.OWNLAB_HOME?.trim();
  if (envHome) return resolve(envHome.replace(/^~/, os.homedir()));
  return resolve(os.homedir(), ".ownlab");
}

function resolveInstanceId(): string {
  return process.env.OWNLAB_INSTANCE_ID?.trim() || "default";
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
  const port = await detectPort(configuredPort);
  if (port !== configuredPort) {
    console.log(`Port ${configuredPort} in use, using ${port} instead`);
  }

  const clusterVersionFile = resolve(dataDir, "PG_VERSION");
  const clusterAlreadyInitialized = existsSync(clusterVersionFile);

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

  const postmasterPidFile = resolve(dataDir, "postmaster.pid");
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

async function main() {
  const { connectionString, embeddedPostgres } = await resolveDatabase();
  const db = createDb(connectionString);

  const listenPort = Number(process.env.PORT) || 3100;

  const app = createApp(db);
  const taskScheduler = createTaskScheduler(db);

  app.listen(listenPort, () => {
    console.log(`@ownlab/server listening on http://localhost:${listenPort}`);
  });
  taskScheduler.start();

  const shutdown = async () => {
    taskScheduler.stop();
    if (embeddedPostgres) {
      console.log("Stopping embedded PostgreSQL...");
      await embeddedPostgres.stop().catch(() => {});
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

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
