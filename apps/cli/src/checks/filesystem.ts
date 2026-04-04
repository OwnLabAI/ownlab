import fs from "node:fs";
import path from "node:path";
import { type OwnlabCliConfig } from "../config/schema.js";
import type { CheckResult } from "./types.js";

function checkPathWritable(targetPath: string): boolean {
  const parentDir = fs.existsSync(targetPath) ? targetPath : path.dirname(targetPath);
  try {
    fs.mkdirSync(parentDir, { recursive: true });
    fs.accessSync(parentDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function filesystemCheck(config: OwnlabCliConfig): CheckResult[] {
  const targets = [
    ["OwnLab home", config.runtime.ownlabHome],
    ["Log dir", config.runtime.logDir],
    ["Backup dir", config.runtime.backupDir],
    ["Cache dir", config.runtime.cacheDir],
    ["Embedded Postgres dir", config.database.embeddedPostgresDataDir],
  ] as const;

  return targets.map(([name, targetPath]) => ({
    name,
    status: checkPathWritable(targetPath) ? "pass" : "fail",
    message: checkPathWritable(targetPath)
      ? `${name} is writable: ${targetPath}`
      : `${name} is not writable: ${targetPath}`,
  }));
}
