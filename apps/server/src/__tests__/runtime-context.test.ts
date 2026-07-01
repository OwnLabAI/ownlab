import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveAgentExecutionRuntimeContext } from "../agents/runtime-context.js";

function createDbWithWorkspace(workspace: { id: string; name: string; worktreePath: string } | null) {
  const limit = vi.fn(async () => (workspace ? [workspace] : []));
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return {
    select,
  } as unknown as Parameters<typeof resolveAgentExecutionRuntimeContext>[0];
}

describe("resolveAgentExecutionRuntimeContext", () => {
  it("prefers the requested workspace over an adapter cwd override", async () => {
    const ownlabHome = path.join(
      os.tmpdir(),
      `ownlab-runtime-context-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    process.env.OWNLAB_HOME = ownlabHome;

    const db = createDbWithWorkspace({
      id: "workspace-1",
      name: "Workspace One",
      worktreePath: "/tmp/ownlab-workspace",
    });

    const result = await resolveAgentExecutionRuntimeContext(
      db,
      {
        id: "agent-1",
        adapterType: "codex_local",
        adapterConfig: {
          cwd: "/tmp/outside-workspace",
        },
        runtimeConfig: {},
      } as never,
      "workspace-1",
    );

    expect(result.workspaceSource).toBe("workspace");
    expect(result.workspaceId).toBe("workspace-1");
    expect(result.cwd).toBe("/tmp/ownlab-workspace");

    await fs.rm(ownlabHome, { recursive: true, force: true });
    delete process.env.OWNLAB_HOME;
  });

  it("falls back to the configured cwd when no workspace is bound", async () => {
    const ownlabHome = path.join(
      os.tmpdir(),
      `ownlab-runtime-context-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    process.env.OWNLAB_HOME = ownlabHome;

    const db = createDbWithWorkspace(null);

    const result = await resolveAgentExecutionRuntimeContext(
      db,
      {
        id: "agent-2",
        adapterType: "codex_local",
        adapterConfig: {
          cwd: "/tmp/agent-project",
        },
        runtimeConfig: {},
      } as never,
      null,
    );

    expect(result.workspaceSource).toBe("agent_home");
    expect(result.cwd).toBe("/tmp/agent-project");
    expect(result.workspaceId).toBeNull();

    await fs.rm(ownlabHome, { recursive: true, force: true });
    delete process.env.OWNLAB_HOME;
  });
});
