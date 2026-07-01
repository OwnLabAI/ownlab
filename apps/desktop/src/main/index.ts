import { app, BrowserWindow, dialog, shell } from 'electron';
import path from 'node:path';
import { AuthCallbackServer, type DesktopAuthCallbackPayload } from './auth/auth-callback-server';
import { buildDesktopCallbackTarget } from './auth/desktop-auth-url';
import { DesktopSessionStore } from './auth/desktop-session-store';
import { createDesktopRuntimeConfig } from './config';
import { HostedSessionBridge } from './auth/hosted-session-bridge';
import { registerDesktopHandlers } from './ipc/register-handlers';
import { startOwnlabRuntime, type StartedOwnlabRuntime } from './runtime/ownlab-runtime';
import { createMainWindow } from './window/create-main-window';

let mainWindow: BrowserWindow | null = null;
let runtime: StartedOwnlabRuntime | null = null;
let sessionBridge: HostedSessionBridge | null = null;
let authCallbackServer: AuthCallbackServer | null = null;
const pendingProtocolUrls: string[] = [];

const DESKTOP_PROTOCOL = 'ownlab';
const DESKTOP_AUTH_COMPLETE_URL = `${DESKTOP_PROTOCOL}://auth/complete`;
const DEFAULT_AUTH_CALLBACK_ORIGINS = [
  'https://www.ownlab.app',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

async function bootstrap() {
  const lockAcquired = app.requestSingleInstanceLock();
  if (!lockAcquired) {
    app.quit();
    return;
  }

  app.on('second-instance', (_event, argv) => {
    const protocolUrl = argv.find((arg) => arg.startsWith(`${DESKTOP_PROTOCOL}://`));
    if (protocolUrl) {
      void handleDesktopProtocolUrl(protocolUrl);
    }

    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });

  const config = createDesktopRuntimeConfig();
  registerDesktopProtocol();

  const startupProtocolUrl = process.argv.find((arg) => arg.startsWith(`${DESKTOP_PROTOCOL}://`));
  if (startupProtocolUrl) {
    pendingProtocolUrls.push(startupProtocolUrl);
  }

  mainWindow = createMainWindow();
  await loadSplashScreen(mainWindow);

  runtime = await startOwnlabRuntime(config);
  const sessionStore = new DesktopSessionStore(config.userDataRoot);

  sessionBridge = new HostedSessionBridge(
    mainWindow.webContents.session,
    runtime.appUrl,
    config.wwwBaseUrl,
    sessionStore,
  );

  authCallbackServer = new AuthCallbackServer(
    async (payload: DesktopAuthCallbackPayload) => {
      if (!sessionBridge || !mainWindow) {
        return;
      }

      await sessionBridge.applySession(payload.session ?? null);
      const appBaseUrl = runtime?.appUrl ?? 'http://localhost:3000';
      const callbackTarget = buildDesktopCallbackTarget(payload.callbackUrl, appBaseUrl);
      console.info('[desktop-auth] loading callback target in desktop window', {
        requestedCallbackUrl: payload.callbackUrl ?? null,
        callbackTarget,
      });
      await mainWindow.loadURL(callbackTarget);
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    },
    buildAllowedAuthCallbackOrigins(config),
  );
  await authCallbackServer.start();

  await sessionBridge.restoreSession();
  await sessionBridge.refreshSession();

  registerDesktopHandlers(mainWindow, sessionBridge, authCallbackServer.getCallbackUrl());
  installMainWindowNavigationPolicy(
    mainWindow,
    runtime.appUrl,
    sessionBridge,
    authCallbackServer.getCallbackUrl(),
  );

  mainWindow.on('focus', () => {
    void sessionBridge?.refreshSession();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      return;
    }
    void logDesktopBridgeState(mainWindow);
  });

  await mainWindow.loadURL(runtime.appUrl);

  while (pendingProtocolUrls.length > 0) {
    const protocolUrl = pendingProtocolUrls.shift();
    if (protocolUrl) {
      await handleDesktopProtocolUrl(protocolUrl);
    }
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (!app.isReady()) {
    pendingProtocolUrls.push(url);
    return;
  }

  void handleDesktopProtocolUrl(url);
});

app.whenReady().then(async () => {
  try {
    await bootstrap();
  } catch (error) {
    console.error('[desktop] startup failed:', error);
    dialog.showErrorBox(
      'OwnLab Desktop failed to start',
      error instanceof Error ? error.stack || error.message : String(error),
    );
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await bootstrap();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (authCallbackServer) {
    await authCallbackServer.stop().catch((error) => {
      console.error('[desktop] failed to stop auth callback server:', error);
    });
    authCallbackServer = null;
  }
  if (runtime) {
    await runtime.stop().catch((error) => {
      console.error('[desktop] failed to stop child services:', error);
    });
    runtime = null;
  }
});

async function loadSplashScreen(window: BrowserWindow) {
  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  await window.loadFile(path.join(app.getAppPath(), 'out/renderer/index.html'));
}

function installMainWindowNavigationPolicy(
  window: BrowserWindow,
  appUrl: string,
  hostedSessionBridge: HostedSessionBridge,
  desktopCallbackUrl: string,
) {
  const allowedOrigins = new Set<string>([new URL(appUrl).origin]);
  const appOrigin = new URL(appUrl).origin;

  if (process.env.ELECTRON_RENDERER_URL) {
    allowedOrigins.add(new URL(process.env.ELECTRON_RENDERER_URL).origin);
  }

  window.webContents.on('will-navigate', (event, targetUrl) => {
    const parsedTargetUrl = new URL(targetUrl);

    if (
      parsedTargetUrl.origin === appOrigin &&
      parsedTargetUrl.pathname === '/desktop-auth/launch'
    ) {
      event.preventDefault();
      const callbackUrl =
        parsedTargetUrl.searchParams.get('callbackUrl') || `${appUrl}/lab/workspaces`;
      void hostedSessionBridge.openLoginFlow(window, callbackUrl, desktopCallbackUrl);
      return;
    }

    if (allowedOrigins.has(parsedTargetUrl.origin)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(targetUrl);
  });
}

function registerDesktopProtocol() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    return;
  }

  app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL);
}

async function handleDesktopProtocolUrl(url: string) {
  if (!url.startsWith(`${DESKTOP_PROTOCOL}://`)) {
    return;
  }

  if (!mainWindow) {
    return;
  }

  if (url === DESKTOP_AUTH_COMPLETE_URL) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

async function logDesktopBridgeState(window: BrowserWindow) {
  try {
    const state = await window.webContents.executeJavaScript(`
      (() => ({
        href: window.location.href,
        hasDesktopBridge: !!window.ownlabDesktop,
        ownlabKeys: Object.keys(window).filter((key) => key.toLowerCase().includes('ownlab')),
      }))()
    `, true);
    console.info('[desktop] renderer bridge state', state);
  } catch (error) {
    console.error('[desktop] failed to inspect renderer bridge state:', error);
  }
}

function buildAllowedAuthCallbackOrigins(config: ReturnType<typeof createDesktopRuntimeConfig>): string[] {
  const origins = new Set<string>();

  for (const candidate of [config.wwwBaseUrl, config.wwwInternalUrl]) {
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // Ignore invalid URLs so desktop startup does not fail on a bad env var.
    }
  }

  for (const origin of DEFAULT_AUTH_CALLBACK_ORIGINS) {
    origins.add(origin);
  }

  return [...origins];
}
