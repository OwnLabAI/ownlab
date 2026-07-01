import { existsSync } from 'node:fs';
import path from 'node:path';

export interface ResolveRuntimeExecPathOptions {
  appName: string;
  execPath: string;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  pathExists?: (targetPath: string) => boolean;
}

export function resolveRuntimeExecPath(options: ResolveRuntimeExecPathOptions): string {
  if (!options.isPackaged || options.platform !== 'darwin') {
    return options.execPath;
  }

  const pathExists = options.pathExists ?? existsSync;
  const contentsDir = path.resolve(options.execPath, '..', '..');
  const candidateNames = new Set(
    [options.appName.trim(), path.parse(options.execPath).name.trim()].filter(Boolean),
  );

  for (const candidateName of candidateNames) {
    const helperName = `${candidateName} Helper`;
    const helperExecPath = path.join(
      contentsDir,
      'Frameworks',
      `${helperName}.app`,
      'Contents',
      'MacOS',
      helperName,
    );

    if (pathExists(helperExecPath)) {
      return helperExecPath;
    }
  }

  return options.execPath;
}
