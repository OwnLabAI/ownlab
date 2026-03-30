export type HealthOptions = {
  /** Base URL of the OwnLab API (no trailing slash), e.g. http://localhost:3100 */
  url: string;
};

export async function runHealth(opts: HealthOptions): Promise<void> {
  const base = opts.url.replace(/\/$/, "");
  const healthUrl = `${base}/health`;
  const res = await fetch(healthUrl, {
    signal: AbortSignal.timeout(8_000),
  });
  const text = await res.text();
  if (!res.ok) {
    process.stderr.write(
      `OwnLab API at ${healthUrl} returned ${res.status}: ${text.slice(0, 500)}\n`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`OK — ${healthUrl} (${res.status})\n`);
  if (text.trim()) {
    process.stdout.write(`${text.trim()}\n`);
  }
}
