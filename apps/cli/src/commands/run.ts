import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { doctor } from "./doctor.js";
import { loadOwnlabEnvFile } from "../config/env.js";
import { configExists, readConfig, resolveConfigPath } from "../config/store.js";
import { onboard } from "./onboard.js";
import {
  findCliPackageRoot,
  findInstalledServerPackageRoot,
  findInstalledWebPackageRoot,
  findRepoRoot,
  getInstalledWebNextBinPath,
  hasInstalledWebPackage,
} from "../runtime/paths.js";

type RunOptions = {
  config?: string;
  instance?: string;
  noWeb?: boolean;
};

type StartedOwnlabServer = {
  host: string;
  port: number;
  apiUrl: string;
  connectionString: string;
  stop(): Promise<void>;
};

type StartServerModule = {
  startServer: (opts?: { host?: string; port?: number }) => Promise<StartedOwnlabServer>;
};

function waitForUrl(url: string, timeoutMs = 30_000): Promise<void> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
        if (response.ok || response.status < 500) {
          resolve();
          return;
        }
      } catch {}

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    void tick();
  });
}

async function importServerEntry(repoRoot: string | null): Promise<StartServerModule> {
  if (repoRoot) {
    const localEntry = path.resolve(repoRoot, "apps/server/src/index.ts");
    return (await import(pathToFileURL(localEntry).href)) as StartServerModule;
  }

  return (await import("@ownlab/server")) as StartServerModule;
}

function spawnWeb(
  webPackageRoot: string | null,
  repoRoot: string | null,
  env: NodeJS.ProcessEnv,
  port: number,
): ChildProcess {
  if (hasInstalledWebPackage(webPackageRoot)) {
    const nextBinPath = getInstalledWebNextBinPath(webPackageRoot!);
    return spawn("node", [nextBinPath, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: webPackageRoot!,
      env: {
        ...env,
        BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA: "1",
      },
      stdio: "inherit",
    });
  }

  if (!repoRoot) {
    throw new Error("Could not find packaged or repo OwnLab app runtime.");
  }

  return spawn(
    "pnpm",
    [
      "--filter",
      "@ownlab/app",
      "exec",
      "next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: repoRoot,
      env: {
        ...env,
        BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA: "1",
      },
      stdio: "inherit",
    },
  );
}

export async function runCommand(opts: RunOptions): Promise<void> {
  if (opts.instance) {
    process.env.OWNLAB_INSTANCE_ID = opts.instance;
  }

  const configPath = resolveConfigPath(opts.config);
  process.env.OWNLAB_CONFIG = configPath;

  if (!configExists(configPath)) {
    await onboard({
      config: configPath,
      instance: opts.instance,
      yes: true,
    });
  }

  loadOwnlabEnvFile(configPath);
  const summary = await doctor({ config: configPath });
  if (summary.failed > 0) {
    throw new Error("Doctor reported blocking issues.");
  }

  const config = readConfig(configPath);
  if (!config) {
    throw new Error(`No config found at ${configPath}`);
  }

  const env = {
    ...process.env,
    OWNLAB_HOME: config.runtime.ownlabHome,
    OWNLAB_INSTANCE_ID: config.runtime.instanceId,
    OWNLAB_SERVER_URL: `http://${config.server.host}:${config.server.port}`,
    NEXT_PUBLIC_OWNLAB_SERVER_URL: `http://${config.server.host}:${config.server.port}`,
    PORT: String(config.server.port),
    HOST: config.server.host,
    OWNLAB_EMBEDDED_PG_PORT: String(config.database.embeddedPostgresPort),
    ...(config.database.connectionString
      ? { DATABASE_URL: config.database.connectionString }
      : {}),
  };
  Object.assign(process.env, env);

  const cliPackageRoot = findCliPackageRoot(import.meta.url);
  const repoRoot = findRepoRoot(cliPackageRoot);
  const serverPackageRoot = repoRoot ? null : findInstalledServerPackageRoot(import.meta.url);
  const webPackageRoot = repoRoot ? null : findInstalledWebPackageRoot(import.meta.url);
  const serverModule = await importServerEntry(repoRoot);
  const startedServer = await serverModule.startServer({
    host: config.server.host,
    port: config.server.port,
  });

  let webProcess: ChildProcess | null = null;
  let stopping = false;

  const stopAll = async () => {
    if (stopping) return;
    stopping = true;
    if (webProcess?.pid) {
      webProcess.kill("SIGTERM");
    }
    await startedServer.stop();
  };

  process.on("SIGINT", () => {
    void stopAll().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void stopAll().finally(() => process.exit(0));
  });

  process.stdout.write(`OwnLab API: ${startedServer.apiUrl}\n`);

  if (opts.noWeb) {
    process.stdout.write("App startup skipped (--no-web).\n");
    return;
  }

  webProcess = spawnWeb(webPackageRoot, repoRoot, env, config.web.port);
  webProcess.on("exit", (code) => {
    if (!stopping) {
      process.stderr.write(`OwnLab app exited with code ${code ?? 0}\n`);
      void stopAll().finally(() => process.exit(code ?? 1));
    }
  });

  const webUrl = `http://${config.web.host}:${config.web.port}`;
  await waitForUrl(webUrl).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  });
  process.stdout.write(`OwnLab App: ${webUrl}\n`);
  process.stdout.write("Press Ctrl+C to stop OwnLab.\n");
}
