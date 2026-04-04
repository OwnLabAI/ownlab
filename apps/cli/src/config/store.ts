import fs from "node:fs";
import path from "node:path";
import { resolveDefaultConfigPath, resolveOwnlabInstanceId } from "./home.js";
import { type OwnlabCliConfig, validateOwnlabCliConfig } from "./schema.js";

const DEFAULT_CONFIG_BASENAME = "config.json";

function findConfigFileFromAncestors(startDir: string): string | null {
  let currentDir = path.resolve(startDir);

  while (true) {
    const candidate = path.resolve(currentDir, ".ownlab", DEFAULT_CONFIG_BASENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolveConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.OWNLAB_CONFIG) return path.resolve(process.env.OWNLAB_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath(resolveOwnlabInstanceId());
}

export function configExists(configPath?: string): boolean {
  return fs.existsSync(resolveConfigPath(configPath));
}

export function readConfig(configPath?: string): OwnlabCliConfig | null {
  const filePath = resolveConfigPath(configPath);
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  return validateOwnlabCliConfig(raw);
}

export function writeConfig(config: OwnlabCliConfig, configPath?: string): string {
  const filePath = resolveConfigPath(configPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  return filePath;
}
