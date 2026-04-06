import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const desktopRoot = process.cwd();
const workspaceRoot = path.resolve(desktopRoot, '../..');
const runtimeRoot = path.join(desktopRoot, '.runtime');

const ownlabPackages = [
  'packages/shared',
  'packages/db',
  'packages/adapter-utils',
  'packages/adapters/claude-local',
  'packages/adapters/codex-local',
  'packages/adapters/cursor-local',
  'packages/adapters/gemini-local',
  'packages/adapters/opencode-local',
  'packages/adapters/pi-local',
  'apps/server',
];

await rm(runtimeRoot, { force: true, recursive: true });
await mkdir(runtimeRoot, { recursive: true });

await stageAppRuntime();
await stageWorkspaceRuntime();

async function stageAppRuntime() {
  const appStandaloneDir = path.join(workspaceRoot, 'apps/app/.next/standalone');
  const appStaticDir = path.join(workspaceRoot, 'apps/app/.next/static');
  const appPublicDir = path.join(workspaceRoot, 'apps/app/public');
  const appRuntimeDir = path.join(runtimeRoot, 'app');

  await cp(appStandaloneDir, appRuntimeDir, { recursive: true });
  await cp(
    appStaticDir,
    path.join(appRuntimeDir, 'apps/app/.next/static'),
    { recursive: true },
  );
  await cp(
    appPublicDir,
    path.join(appRuntimeDir, 'apps/app/public'),
    { recursive: true },
  );
}

async function stageWorkspaceRuntime() {
  const stagedWorkspaceRoot = path.join(runtimeRoot, 'workspace');
  const stagedNodeModulesRoot = path.join(stagedWorkspaceRoot, 'node_modules');

  await cp(
    path.join(workspaceRoot, 'node_modules'),
    stagedNodeModulesRoot,
    { recursive: true },
  );

  await pruneDesktopOnlyDependencies(stagedNodeModulesRoot);

  for (const packagePath of ownlabPackages) {
    const sourceDir = path.join(workspaceRoot, packagePath);
    const targetDir = path.join(stagedWorkspaceRoot, packagePath);

    await mkdir(targetDir, { recursive: true });
    await cp(path.join(sourceDir, 'dist'), path.join(targetDir, 'dist'), { recursive: true });

    try {
      await cp(path.join(sourceDir, 'node_modules'), path.join(targetDir, 'node_modules'), {
        recursive: true,
      });
    } catch {
      // Optional package-local node_modules.
    }

    const packageJsonPath = path.join(sourceDir, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    packageJson.exports = rewriteExports(packageJson.exports);
    if (!packageJson.main) {
      packageJson.main = './dist/index.js';
    }
    await writeFile(
      path.join(targetDir, 'package.json'),
      `${JSON.stringify(packageJson, null, 2)}\n`,
      'utf8',
    );
  }
}

async function pruneDesktopOnlyDependencies(stagedNodeModulesRoot) {
  const removals = [
    'electron',
    'electron-builder',
    'electron-vite',
    '@electron',
  ];

  for (const dependencyName of removals) {
    await rm(path.join(stagedNodeModulesRoot, dependencyName), { force: true, recursive: true });
    await rm(path.join(stagedNodeModulesRoot, '.pnpm', 'node_modules', dependencyName), {
      force: true,
      recursive: true,
    });
  }

  const pnpmStoreDir = path.join(stagedNodeModulesRoot, '.pnpm');
  try {
    const entries = await readDirNames(pnpmStoreDir);
    await Promise.all(
      entries
        .filter((entry) =>
          entry.startsWith('electron@') ||
          entry.startsWith('electron-builder@') ||
          entry.startsWith('electron-vite@') ||
          entry.startsWith('@electron+'),
        )
        .map((entry) => rm(path.join(pnpmStoreDir, entry), { force: true, recursive: true })),
    );
  } catch {
    // Ignore if node_modules uses a different layout.
  }
}

async function readDirNames(dir) {
  return readdir(dir);
}

function rewriteExports(exportsField) {
  if (!exportsField) {
    return exportsField;
  }

  if (typeof exportsField === 'string') {
    return rewritePath(exportsField);
  }

  if (Array.isArray(exportsField)) {
    return exportsField.map((entry) => rewriteExports(entry));
  }

  return Object.fromEntries(
    Object.entries(exportsField).map(([key, value]) => [key, rewriteExports(value)]),
  );
}

function rewritePath(value) {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.startsWith('./src/')) {
    return value.replace('./src/', './dist/').replace(/\.ts$/, '.js');
  }

  if (value === './src/index.ts') {
    return './dist/index.js';
  }

  return value;
}
