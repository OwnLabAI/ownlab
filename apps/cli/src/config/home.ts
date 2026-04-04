import os from "node:os";
import path from "node:path";

const DEFAULT_INSTANCE_ID = "default";
const INSTANCE_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function resolveOwnlabHomeDir(): string {
  const envHome = process.env.OWNLAB_HOME?.trim();
  if (envHome) return path.resolve(expandHomePrefix(envHome));
  return path.resolve(os.homedir(), ".ownlab");
}

export function resolveOwnlabInstanceId(override?: string): string {
  const raw = override?.trim() || process.env.OWNLAB_INSTANCE_ID?.trim() || DEFAULT_INSTANCE_ID;
  if (!INSTANCE_ID_RE.test(raw)) {
    throw new Error(`Invalid instance id '${raw}'. Allowed characters: letters, numbers, '_' and '-'.`);
  }
  return raw;
}

export function resolveOwnlabInstanceRoot(instanceId?: string): string {
  return path.resolve(resolveOwnlabHomeDir(), "instances", resolveOwnlabInstanceId(instanceId));
}

export function resolveDefaultConfigPath(instanceId?: string): string {
  return path.resolve(resolveOwnlabInstanceRoot(instanceId), "config.json");
}

export function resolveDefaultEnvPath(instanceId?: string): string {
  return path.resolve(resolveOwnlabInstanceRoot(instanceId), ".env");
}

export function resolveDefaultDbDir(instanceId?: string): string {
  return path.resolve(resolveOwnlabInstanceRoot(instanceId), "db");
}

export function resolveDefaultLogDir(instanceId?: string): string {
  return path.resolve(resolveOwnlabInstanceRoot(instanceId), "logs");
}

export function resolveDefaultBackupDir(instanceId?: string): string {
  return path.resolve(resolveOwnlabInstanceRoot(instanceId), "data", "backups");
}

export function resolveDefaultCacheDir(instanceId?: string): string {
  return path.resolve(resolveOwnlabInstanceRoot(instanceId), "cache");
}

export function describeLocalInstancePaths(instanceId?: string) {
  const resolvedInstanceId = resolveOwnlabInstanceId(instanceId);
  const instanceRoot = resolveOwnlabInstanceRoot(resolvedInstanceId);
  return {
    homeDir: resolveOwnlabHomeDir(),
    instanceId: resolvedInstanceId,
    instanceRoot,
    configPath: resolveDefaultConfigPath(resolvedInstanceId),
    envPath: resolveDefaultEnvPath(resolvedInstanceId),
    dbDir: resolveDefaultDbDir(resolvedInstanceId),
    logDir: resolveDefaultLogDir(resolvedInstanceId),
    backupDir: resolveDefaultBackupDir(resolvedInstanceId),
    cacheDir: resolveDefaultCacheDir(resolvedInstanceId),
  };
}
