import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopSessionStore } from '../../src/main/auth/desktop-session-store';

const tempRoots: string[] = [];

describe('DesktopSessionStore', () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('persists and restores a hosted session', async () => {
    const root = await createTempRoot();
    const store = new DesktopSessionStore(root, createCryptoAdapter());
    const session = {
      user: {
        id: 'user_123',
        email: 'test@ownlab.ai',
      },
      session: {
        id: 'session_123',
      },
    };

    await store.save(session);

    await expect(store.load()).resolves.toEqual(session);
  });

  it('clears the persisted session when saving null', async () => {
    const root = await createTempRoot();
    const store = new DesktopSessionStore(root, createCryptoAdapter());

    await store.save({
      user: { id: 'user_123' },
      session: { id: 'session_123' },
    });
    await store.save(null);

    await expect(store.load()).resolves.toBeNull();
  });
});

function createCryptoAdapter() {
  return {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8'),
  };
}

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ownlab-desktop-session-'));
  tempRoots.push(root);
  return root;
}
