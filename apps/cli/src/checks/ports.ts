import net from "node:net";
import { type OwnlabCliConfig } from "../config/schema.js";
import type { CheckResult } from "./types.js";

function checkPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function portChecks(config: OwnlabCliConfig): Promise<CheckResult[]> {
  const serverFree = await checkPortFree(config.server.port, config.server.host);
  const webFree = await checkPortFree(config.web.port, config.web.host);

  return [
    {
      name: "Server port",
      status: serverFree ? "pass" : "warn",
      message: serverFree
        ? `Port ${config.server.port} is available.`
        : `Port ${config.server.port} is already in use. This may be fine if OwnLab is already running.`,
    },
    {
      name: "Web port",
      status: webFree ? "pass" : "warn",
      message: webFree
        ? `Port ${config.web.port} is available.`
        : `Port ${config.web.port} is already in use. This may be fine if the web app is already running.`,
    },
  ];
}
