import { app } from 'electron';
import path from 'node:path';

const DEV_WWW_BASE_URL = 'http://localhost:3001';
const DEV_WWW_INTERNAL_URL = 'http://127.0.0.1:3001';
const PROD_WWW_BASE_URL = 'https://www.ownlab.app';
const PROD_WWW_INTERNAL_URL = 'https://www.ownlab.app';

export interface DesktopRuntimeConfig {
  isPackaged: boolean;
  userDataRoot: string;
  logsDir: string;
  ownlabHomeDir: string;
  wwwBaseUrl: string;
  wwwInternalUrl: string;
  appExternalUrl: string | null;
  serverExternalUrl: string | null;
  reuseExistingDevServices: boolean;
  workspaceRoot: string;
  appRuntimeDir: string;
  appRuntimeCwd: string;
  appRuntimeEntry: string;
  serverRuntimeRoot: string;
  serverRuntimeCwd: string;
  serverRuntimeEntry: string;
  appDevCwd: string;
  serverDevCwd: string;
  nextBinPath: string;
  tsxBinPath: string;
}

export function createDesktopRuntimeConfig(): DesktopRuntimeConfig {
  const workspaceRoot = path.resolve(app.getAppPath(), '../..');
  const runtimeRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'runtime')
    : path.join(app.getAppPath(), '.runtime');
  const userDataRoot = app.getPath('userData');
  const defaultWwwBaseUrl = app.isPackaged ? PROD_WWW_BASE_URL : DEV_WWW_BASE_URL;
  const defaultWwwInternalUrl = app.isPackaged ? PROD_WWW_INTERNAL_URL : DEV_WWW_INTERNAL_URL;

  return {
    isPackaged: app.isPackaged,
    userDataRoot,
    logsDir: path.join(userDataRoot, 'logs'),
    ownlabHomeDir: path.join(userDataRoot, 'ownlab'),
    wwwBaseUrl: process.env.OWNLAB_WWW_URL?.trim() || defaultWwwBaseUrl,
    wwwInternalUrl: process.env.OWNLAB_WWW_INTERNAL_URL?.trim() || defaultWwwInternalUrl,
    appExternalUrl: process.env.OWNLAB_DESKTOP_APP_URL?.trim() || null,
    serverExternalUrl: process.env.OWNLAB_DESKTOP_SERVER_URL?.trim() || null,
    reuseExistingDevServices:
      process.env.OWNLAB_DESKTOP_REUSE_EXISTING?.trim() !== 'false',
    workspaceRoot,
    appRuntimeDir: path.join(runtimeRoot, 'app'),
    appRuntimeCwd: path.join(runtimeRoot, 'app', 'apps/app'),
    appRuntimeEntry: path.join(runtimeRoot, 'app', 'apps/app', 'server.js'),
    serverRuntimeRoot: path.join(runtimeRoot, 'server'),
    serverRuntimeCwd: path.join(runtimeRoot, 'server'),
    serverRuntimeEntry: path.join(runtimeRoot, 'server', 'dist', 'index.js'),
    appDevCwd: path.join(workspaceRoot, 'apps/app'),
    serverDevCwd: path.join(workspaceRoot, 'apps/server'),
    nextBinPath: path.join(workspaceRoot, 'apps/app/node_modules/.bin/next'),
    tsxBinPath: path.join(workspaceRoot, 'apps/desktop/node_modules/.bin/tsx'),
  };
}
