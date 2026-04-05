import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readPackageName(packageJsonPath: string): string | null {
  try {
    const raw = fs.readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { name?: string };
    return parsed.name ?? null;
  } catch {
    return null;
  }
}

export function findCliPackageRoot(fromImportMetaUrl: string): string {
  let currentDir = path.dirname(fileURLToPath(fromImportMetaUrl));

  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath) && readPackageName(packageJsonPath) === "ownlab") {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return path.resolve(path.dirname(fileURLToPath(fromImportMetaUrl)), "../..");
}

export function findRepoRoot(cliPackageRoot: string): string | null {
  const candidates = [
    path.resolve(cliPackageRoot, "../.."),
    path.resolve(cliPackageRoot, "../../.."),
    process.cwd(),
  ];

  for (const candidate of candidates) {
    const serverEntry = path.resolve(candidate, "apps/server/src/index.ts");
    const webPackageJson = path.resolve(candidate, "apps/app/package.json");
    if (fs.existsSync(serverEntry) && fs.existsSync(webPackageJson)) {
      return candidate;
    }
  }

  return null;
}

export function findInstalledServerPackageRoot(fromImportMetaUrl: string): string | null {
  const cliPackageRoot = findCliPackageRoot(fromImportMetaUrl);
  const siblingCandidates = [
    path.resolve(cliPackageRoot, "../@ownlab/server"),
    path.resolve(cliPackageRoot, "../../@ownlab/server"),
  ];

  for (const candidate of siblingCandidates) {
    const packageJsonPath = path.resolve(candidate, "package.json");
    if (fs.existsSync(packageJsonPath) && readPackageName(packageJsonPath) === "@ownlab/server") {
      return candidate;
    }
  }

  try {
    const require = createRequire(fromImportMetaUrl);
    const serverEntry = require.resolve("@ownlab/server");
    return path.resolve(serverEntry, "..", "..");
  } catch {
    return null;
  }
}

export function findInstalledWebPackageRoot(fromImportMetaUrl: string): string | null {
  const cliPackageRoot = findCliPackageRoot(fromImportMetaUrl);
  const siblingCandidates = [
    path.resolve(cliPackageRoot, "../@ownlab/app"),
    path.resolve(cliPackageRoot, "../../@ownlab/app"),
  ];

  for (const candidate of siblingCandidates) {
    const packageJsonPath = path.resolve(candidate, "package.json");
    if (fs.existsSync(packageJsonPath) && readPackageName(packageJsonPath) === "@ownlab/app") {
      return candidate;
    }
  }

  try {
    const require = createRequire(fromImportMetaUrl);
    const webPackageJson = require.resolve("@ownlab/app/package.json");
    return path.dirname(webPackageJson);
  } catch {
    return null;
  }
}

export function getInstalledWebNextBinPath(webPackageRoot: string): string {
  return path.resolve(webPackageRoot, "node_modules/next/dist/bin/next");
}

export function hasInstalledWebPackage(webPackageRoot: string | null): boolean {
  if (!webPackageRoot) return false;

  return (
    fs.existsSync(path.resolve(webPackageRoot, ".next/BUILD_ID")) &&
    fs.existsSync(getInstalledWebNextBinPath(webPackageRoot))
  );
}
