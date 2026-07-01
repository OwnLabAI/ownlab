import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const desktopRoot = process.cwd();
const workspaceRoot = path.resolve(desktopRoot, '../..');
const runtimeRoot = path.join(desktopRoot, '.runtime');
const serverRuntimeDir = path.join(runtimeRoot, 'server');

await rm(runtimeRoot, { force: true, recursive: true });
await mkdir(runtimeRoot, { recursive: true });

await stageAppRuntime();
await stageServerRuntime();

async function stageAppRuntime() {
  const appStandaloneDir = path.join(workspaceRoot, 'apps/app/.next/standalone');
  const appStaticDir = path.join(workspaceRoot, 'apps/app/.next/static');
  const appPublicDir = path.join(workspaceRoot, 'apps/app/public');
  const appRuntimeDir = path.join(runtimeRoot, 'app');

  await cp(appStandaloneDir, appRuntimeDir, {
    recursive: true,
    dereference: true,
  });
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

  await pruneRuntimeArtifacts(appRuntimeDir);
}

async function stageServerRuntime() {
  execFileSync(
    'pnpm',
    ['--offline', '--filter', '@ownlab/server', '--prod', 'deploy', serverRuntimeDir],
    {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        CI: process.env.CI ?? '1',
      },
    },
  );

  await rewriteRuntimePackageJson(path.join(serverRuntimeDir, 'package.json'));
  await rm(path.join(serverRuntimeDir, 'src'), { force: true, recursive: true });
  await rewriteBundledOwnlabPackages(serverRuntimeDir);
  await pruneRuntimeArtifacts(serverRuntimeDir);
}

async function readDirNames(dir) {
  return readdir(dir);
}

async function rewriteRuntimePackageJson(packageJsonPath) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  packageJson.exports = rewriteExports(packageJson.exports);
  packageJson.main = rewritePath(packageJson.main ?? './dist/index.js');

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

async function rewriteBundledOwnlabPackages(runtimeDir) {
  const bundledRoots = [
    path.join(runtimeDir, 'node_modules', '@ownlab'),
    path.join(runtimeDir, 'node_modules', '.pnpm'),
  ];

  for (const bundledRoot of bundledRoots) {
    if (!(await pathExists(bundledRoot))) {
      continue;
    }

    if (bundledRoot.endsWith('.pnpm')) {
      const entries = await readDirNames(bundledRoot);
      for (const entry of entries.filter((candidate) => candidate.startsWith('@ownlab+'))) {
        const packageScopeRoot = path.join(bundledRoot, entry, 'node_modules', '@ownlab');
        if (!(await pathExists(packageScopeRoot))) {
          continue;
        }

        const packageNames = await readDirNames(packageScopeRoot);
        for (const packageName of packageNames) {
          const packageDir = path.join(packageScopeRoot, packageName);
          await rewriteOwnlabPackageDir(packageDir);
        }
      }
      continue;
    }

    const packageNames = await readDirNames(bundledRoot);
    for (const packageName of packageNames) {
      const packageDir = path.join(bundledRoot, packageName);
      await rewriteOwnlabPackageDir(packageDir);
    }
  }
}

async function rewriteOwnlabPackageDir(packageDir) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!(await pathExists(packageJsonPath))) {
    return;
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  if (typeof packageJson.name !== 'string' || !packageJson.name.startsWith('@ownlab/')) {
    return;
  }

  packageJson.exports = rewriteExports(packageJson.exports);
  if (packageJson.main) {
    packageJson.main = rewritePath(packageJson.main);
  } else {
    packageJson.main = './dist/index.js';
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  await rm(path.join(packageDir, 'src'), { force: true, recursive: true });
  await rm(path.join(packageDir, 'test'), { force: true, recursive: true });
  await rm(path.join(packageDir, '__tests__'), { force: true, recursive: true });
  await rm(path.join(packageDir, 'tsconfig.json'), { force: true });
  await rm(path.join(packageDir, 'vitest.config.ts'), { force: true });
}

async function pruneRuntimeArtifacts(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === '__tests__') {
          await rm(entryPath, { force: true, recursive: true });
          return;
        }

        await pruneRuntimeArtifacts(entryPath);
        return;
      }

      if (
        entry.name.endsWith('.d.ts') ||
        entry.name.endsWith('.d.ts.map') ||
        entry.name.endsWith('.js.map') ||
        entry.name.endsWith('.tsbuildinfo') ||
        entry.name === 'tsconfig.json' ||
        entry.name === 'vitest.config.ts'
      ) {
        await rm(entryPath, { force: true });
      }
    }),
  );
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
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
