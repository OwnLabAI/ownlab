import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const serverRoot = process.cwd();

function walkAndPrune(rootDir, shouldRemove) {
  if (!existsSync(rootDir)) return;
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.resolve(current, entry.name);

      if (shouldRemove(fullPath, entry.name, entry.isDirectory())) {
        rmSync(fullPath, { recursive: true, force: true });
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(fullPath);
      }
    }
  }
}

function removeEmptyDirs(rootDir) {
  if (!existsSync(rootDir)) return;
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.resolve(rootDir, entry.name);
    removeEmptyDirs(fullPath);
  }

  if (rootDir === serverRoot) return;

  if (readdirSync(rootDir).length === 0) {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

const distDir = path.resolve(serverRoot, "dist");
const runtimeDir = path.resolve(serverRoot, "runtime");

walkAndPrune(distDir, (_fullPath, name, isDirectory) => {
  if (isDirectory && name === "__tests__") return true;
  if (!isDirectory && name.endsWith(".map")) return true;
  return false;
});

walkAndPrune(runtimeDir, (_fullPath, name, isDirectory) => {
  if (isDirectory && name === "__tests__") return true;
  if (!isDirectory && name.endsWith(".map")) return true;
  return false;
});

removeEmptyDirs(distDir);
removeEmptyDirs(runtimeDir);

const runtimeCount = existsSync(runtimeDir) ? readdirSync(runtimeDir, { recursive: true }).length : 0;
const distCount = readdirSync(distDir, { recursive: true }).length;
process.stdout.write(`Pruned publish assets. dist entries=${distCount}, runtime entries=${runtimeCount}\n`);
