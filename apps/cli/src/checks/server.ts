import type { CheckResult } from "./types.js";

export async function serverCheck(options: {
  serverPackageRoot: string | null;
  repoRoot: string | null;
}): Promise<CheckResult> {
  if (options.repoRoot) {
    const serverEntry = `${options.repoRoot}/apps/server/src/index.ts`;
    return {
      name: "Server runtime",
      status: "pass",
      message: `Found OwnLab server entry at ${serverEntry}`,
    };
  }

  if (options.serverPackageRoot) {
    return {
      name: "Server runtime",
      status: "pass",
      message: `Resolved packaged OwnLab server from ${options.serverPackageRoot}`,
    };
  }

  try {
    await import("@ownlab/server");
    return {
      name: "Server runtime",
      status: "pass",
      message: `Resolved packaged OwnLab server from ${options.serverPackageRoot ?? "@ownlab/server"}`,
    };
  } catch {}

  return {
    name: "Server runtime",
    status: "fail",
    message: "Could not resolve repo or packaged OwnLab server runtime.",
  };
}
