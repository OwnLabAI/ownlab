import { contextBridge, ipcRenderer } from 'electron';
import type { OwnlabDesktopApi } from '../shared/desktop-api';

const api: OwnlabDesktopApi = {
  auth: {
    getSession: () => ipcRenderer.invoke('desktop:auth:get-session'),
    login: (callbackUrl?: string) => ipcRenderer.invoke('desktop:auth:login', { callbackUrl }),
    refreshSession: () => ipcRenderer.invoke('desktop:auth:refresh-session'),
    signOut: () => ipcRenderer.invoke('desktop:auth:sign-out'),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('desktop:shell:open-external', { url }),
  },
  system: {
    platform: process.platform,
    isMacOS: process.platform === 'darwin',
  },
};

contextBridge.exposeInMainWorld('ownlabDesktop', api);
