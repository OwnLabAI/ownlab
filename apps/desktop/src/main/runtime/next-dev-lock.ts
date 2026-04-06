import fs from 'node:fs/promises';
import path from 'node:path';
import { waitForHttpReady } from '../health';

type NextDevLock = {
  pid: number;
  port: number;
  hostname: string;
  appUrl: string;
  startedAt?: number;
};

export async function cleanupStaleNextDevLock(appDevCwd: string): Promise<void> {
  const lockPath = path.join(appDevCwd, '.next', 'dev', 'lock');
  const lock = await readNextDevLock(lockPath);
  if (!lock) {
    return;
  }

  if (await isHealthy(lock.appUrl)) {
    return;
  }

  console.warn('[desktop-runtime] clearing stale Next dev lock', {
    lockPath,
    pid: lock.pid,
    appUrl: lock.appUrl,
  });

  await terminateIfRunning(lock.pid);
  await fs.rm(lockPath, { force: true });
}

async function readNextDevLock(lockPath: string): Promise<NextDevLock | null> {
  try {
    const raw = await fs.readFile(lockPath, 'utf8');
    return JSON.parse(raw) as NextDevLock;
  } catch {
    return null;
  }
}

async function isHealthy(url: string): Promise<boolean> {
  try {
    await waitForHttpReady(url, {
      timeoutMs: 500,
      intervalMs: 100,
    });
    return true;
  } catch {
    return false;
  }
}

async function terminateIfRunning(pid: number | undefined): Promise<void> {
  if (!pid || pid <= 0) {
    return;
  }

  try {
    process.kill(pid, 0);
  } catch {
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }

  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (!(await isProcessAlive(pid))) {
      return;
    }
    await sleep(100);
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Ignore races with a process that exited on its own.
  }
}

async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
