import { configExists, readConfig } from "../config/store.js";
import type { CheckResult } from "./types.js";

export function configCheck(configPath?: string): CheckResult {
  if (!configExists(configPath)) {
    return {
      name: "Config file",
      status: "fail",
      message: "No config file found. Run `ownlab onboard --yes` first.",
    };
  }

  try {
    readConfig(configPath);
    return {
      name: "Config file",
      status: "pass",
      message: "Config file exists and is valid.",
    };
  } catch (error) {
    return {
      name: "Config file",
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
