declare module "@ownlab/server" {
  export type StartedOwnlabServer = {
    host: string;
    port: number;
    apiUrl: string;
    connectionString: string;
    stop(): Promise<void>;
  };

  export function startServer(opts?: {
    host?: string;
    port?: number;
  }): Promise<StartedOwnlabServer>;
}
