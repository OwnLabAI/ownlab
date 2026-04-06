import { type BrowserWindow, type Session, shell } from 'electron';
import type { HostedSession } from '../../shared/desktop-api';
import { buildDesktopCallbackTarget, createLoopbackOriginMatchers } from './desktop-auth-url';
import { DesktopSessionStore } from './desktop-session-store';

const DESKTOP_SESSION_HEADER = 'x-ownlab-hosted-session';

export class HostedSessionBridge {
  private cachedSession: HostedSession = null;
  private readonly wwwBaseUrl: string;
  private readonly appBaseUrl: string;
  private readonly appOrigins: string[];

  constructor(
    private readonly browserSession: Session,
    appUrl: string,
    wwwBaseUrl: string,
    private readonly sessionStore: DesktopSessionStore,
  ) {
    this.wwwBaseUrl = wwwBaseUrl;
    this.appBaseUrl = appUrl;
    this.appOrigins = createLoopbackOriginMatchers(appUrl);
    this.installHeaderInjection();
  }

  getSession(): HostedSession {
    return this.cachedSession;
  }

  async restoreSession(): Promise<HostedSession> {
    this.cachedSession = await this.sessionStore.load();
    return this.cachedSession;
  }

  async refreshSession(): Promise<HostedSession> {
    const cookieHeader = await this.buildCookieHeader(this.wwwBaseUrl);
    if (!cookieHeader) {
      return this.cachedSession;
    }

    try {
      const response = await fetch(new URL('/api/auth/get-session', this.wwwBaseUrl), {
        headers: {
          cookie: cookieHeader,
        },
      });

      if (!response.ok) {
        return this.cachedSession;
      }

      this.cachedSession = (await response.json()) as HostedSession;
      await this.sessionStore.save(this.cachedSession);
      return this.cachedSession;
    } catch (error) {
      console.error('[desktop-auth] failed to refresh hosted session:', error);
      return this.cachedSession;
    }
  }

  async openLoginFlow(
    _parentWindow: BrowserWindow,
    callbackUrl: string,
    desktopCallbackUrl: string,
  ): Promise<void> {
    const normalizedCallbackUrl = buildDesktopCallbackTarget(callbackUrl, this.appBaseUrl);
    const completionUrl = new URL('/desktop/complete', this.wwwBaseUrl);
    completionUrl.searchParams.set('appCallbackUrl', normalizedCallbackUrl);
    completionUrl.searchParams.set('desktopCallbackUrl', desktopCallbackUrl);

    const loginUrl = new URL('/auth/login', this.wwwBaseUrl);
    loginUrl.searchParams.set('callbackUrl', completionUrl.toString());

    console.info('[desktop-auth] opening hosted login flow', {
      loginUrl: loginUrl.toString(),
      callbackUrl: normalizedCallbackUrl,
      desktopCallbackUrl,
    });

    await shell.openExternal(loginUrl.toString());
  }

  async clearSession(): Promise<void> {
    this.cachedSession = null;
    await this.sessionStore.clear();
  }

  async applySession(session: HostedSession): Promise<void> {
    this.cachedSession = session;
    await this.sessionStore.save(session);
  }

  private installHeaderInjection(): void {
    this.browserSession.webRequest.onBeforeSendHeaders(
      {
        urls: this.appOrigins.map((origin) => `${origin}/*`),
      },
      (details, callback) => {
        const encodedSession = encodeHostedSession(this.cachedSession);
        if (encodedSession) {
          details.requestHeaders[DESKTOP_SESSION_HEADER] = encodedSession;
        } else {
          delete details.requestHeaders[DESKTOP_SESSION_HEADER];
        }
        callback({ requestHeaders: details.requestHeaders });
      },
    );
  }

  private async buildCookieHeader(url: string): Promise<string> {
    const cookies = await this.browserSession.cookies.get({ url });
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  }
}

function encodeHostedSession(session: HostedSession): string | null {
  if (!session?.user) {
    return null;
  }

  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
}
