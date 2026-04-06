import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { HostedSession } from '../../shared/desktop-api';

export interface DesktopAuthCallbackPayload {
  callbackUrl?: string | null;
  session?: HostedSession;
}

export class AuthCallbackServer {
  private server: http.Server | null = null;
  private port: number | null = null;
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly onPayload: (payload: DesktopAuthCallbackPayload) => Promise<void>,
    allowedOrigins: string[],
  ) {
    this.allowedOrigins = new Set(allowedOrigins);
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', () => {
        const address = this.server!.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Failed to resolve auth callback server address'));
          return;
        }

        this.port = address.port;
        console.info('[desktop-auth] callback server listening', {
          callbackUrl: this.getCallbackUrl(),
          allowedOrigins: [...this.allowedOrigins],
        });
        resolve();
      });
    });
  }

  getCallbackUrl(): string {
    if (!this.port) {
      throw new Error('Auth callback server is not started');
    }

    return `http://127.0.0.1:${this.port}/desktop-auth/callback`;
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    const currentServer = this.server;
    this.server = null;
    this.port = null;

    await new Promise<void>((resolve, reject) => {
      currentServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST' || req.url !== '/desktop-auth/callback') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    try {
      const body = await readJsonBody<DesktopAuthCallbackPayload>(req);
      console.info('[desktop-auth] received hosted session callback', {
        origin: req.headers.origin ?? null,
        callbackUrl: body.callbackUrl ?? null,
        hasSession: !!body.session?.user,
      });
      await this.onPayload(body);
      res.writeHead(204);
      res.end();
    } catch (error) {
      console.error('[desktop-auth] callback server failed:', error);
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid desktop auth payload' }));
    }
  }

  private applyCorsHeaders(req: IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin;
    if (origin && this.allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
}

function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(raw) as T);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}
