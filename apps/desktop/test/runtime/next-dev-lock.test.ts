import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupStaleNextDevLock } from '../../src/main/runtime/next-dev-lock';

const tempRoots: string[] = [];

describe('cleanupStaleNextDevLock', () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('removes an unreachable next dev lock file', async () => {
    const root = await createTempRoot();
    const lockPath = path.join(root, '.next', 'dev', 'lock');
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(
      lockPath,
      JSON.stringify({
        pid: 999999,
        port: 3000,
        hostname: 'localhost',
        appUrl: 'http://127.0.0.1:65530',
      }),
      'utf8',
    );

    await cleanupStaleNextDevLock(root);

    await expect(fs.stat(lockPath)).rejects.toThrow();
  });
});

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ownlab-next-lock-'));
  tempRoots.push(root);
  return root;
}
