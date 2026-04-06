import { safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { HostedSession } from '../../shared/desktop-api';

type CryptoAdapter = {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
};

const defaultCryptoAdapter: CryptoAdapter = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (value) => safeStorage.encryptString(value),
  decryptString: (value) => safeStorage.decryptString(value),
};

export class DesktopSessionStore {
  private readonly filePath: string;

  constructor(
    userDataRoot: string,
    private readonly cryptoAdapter: CryptoAdapter = defaultCryptoAdapter,
  ) {
    this.filePath = path.join(userDataRoot, 'auth', 'hosted-session.bin');
  }

  async load(): Promise<HostedSession> {
    try {
      const raw = await fs.readFile(this.filePath);
      const json = this.cryptoAdapter.isEncryptionAvailable()
        ? this.cryptoAdapter.decryptString(raw)
        : raw.toString('utf8');
      return JSON.parse(json) as HostedSession;
    } catch {
      return null;
    }
  }

  async save(session: HostedSession): Promise<void> {
    if (!session?.user) {
      await this.clear();
      return;
    }

    const payload = JSON.stringify(session);
    const content = this.cryptoAdapter.isEncryptionAvailable()
      ? this.cryptoAdapter.encryptString(payload)
      : Buffer.from(payload, 'utf8');

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, content);
  }

  async clear(): Promise<void> {
    await fs.rm(this.filePath, { force: true });
  }
}
