type HostedSession = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  session?: {
    id?: string;
  } | null;
} | null;

interface OwnlabDesktopApi {
  auth: {
    getSession(): Promise<HostedSession>;
    login(callbackUrl?: string): Promise<void>;
    refreshSession(): Promise<HostedSession>;
    signOut(): Promise<void>;
  };
  shell: {
    openExternal(url: string): Promise<void>;
  };
  system: {
    platform: NodeJS.Platform;
    isMacOS: boolean;
  };
}

declare global {
  interface Window {
    ownlabDesktop?: OwnlabDesktopApi;
  }
}

export {};
