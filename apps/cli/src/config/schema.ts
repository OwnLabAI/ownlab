export type OwnlabCliConfig = {
  version: 1;
  server: {
    host: string;
    port: number;
  };
  web: {
    host: string;
    port: number;
    mode: "local-next";
  };
  database: {
    mode: "embedded-postgres" | "postgres";
    connectionString?: string;
    embeddedPostgresDataDir: string;
    embeddedPostgresPort: number;
  };
  runtime: {
    ownlabHome: string;
    instanceId: string;
    logDir: string;
    backupDir: string;
    cacheDir: string;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPort(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 65535;
}

export function validateOwnlabCliConfig(value: unknown): OwnlabCliConfig {
  if (!isObject(value)) {
    throw new Error("Config must be an object");
  }

  const { version, server, web, database, runtime } = value;
  if (version !== 1) {
    throw new Error("Config version must be 1");
  }
  if (!isObject(server) || typeof server.host !== "string" || !isPort(server.port)) {
    throw new Error("Config server.host/server.port are required");
  }
  if (
    !isObject(web) ||
    typeof web.host !== "string" ||
    !isPort(web.port) ||
    web.mode !== "local-next"
  ) {
    throw new Error("Config web.host/web.port/web.mode are required");
  }
  if (
    !isObject(database) ||
    (database.mode !== "embedded-postgres" && database.mode !== "postgres") ||
    typeof database.embeddedPostgresDataDir !== "string" ||
    !isPort(database.embeddedPostgresPort)
  ) {
    throw new Error("Config database settings are invalid");
  }
  if (
    !isObject(runtime) ||
    typeof runtime.ownlabHome !== "string" ||
    typeof runtime.instanceId !== "string" ||
    typeof runtime.logDir !== "string" ||
    typeof runtime.backupDir !== "string" ||
    typeof runtime.cacheDir !== "string"
  ) {
    throw new Error("Config runtime settings are invalid");
  }

  return {
    version: 1,
    server: {
      host: server.host,
      port: server.port,
    },
    web: {
      host: web.host,
      port: web.port,
      mode: "local-next",
    },
    database: {
      mode: database.mode,
      ...(typeof database.connectionString === "string"
        ? { connectionString: database.connectionString }
        : {}),
      embeddedPostgresDataDir: database.embeddedPostgresDataDir,
      embeddedPostgresPort: database.embeddedPostgresPort,
    },
    runtime: {
      ownlabHome: runtime.ownlabHome,
      instanceId: runtime.instanceId,
      logDir: runtime.logDir,
      backupDir: runtime.backupDir,
      cacheDir: runtime.cacheDir,
    },
  };
}
