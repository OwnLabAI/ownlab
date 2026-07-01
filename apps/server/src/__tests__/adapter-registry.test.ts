import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getServerAdapter, listServerAdapters } from "../adapters/registry.js";

describe("server adapter registry", () => {
  it("uses packaged codex environment diagnostics that create a missing cwd", async () => {
    const adapter = getServerAdapter("codex_local");
    expect(adapter).not.toBeNull();

    const root = path.join(
      os.tmpdir(),
      `ownlab-codex-local-cwd-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const cwd = path.join(root, "workspace");
    const codexHome = path.join(root, ".codex");

    await fs.rm(root, { recursive: true, force: true });
    await fs.mkdir(codexHome, { recursive: true });
    await fs.writeFile(path.join(codexHome, "auth.json"), JSON.stringify({ loggedIn: true }));

    const result = await adapter!.testEnvironment({
      labId: "lab-1",
      adapterType: "codex_local",
      config: {
        command: process.execPath,
        cwd,
        env: {
          CODEX_HOME: codexHome,
        },
      },
    });

    expect(result.checks.some((check) => check.code === "codex_cwd_valid")).toBe(true);
    expect(result.checks.some((check) => check.code === "codex_auth_file_present")).toBe(true);
    expect(result.checks.some((check) => check.level === "error")).toBe(false);
    expect(result.status).toBe("pass");

    const stats = await fs.stat(cwd);
    expect(stats.isDirectory()).toBe(true);

    await fs.rm(root, { recursive: true, force: true });
  });

  it("warns when codex auth is missing", async () => {
    const adapter = getServerAdapter("codex_local");
    expect(adapter).not.toBeNull();

    const root = path.join(
      os.tmpdir(),
      `ownlab-codex-local-auth-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const cwd = path.join(root, "workspace");
    const codexHome = path.join(root, ".codex");

    await fs.rm(root, { recursive: true, force: true });
    await fs.mkdir(codexHome, { recursive: true });

    const result = await adapter!.testEnvironment({
      labId: "lab-1",
      adapterType: "codex_local",
      config: {
        command: process.execPath,
        cwd,
        env: {
          CODEX_HOME: codexHome,
        },
      },
    });

    expect(result.checks.some((check) => check.code === "codex_auth_missing")).toBe(true);
    expect(result.status).toBe("warn");

    await fs.rm(root, { recursive: true, force: true });
  });

  it("exposes adapter metadata for all registered adapters", () => {
    const adapters = listServerAdapters();

    expect(adapters.length).toBeGreaterThan(0);

    for (const adapter of adapters) {
      expect(adapter.type).toBeTruthy();
      expect(typeof adapter.execute).toBe("function");
      expect(typeof adapter.testEnvironment).toBe("function");
    }

    const localJwtAdapters = ["codex_local", "claude_local", "cursor", "gemini_local", "opencode_local", "pi_local"];
    for (const type of localJwtAdapters) {
      const adapter = adapters.find((entry) => entry.type === type);
      expect(adapter?.supportsLocalAgentJwt).toBe(true);
      expect(adapter?.agentConfigurationDoc).toContain(`# ${type} agent configuration`);
    }

    const processAdapter = adapters.find((entry) => entry.type === "process");
    expect(processAdapter?.agentConfigurationDoc).toContain("# process agent configuration");

    expect(getServerAdapter("process_local")?.type).toBe("process");
  });
});
