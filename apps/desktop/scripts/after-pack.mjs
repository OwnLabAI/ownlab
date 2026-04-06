import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readlinkSync, rmSync } from 'node:fs';
import path from 'node:path';

function removeBrokenSymlinks(dir) {
  if (!existsSync(dir)) {
    return;
  }

  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    let stat;

    try {
      stat = lstatSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isSymbolicLink()) {
      try {
        const target = readlinkSync(fullPath);
        const resolved = target.startsWith('/') ? target : path.resolve(dir, target);
        if (!existsSync(resolved)) {
          rmSync(fullPath, { force: true });
        }
      } catch {
        rmSync(fullPath, { force: true });
      }
      continue;
    }

    if (stat.isDirectory()) {
      removeBrokenSymlinks(fullPath);
    }
  }
}

function stripBundleMetadata(appPath) {
  removeBrokenSymlinks(path.join(appPath, 'Contents'));

  try {
    execFileSync('dot_clean', [appPath]);
  } catch {
    // Best effort only.
  }

  execFileSync('sh', ['-c', `find "${appPath}" -name "._*" -delete 2>/dev/null; find "${appPath}" -name ".DS_Store" -delete 2>/dev/null; true`]);
  execFileSync('sh', ['-c', `find "${appPath}" ! -type l -print0 | xargs -0 -n 200 xattr -c 2>/dev/null; true`]);
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  stripBundleMetadata(appPath);
}
