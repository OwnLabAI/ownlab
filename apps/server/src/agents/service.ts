import fs from "node:fs/promises";
import type { Db } from "@ownlab/db";
import { agents, labs, tasks, workspaces, heartbeatRuns, desc, eq, teamMembers, teams } from "@ownlab/db";
import type {
  AdapterEnvironmentTestResult,
  AdapterModel,
} from "@ownlab/adapter-utils";
import { getServerAdapter, listAdapterModels } from "../adapters/registry.js";
import { initializeAgentRuntimeFilesystem } from "./runtime-filesystem.js";
import {
  resolveAgentRuntimeRootDir,
  resolveLegacyAgentRuntimeRootDir,
} from "../home-paths.js";

export interface CreateAgentInput {
  name: string;
  role?: string | null;
  reportsTo?: string | null;
  adapterType?: string | null;
  model?: string | null;
  icon?: string | null;
  style?: string | null;
  agentType?: string | null;
  adapterConfig?: Record<string, unknown> | null;
  runtimeConfig?: Record<string, unknown> | null;
}

export interface UpdateAgentInput {
  name?: string;
  role?: string | null;
  reportsTo?: string | null;
  adapterType?: string | null;
  icon?: string | null;
  status?: string | null;
  adapterConfig?: Record<string, unknown> | null;
  runtimeConfig?: Record<string, unknown> | null;
}

export function createAgentService(db: Db) {
  function buildDefaultAdapterConfig(input: {
    adapterType: string;
    model: string;
  }): Record<string, unknown> {
    return {
      model: input.model,
      promptTemplate: "{{context.prompt}}",
      ...(input.adapterType === "codex_local"
        ? { dangerouslyBypassApprovalsAndSandbox: false }
        : {}),
    };
  }

  async function listModels(adapterType: string): Promise<AdapterModel[]> {
    return listAdapterModels(adapterType);
  }

  async function testEnvironment(input: {
    adapterType: string;
    labId?: string | null;
    adapterConfig?: Record<string, unknown> | null;
  }): Promise<AdapterEnvironmentTestResult> {
    const adapter = getServerAdapter(input.adapterType);
    if (!adapter) {
      throw new Error("Adapter not found");
    }

    const effectiveLabId =
      typeof input.labId === "string" && input.labId.length > 0
        ? input.labId
        : "unknown";

    return adapter.testEnvironment({
      labId: effectiveLabId,
      adapterType: input.adapterType,
      config: input.adapterConfig ?? {},
    });
  }

  async function listAgents() {
    return db.select().from(agents).orderBy(desc(agents.createdAt));
  }

  async function getAgentById(id: string) {
    const rows = await db.select().from(agents).where(eq(agents.id, id));
    return rows[0] ?? null;
  }

  async function getAgentByName(name: string) {
    const rows = await db.select().from(agents).where(eq(agents.name, name));
    return rows[0] ?? null;
  }

  async function ensureDefaultLab() {
    let labRows = await db.select().from(labs).limit(1);
    if (labRows.length === 0) {
      labRows = await db.insert(labs).values({ name: "Default Lab" }).returning();
    }
    return labRows[0];
  }

  async function createAgent(input: CreateAgentInput) {
    if (!input.name || input.name.trim().length < 3) {
      throw new Error("Name must be at least 3 characters");
    }

    const existing = await getAgentByName(input.name);
    if (existing) {
      throw new Error("Agent with this name already exists");
    }

    const lab = await ensureDefaultLab();
    const adapterType = input.adapterType ?? "codex_local";
    const agentType = input.agentType ?? "local";

    const model =
      input.model ??
      (adapterType === "codex_local" || agentType === "local"
        ? "gpt-5.4"
        : "claude-3-5-haiku-20241022");

    const adapterConfig = {
      ...buildDefaultAdapterConfig({ adapterType, model }),
      ...(input.adapterConfig ?? {}),
    };

    const runtimeConfig = {
      agentType,
      style: input.style ?? null,
      ...(input.runtimeConfig ?? {}),
    };

    const normalizedRole =
      typeof input.role === "string" && input.role.trim().length > 0
        ? input.role.trim()
        : "general";

    let normalizedReportsTo: string | null = null;
    if (typeof input.reportsTo === "string" && input.reportsTo.trim().length > 0) {
      if (input.reportsTo === input.name) {
        throw new Error("Agent cannot report to itself");
      }

      const manager = await getAgentById(input.reportsTo);
      if (!manager) {
        throw new Error("Manager agent not found");
      }
      if (manager.labId !== lab.id) {
        throw new Error("Manager agent must belong to the same lab");
      }
      normalizedReportsTo = manager.id;
    }

    const [created] = await db
      .insert(agents)
      .values({
        name: input.name,
        labId: lab.id,
        adapterType,
        role: normalizedRole,
        reportsTo: normalizedReportsTo,
        icon: input.icon ?? null,
        status: "idle",
        adapterConfig,
        runtimeConfig,
      })
      .returning();

    await initializeAgentRuntimeFilesystem({
      agentId: created.id,
      adapterType: created.adapterType,
      runtimeConfig: created.runtimeConfig,
    });

    return created;
  }

  async function updateAgent(id: string, patch: UpdateAgentInput) {
    const current = await getAgentById(id);
    if (!current) {
      return null;
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.role !== undefined) updates.role = patch.role?.trim() || "general";
    if (patch.adapterType !== undefined) updates.adapterType = patch.adapterType;
    if (patch.icon !== undefined) updates.icon = patch.icon;
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.adapterConfig !== undefined) updates.adapterConfig = patch.adapterConfig;
    if (patch.runtimeConfig !== undefined) updates.runtimeConfig = patch.runtimeConfig;
    if (patch.reportsTo !== undefined) {
      const nextReportsTo = patch.reportsTo?.trim() || null;
      if (nextReportsTo === id) {
        throw new Error("Agent cannot report to itself");
      }
      if (nextReportsTo) {
        const manager = await getAgentById(nextReportsTo);
        if (!manager) {
          throw new Error("Manager agent not found");
        }
        if (manager.labId !== current.labId) {
          throw new Error("Manager agent must belong to the same lab");
        }
      }
      updates.reportsTo = nextReportsTo;
    }

    const rows = await db
      .update(agents)
      .set(updates)
      .where(eq(agents.id, id))
      .returning();

    return rows[0] ?? null;
  }

  async function deleteAgent(id: string) {
    const current = await getAgentById(id);
    if (!current) {
      return null;
    }

    const runtimeRoot = resolveAgentRuntimeRootDir(id, current.runtimeConfig);
    const legacyRuntimeRoot = resolveLegacyAgentRuntimeRootDir(id);
    await fs.rm(runtimeRoot, { recursive: true, force: true });
    await fs.rm(legacyRuntimeRoot, { recursive: true, force: true });
    await db.update(tasks).set({ assigneeAgentId: null, updatedAt: new Date() }).where(eq(tasks.assigneeAgentId, id));
    await db.update(workspaces).set({ leadAgentId: null, updatedAt: new Date() }).where(eq(workspaces.leadAgentId, id));
    await db.update(teams).set({ leaderAgentId: null, updatedAt: new Date() }).where(eq(teams.leaderAgentId, id));
    await db.delete(teamMembers).where(eq(teamMembers.agentId, id));
    await db.update(agents).set({ reportsTo: null, updatedAt: new Date() }).where(eq(agents.reportsTo, id));
    await db.delete(heartbeatRuns).where(eq(heartbeatRuns.agentId, id));
    const rows = await db.delete(agents).where(eq(agents.id, id)).returning();
    return rows[0] ?? null;
  }

  return {
    listModels,
    testEnvironment,
    listAgents,
    getAgentById,
    getAgentByName,
    createAgent,
    updateAgent,
    deleteAgent,
  };
}
