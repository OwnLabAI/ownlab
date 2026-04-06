export async function waitForHttpReady(
  url: string,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
  },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 90_000;
  const intervalMs = options?.intervalMs ?? 700;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok || isRedirect(response.status)) {
        return;
      }
    } catch {
      // Service is still starting.
    }

    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
