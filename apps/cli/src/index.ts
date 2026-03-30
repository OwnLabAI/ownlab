import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { ADAPTER_TYPE_LABELS } from "@ownlab/shared";
import { runHealth } from "./commands/health.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as {
  version: string;
};

const program = new Command();

program
  .name("ownlab")
  .description("OwnLab CLI — operate and diagnose your local lab")
  .version(pkg.version);

program
  .command("health")
  .description("Check that the OwnLab API server responds (GET /health)")
  .option(
    "-u, --url <baseUrl>",
    "API base URL",
    process.env.OWNLAB_API_URL ?? "http://localhost:3100",
  )
  .action(async (opts: { url: string }) => {
    await runHealth({ url: opts.url });
  });

program
  .command("info")
  .description("Print a short product hint (uses shared constants)")
  .action(() => {
    const sample = Object.entries(ADAPTER_TYPE_LABELS).slice(0, 3);
    process.stdout.write(
      `Adapter labels (sample): ${sample.map(([k, v]) => `${k}=${v}`).join(", ")}\n`,
    );
  });

program.parse();
