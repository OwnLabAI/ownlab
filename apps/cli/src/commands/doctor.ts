import {
  configCheck,
  envCheck,
  filesystemCheck,
  nodeCheck,
  portChecks,
  serverCheck,
  webCheck,
  type CheckResult,
} from "../checks/index.js";
import { loadOwnlabEnvFile } from "../config/env.js";
import { resolveDefaultConfigPath } from "../config/home.js";
import { readConfig, resolveConfigPath } from "../config/store.js";
import {
  findCliPackageRoot,
  findInstalledServerPackageRoot,
  findInstalledWebPackageRoot,
  findRepoRoot,
} from "../runtime/paths.js";

const STATUS_ICON = {
  pass: "PASS",
  warn: "WARN",
  fail: "FAIL",
} as const;

export type DoctorOptions = {
  config?: string;
  instance?: string;
};

function printResult(result: CheckResult): void {
  process.stdout.write(`${STATUS_ICON[result.status]} ${result.name}: ${result.message}\n`);
}

export async function doctor(opts: DoctorOptions): Promise<{ passed: number; warned: number; failed: number }> {
  const configPath = resolveConfigPath(opts.config ?? resolveDefaultConfigPath(opts.instance));
  loadOwnlabEnvFile(configPath);

  const cliPackageRoot = findCliPackageRoot(import.meta.url);
  const repoRoot = findRepoRoot(cliPackageRoot);
  const serverPackageRoot = repoRoot ? null : findInstalledServerPackageRoot(import.meta.url);
  const webPackageRoot = repoRoot ? null : findInstalledWebPackageRoot(import.meta.url);
  const results: CheckResult[] = [];

  const cfg = configCheck(opts.config);
  results.push(cfg);
  printResult(cfg);
  if (cfg.status === "fail") {
    return summarize(results);
  }

  const env = envCheck(opts.config);
  results.push(env);
  printResult(env);

  const node = nodeCheck();
  results.push(node);
  printResult(node);

  const server = await serverCheck({ serverPackageRoot, repoRoot });
  results.push(server);
  printResult(server);

  const web = webCheck({ webPackageRoot, repoRoot });
  results.push(web);
  printResult(web);

  const config = readConfig(opts.config);
  if (!config) {
    return summarize(results);
  }

  for (const result of filesystemCheck(config)) {
    results.push(result);
    printResult(result);
  }

  for (const result of await portChecks(config)) {
    results.push(result);
    printResult(result);
  }

  return summarize(results);
}

function summarize(results: CheckResult[]): { passed: number; warned: number; failed: number } {
  const passed = results.filter((result) => result.status === "pass").length;
  const warned = results.filter((result) => result.status === "warn").length;
  const failed = results.filter((result) => result.status === "fail").length;
  process.stdout.write(`Summary: ${passed} passed, ${warned} warnings, ${failed} failed\n`);
  return { passed, warned, failed };
}
