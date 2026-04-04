import fs from "node:fs";
import { resolveOwnlabEnvFile } from "../config/env.js";
import type { CheckResult } from "./types.js";

export function envCheck(configPath?: string): CheckResult {
  const envFile = resolveOwnlabEnvFile(configPath);
  if (!fs.existsSync(envFile)) {
    return {
      name: ".env file",
      status: "warn",
      message: `No .env file found at ${envFile}. It will be created during onboard.`,
    };
  }

  return {
    name: ".env file",
    status: "pass",
    message: `.env file found at ${envFile}.`,
  };
}
