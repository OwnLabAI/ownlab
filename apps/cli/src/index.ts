import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { ADAPTER_TYPE_LABELS } from "@ownlab/shared";
import { doctor } from "./commands/doctor.js";
import { runHealth } from "./commands/health.js";
import { onboard } from "./commands/onboard.js";
import { runCommand } from "./commands/run.js";

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

program
  .command("onboard")
  .description("Create a local OwnLab instance config and default directories")
  .option("-c, --config <path>", "Path to config file")
  .option("-i, --instance <id>", "OwnLab instance id", "default")
  .option("-y, --yes", "Accept defaults without prompts", false)
  .option("--server-port <port>", "Server port", "3100")
  .option("--web-port <port>", "Web port", "3000")
  .action(async (opts: {
    config?: string;
    instance?: string;
    yes?: boolean;
    serverPort?: string;
    webPort?: string;
  }) => {
    await onboard(opts);
  });

program
  .command("doctor")
  .description("Run local OwnLab runtime checks")
  .option("-c, --config <path>", "Path to config file")
  .option("-i, --instance <id>", "OwnLab instance id", "default")
  .action(async (opts: { config?: string; instance?: string }) => {
    const summary = await doctor(opts);
    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  });

program
  .command("run")
  .description("Ensure onboarding is complete and start the local OwnLab runtime")
  .option("-c, --config <path>", "Path to config file")
  .option("-i, --instance <id>", "OwnLab instance id", "default")
  .option("--no-web", "Start only the server runtime")
  .action(async (opts: { config?: string; instance?: string; web?: boolean }) => {
    await runCommand({
      config: opts.config,
      instance: opts.instance,
      noWeb: opts.web === false,
    });
  });

program.parseAsync().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
