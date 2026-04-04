import type { CheckResult } from "./types.js";

export function nodeCheck(): CheckResult {
  const major = Number(process.versions.node.split(".")[0] ?? "0");
  if (major < 20) {
    return {
      name: "Node.js version",
      status: "fail",
      message: `Node.js 20+ is required. Current version: ${process.versions.node}`,
    };
  }

  return {
    name: "Node.js version",
    status: "pass",
    message: `Node.js version is supported: ${process.versions.node}`,
  };
}
