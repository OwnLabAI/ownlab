import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveRuntimeExecPath } from '../../src/main/runtime/runtime-exec-path';

describe('resolveRuntimeExecPath', () => {
  it('uses the macOS helper app for packaged builds when available', () => {
    const execPath = '/Applications/OwnLab.app/Contents/MacOS/OwnLab';
    const expected = path.join(
      '/Applications/OwnLab.app/Contents',
      'Frameworks',
      'OwnLab Helper.app',
      'Contents',
      'MacOS',
      'OwnLab Helper',
    );

    const resolved = resolveRuntimeExecPath({
      appName: 'OwnLab',
      execPath,
      isPackaged: true,
      platform: 'darwin',
      pathExists: (targetPath) => targetPath === expected,
    });

    expect(resolved).toBe(expected);
  });

  it('falls back to the current executable when the helper is unavailable', () => {
    const execPath = '/Applications/OwnLab.app/Contents/MacOS/OwnLab';

    const resolved = resolveRuntimeExecPath({
      appName: 'OwnLab',
      execPath,
      isPackaged: true,
      platform: 'darwin',
      pathExists: () => false,
    });

    expect(resolved).toBe(execPath);
  });

  it('keeps the current executable outside packaged macOS builds', () => {
    const execPath = '/Applications/OwnLab.app/Contents/MacOS/OwnLab';

    expect(
      resolveRuntimeExecPath({
        appName: 'OwnLab',
        execPath,
        isPackaged: false,
        platform: 'darwin',
      }),
    ).toBe(execPath);

    expect(
      resolveRuntimeExecPath({
        appName: 'OwnLab',
        execPath,
        isPackaged: true,
        platform: 'linux',
      }),
    ).toBe(execPath);
  });
});
