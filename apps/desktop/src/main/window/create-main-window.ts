import { BrowserWindow, nativeImage, shell } from 'electron';
import path from 'node:path';

export function createMainWindow(): BrowserWindow {
  const icon = loadDesktopIcon();
  const isMacOS = process.platform === 'darwin';
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#09111f',
    icon,
    titleBarStyle: isMacOS ? 'hiddenInset' : 'default',
    ...(isMacOS
      ? {
          trafficLightPosition: {
            x: 16,
            y: 14,
          },
        }
      : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, '../preload/index.mjs'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}

function loadDesktopIcon() {
  const iconPath = path.resolve(__dirname, '../../../../app/public/icon.svg');
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? undefined : image;
}
