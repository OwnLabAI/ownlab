import { app } from 'electron';
import path from 'node:path';
import { DesktopRuntimeConfig } from '../config';
import { waitForHttpReady } from '../health';
import { findAvailablePort } from '../ports';
import { ManagedProcess } from './managed-process';
import { cleanupStaleNextDevLock } from './next-dev-lock';
import { resolveRuntimeExecPath } from './runtime-exec-path';

export interface StartedOwnlabRuntime {
  appUrl: string;
  serverUrl: string;
  stop(): Promise<void>;
}

export async function startOwnlabRuntime(config: DesktopRuntimeConfig): Promise<StartedOwnlabRuntime> {
  const host = '127.0.0.1';
  const reusedRuntime = await resolveReusableRuntime(config);
  if (reusedRuntime) {
    return reusedRuntime;
  }

  if (!config.isPackaged) {
    await cleanupStaleNextDevLock(config.appDevCwd);
  }

  const serverPort = await findAvailablePort(3100, host);
  const appPort = await findAvailablePort(3000, host);
  const serverUrl = `http://${host}:${serverPort}`;
  const appUrl = `http://${host}:${appPort}`;

  const serverProcess = new ManagedProcess(
    config.isPackaged
      ? createPackagedServerProcess(config, serverPort, host)
      : createDevServerProcess(config, serverPort, host),
  );
  serverProcess.start();

  try {
    await waitForHttpReady(`${serverUrl}/health`);
  } catch (error) {
    await serverProcess.stop().catch(() => {});
    throw enrichStartupError(error, 'ownlab-server', serverProcess);
  }

  const appProcess = new ManagedProcess(
    config.isPackaged
      ? createPackagedAppProcess(config, appPort, host, serverUrl)
      : createDevAppProcess(config, appPort, host, serverUrl),
  );
  appProcess.start();

  try {
    await waitForHttpReady(appUrl);
  } catch (error) {
    await Promise.allSettled([appProcess.stop(), serverProcess.stop()]);
    throw enrichStartupError(error, 'ownlab-app', appProcess);
  }

  return {
    appUrl,
    serverUrl,
    stop: async () => {
      await Promise.all([appProcess.stop(), serverProcess.stop()]);
    },
  };
}

function createPackagedServerProcess(config: DesktopRuntimeConfig, port: number, host: string) {
  return {
    name: 'ownlab-server',
    command: getPackagedRuntimeCommand(config),
    args: [config.serverRuntimeEntry],
    cwd: config.serverRuntimeCwd,
    env: {
      ...process.env,
      ...createNodeRuntimeEnv(),
      HOST: host,
      PORT: String(port),
      OWNLAB_HOME: config.ownlabHomeDir,
    },
    logFilePath: path.join(config.logsDir, 'server.log'),
  };
}

function createDevServerProcess(config: DesktopRuntimeConfig, port: number, host: string) {
  return {
    name: 'ownlab-server-dev',
    command: config.tsxBinPath,
    args: ['watch', 'src/index.ts'],
    cwd: config.serverDevCwd,
    env: {
      ...process.env,
      ...createNodeRuntimeEnv(),
      HOST: host,
      PORT: String(port),
      OWNLAB_HOME: config.ownlabHomeDir,
    },
    logFilePath: path.join(config.logsDir, 'server.log'),
  };
}

function createPackagedAppProcess(
  config: DesktopRuntimeConfig,
  port: number,
  host: string,
  serverUrl: string,
) {
  return {
    name: 'ownlab-app',
    command: getPackagedRuntimeCommand(config),
    args: [config.appRuntimeEntry],
    cwd: config.appRuntimeCwd,
    env: createAppEnv(config, port, host, serverUrl),
    logFilePath: path.join(config.logsDir, 'app.log'),
  };
}

function createDevAppProcess(
  config: DesktopRuntimeConfig,
  port: number,
  host: string,
  serverUrl: string,
) {
  return {
    name: 'ownlab-app-dev',
    command: config.nextBinPath,
    args: ['dev', '--hostname', host, '--port', String(port), '--webpack'],
    cwd: config.appDevCwd,
    env: createAppEnv(config, port, host, serverUrl),
    logFilePath: path.join(config.logsDir, 'app.log'),
  };
}

function createAppEnv(
  config: DesktopRuntimeConfig,
  port: number,
  host: string,
  serverUrl: string,
): NodeJS.ProcessEnv {
  const appUrl = `http://${host}:${port}`;

  return {
    ...process.env,
    ...createNodeRuntimeEnv(),
    HOSTNAME: host,
    PORT: String(port),
    OWNLAB_SERVER_URL: serverUrl,
    NEXT_PUBLIC_OWNLAB_SERVER_URL: serverUrl,
    NEXT_PUBLIC_WWW_URL: config.wwwBaseUrl,
    WWW_INTERNAL_URL: config.wwwInternalUrl,
    OWNLAB_DESKTOP_AUTH_ENABLED: 'true',
    NEXT_PUBLIC_OWNLAB_DESKTOP: 'true',
    NEXT_PUBLIC_APP_URL: appUrl,
  };
}

function createNodeRuntimeEnv(): NodeJS.ProcessEnv {
  return {
    ELECTRON_RUN_AS_NODE: '1',
    ELECTRON_NO_ASAR: app.isPackaged ? '1' : process.env.ELECTRON_NO_ASAR,
  };
}

function getPackagedRuntimeCommand(config: DesktopRuntimeConfig): string {
  return resolveRuntimeExecPath({
    appName: app.getName(),
    execPath: process.execPath,
    isPackaged: config.isPackaged,
    platform: process.platform,
  });
}

function enrichStartupError(
  error: unknown,
  processName: string,
  managedProcess: ManagedProcess,
): Error {
  const baseMessage = error instanceof Error ? error.message : String(error);
  const logFilePath = managedProcess.getLogFilePath();
  const recentOutput = managedProcess.getRecentOutput();
  const diagnosticParts = [
    `${processName} failed to become ready: ${baseMessage}`,
    logFilePath ? `Log file: ${logFilePath}` : null,
    recentOutput ? `Recent output:\n${recentOutput}` : null,
  ].filter(Boolean);

  return new Error(diagnosticParts.join('\n\n'));
}

async function resolveReusableRuntime(
  config: DesktopRuntimeConfig,
): Promise<StartedOwnlabRuntime | null> {
  if (config.isPackaged) {
    return null;
  }

  const explicitAppUrl = config.appExternalUrl;
  const explicitServerUrl = config.serverExternalUrl;
  if (explicitAppUrl || explicitServerUrl) {
    if (!explicitAppUrl || !explicitServerUrl) {
      throw new Error(
        'OWNLAB_DESKTOP_APP_URL and OWNLAB_DESKTOP_SERVER_URL must be provided together.',
      );
    }

    await ensureReusableRuntimeReady(explicitAppUrl, explicitServerUrl, true);
    console.info('[desktop-runtime] reusing explicit dev services', {
      appUrl: explicitAppUrl,
      serverUrl: explicitServerUrl,
    });
    return createExternalRuntime(explicitAppUrl, explicitServerUrl);
  }

  if (!config.reuseExistingDevServices) {
    return null;
  }

  const defaultServerUrl = 'http://127.0.0.1:3100';
  const defaultAppUrl = 'http://127.0.0.1:3000';
  const canReuseDefaultRuntime = await ensureReusableRuntimeReady(
    defaultAppUrl,
    defaultServerUrl,
    false,
  );

  if (!canReuseDefaultRuntime) {
    return null;
  }

  console.info('[desktop-runtime] reusing existing local dev services', {
    appUrl: defaultAppUrl,
    serverUrl: defaultServerUrl,
  });
  return createExternalRuntime(defaultAppUrl, defaultServerUrl);
}

async function ensureReusableRuntimeReady(
  appUrl: string,
  serverUrl: string,
  strict: boolean,
): Promise<boolean> {
  const [appReady, serverReady] = await Promise.all([
    isReusableAppReady(appUrl),
    isReusableServerReady(serverUrl),
  ]);

  if (appReady && serverReady) {
    return true;
  }

  if (!strict) {
    return false;
  }

  const failures = [
    !appReady ? `app runtime is not reachable at ${appUrl}` : null,
    !serverReady ? `server runtime is not reachable at ${serverUrl}/health` : null,
  ].filter(Boolean);

  throw new Error(`Failed to reuse external OwnLab services: ${failures.join('; ')}`);
}

async function isReusableAppReady(appUrl: string): Promise<boolean> {
  try {
    await waitForHttpReady(appUrl, {
      timeoutMs: 1_000,
      intervalMs: 250,
    });
    return true;
  } catch {
    return false;
  }
}

async function isReusableServerReady(serverUrl: string): Promise<boolean> {
  try {
    await waitForHttpReady(`${serverUrl}/health`, {
      timeoutMs: 1_000,
      intervalMs: 250,
    });
    return true;
  } catch {
    return false;
  }
}

function createExternalRuntime(appUrl: string, serverUrl: string): StartedOwnlabRuntime {
  return {
    appUrl,
    serverUrl,
    stop: async () => {},
  };
}
