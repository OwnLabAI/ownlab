import type { CheckResult } from "./types.js";
import { hasInstalledWebPackage } from "../runtime/paths.js";

export function webCheck(options: {
  webPackageRoot: string | null;
  repoRoot: string | null;
}): CheckResult {
  if (options.repoRoot) {
    const webPackageJson = `${options.repoRoot}/apps/web/package.json`;
    return {
      name: "Web runtime",
      status: "pass",
      message: `Found OwnLab web app at ${webPackageJson}`,
    };
  }

  if (hasInstalledWebPackage(options.webPackageRoot)) {
    return {
      name: "Web runtime",
      status: "pass",
      message: `Found packaged OwnLab web runtime at ${options.webPackageRoot}`,
    };
  }

  return {
    name: "Web runtime",
    status: "fail",
    message: "Could not find repo or installed OwnLab web runtime.",
  };
}
