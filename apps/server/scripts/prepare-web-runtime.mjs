import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const serverRoot = process.cwd();
const repoRoot = path.resolve(serverRoot, "../..");
const runtimeRoot = path.resolve(serverRoot, "runtime");
const webRoot = path.resolve(repoRoot, "apps/web");

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA: "1",
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, dereference: true });
}

function copyStandaloneAppNodeModules(fromStandaloneDir, toRuntimeDir) {
  const sourceAppNodeModulesDir = path.resolve(fromStandaloneDir, "apps/web/node_modules");
  if (!existsSync(sourceAppNodeModulesDir)) return;

  const targetAppNodeModulesDir = path.resolve(toRuntimeDir, "apps/web/node_modules");
  mkdirSync(targetAppNodeModulesDir, { recursive: true });

  for (const entry of readdirSync(sourceAppNodeModulesDir)) {
    const sourceEntry = path.resolve(sourceAppNodeModulesDir, entry);
    const targetEntry = path.resolve(targetAppNodeModulesDir, entry);
    if (existsSync(targetEntry)) continue;
    const stats = lstatSync(sourceEntry);
    const copySource = stats.isSymbolicLink() ? realpathSync(sourceEntry) : sourceEntry;
    cpSync(copySource, targetEntry, { recursive: true, dereference: true });
  }
}

function removeIfExists(targetPath) {
  if (!existsSync(targetPath)) return;
  rmSync(targetPath, { recursive: true, force: true });
}

function pruneOptionalImageDependencies(runtimeWebDir) {
  const pnpmDir = path.resolve(runtimeWebDir, "node_modules/.pnpm");
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (entry.startsWith("sharp@") || entry.startsWith("@img+sharp")) {
        removeIfExists(path.resolve(pnpmDir, entry));
      }
    }
  }

  removeIfExists(path.resolve(runtimeWebDir, "node_modules/sharp"));
  removeIfExists(path.resolve(runtimeWebDir, "node_modules/@img"));
}

rmSync(runtimeRoot, { recursive: true, force: true });
mkdirSync(runtimeRoot, { recursive: true });

run("pnpm", ["--filter", "@ownlab/web", "build"]);

const standaloneDir = path.resolve(webRoot, ".next/standalone");
const staticDir = path.resolve(webRoot, ".next/static");
const publicDir = path.resolve(webRoot, "public");
const runtimeWebDir = path.resolve(runtimeRoot, "web");

if (!existsSync(standaloneDir)) {
  throw new Error(`Expected standalone build at ${standaloneDir}`);
}

cpSync(standaloneDir, runtimeWebDir, { recursive: true, dereference: true });
copyStandaloneAppNodeModules(standaloneDir, runtimeWebDir);
copyIfExists(staticDir, path.resolve(runtimeWebDir, ".next/static"));
copyIfExists(publicDir, path.resolve(runtimeWebDir, "public"));
pruneOptionalImageDependencies(runtimeWebDir);
