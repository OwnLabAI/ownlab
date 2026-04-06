import { ipcMain, shell, type BrowserWindow } from 'electron';
import { HostedSessionBridge } from '../auth/hosted-session-bridge';

export function registerDesktopHandlers(
  mainWindow: BrowserWindow,
  sessionBridge: HostedSessionBridge,
  desktopCallbackUrl: string,
): void {
  ipcMain.removeHandler('desktop:auth:get-session');
  ipcMain.removeHandler('desktop:auth:login');
  ipcMain.removeHandler('desktop:auth:refresh-session');
  ipcMain.removeHandler('desktop:auth:sign-out');
  ipcMain.removeHandler('desktop:shell:open-external');

  ipcMain.handle('desktop:auth:get-session', () => sessionBridge.getSession());
  ipcMain.handle('desktop:auth:refresh-session', () => sessionBridge.refreshSession());
  ipcMain.handle('desktop:auth:login', async (_event, args: { callbackUrl?: string }) => {
    const callbackUrl = args.callbackUrl?.trim() || mainWindow.webContents.getURL();
    await sessionBridge.openLoginFlow(mainWindow, callbackUrl, desktopCallbackUrl);
  });
  ipcMain.handle('desktop:auth:sign-out', async () => {
    await sessionBridge.clearSession();
  });
  ipcMain.handle('desktop:shell:open-external', async (_event, args: { url: string }) => {
    await shell.openExternal(args.url);
  });
}
