import fs from "node:fs";
import {
  describeLocalInstancePaths,
  resolveOwnlabHomeDir,
  resolveOwnlabInstanceId,
} from "../config/home.js";
import { mergeOwnlabEnvEntries, resolveOwnlabEnvFile } from "../config/env.js";
import { writeConfig } from "../config/store.js";
import type { OwnlabCliConfig } from "../config/schema.js";

export type OnboardOptions = {
  config?: string;
  instance?: string;
  yes?: boolean;
  serverPort?: string | number;
  webPort?: string | number;
};

function toPort(value: string | number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

export async function onboard(opts: OnboardOptions): Promise<void> {
  const instanceId = resolveOwnlabInstanceId(opts.instance);
  const paths = describeLocalInstancePaths(instanceId);
  const serverPort = toPort(opts.serverPort, 3100);
  const webPort = toPort(opts.webPort, 3000);
  const ownlabHome = resolveOwnlabHomeDir();
  const configPath = opts.config ?? paths.configPath;

  fs.mkdirSync(paths.instanceRoot, { recursive: true });
  fs.mkdirSync(paths.logDir, { recursive: true });
  fs.mkdirSync(paths.backupDir, { recursive: true });
  fs.mkdirSync(paths.cacheDir, { recursive: true });

  process.env.OWNLAB_HOME = ownlabHome;
  process.env.OWNLAB_INSTANCE_ID = instanceId;

  const config: OwnlabCliConfig = {
    version: 1,
    server: {
      host: "127.0.0.1",
      port: serverPort,
    },
    web: {
      host: "127.0.0.1",
      port: webPort,
      mode: "local-next",
    },
    database: {
      mode: process.env.DATABASE_URL?.trim() ? "postgres" : "embedded-postgres",
      ...(process.env.DATABASE_URL?.trim()
        ? { connectionString: process.env.DATABASE_URL.trim() }
        : {}),
      embeddedPostgresDataDir: paths.dbDir,
      embeddedPostgresPort: Number(process.env.OWNLAB_EMBEDDED_PG_PORT) || 54329,
    },
    runtime: {
      ownlabHome,
      instanceId,
      logDir: paths.logDir,
      backupDir: paths.backupDir,
      cacheDir: paths.cacheDir,
    },
  };

  writeConfig(config, configPath);
  const envPath = resolveOwnlabEnvFile(configPath);
  mergeOwnlabEnvEntries(
    {
      OWNLAB_HOME: ownlabHome,
      OWNLAB_INSTANCE_ID: instanceId,
      OWNLAB_SERVER_PORT: String(serverPort),
      OWNLAB_SERVER_URL: `http://127.0.0.1:${serverPort}`,
      NEXT_PUBLIC_OWNLAB_SERVER_URL: `http://127.0.0.1:${serverPort}`,
      OWNLAB_WEB_PORT: String(webPort),
      PORT: String(serverPort),
      HOST: "127.0.0.1",
      OWNLAB_EMBEDDED_PG_PORT: String(config.database.embeddedPostgresPort),
    },
    envPath,
  );

  process.stdout.write(
    [
      "OwnLab onboarding complete.",
      `Instance: ${instanceId}`,
      `Config: ${configPath}`,
      `Env: ${envPath}`,
      `Next: pnpm ownlab run --instance ${instanceId}`,
      "",
    ].join("\n"),
  );
}
