import type { CheckResult } from "./types.js";
import { hasInstalledWebPackage } from "../runtime/paths.js";

export function webCheck(options: {
  webPackageRoot: string | null;
  repoRoot: string | null;
}): CheckResult {
  if (options.repoRoot) {
    const webPackageJson = `${options.repoRoot}/apps/app/package.json`;
    return {
      name: "App runtime",
      status: "pass",
      message: `Found OwnLab app at ${webPackageJson}`,
    };
  }

  if (hasInstalledWebPackage(options.webPackageRoot)) {
    return {
      name: "App runtime",
      status: "pass",
      message: `Found packaged OwnLab app runtime at ${options.webPackageRoot}`,
    };
  }

  return {
    name: "App runtime",
    status: "fail",
    message: "Could not find repo or installed OwnLab app runtime.",
  };
}
