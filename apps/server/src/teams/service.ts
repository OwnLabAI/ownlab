import fs from "node:fs/promises";
import type { Db } from "@ownlab/db";
import {
  agentConversationSessions,
  agents,
  and,
  asc,
  channelMembers,
  channelMessages,
  channels,
  desc,
  eq,
  heartbeatRuns,
  inArray,
  labs,
  tasks,
  teamMembers,
  teams,
  workspaces,
} from "@ownlab/db";
import type { CreateTeamInput } from "@ownlab/shared";
import {
  resolveAgentRuntimeRootDir,
  resolveLegacyAgentRuntimeRootDir,
  resolveTeamRuntimeRootDir,
} from "../home-paths.js";
import { initializeAgentRuntimeFilesystem } from "../agents/runtime-filesystem.js";

function slugifyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidHandle(value: string) {
  return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(value);
}

function buildDefaultAdapterConfig(input: {
  adapterType: string;
  model: string;
}) {
  return {
    model: input.model,
    promptTemplate: "{{context.prompt}}",
    ...(input.adapterType === "codex_local"
      ? { dangerouslyBypassApprovalsAndSandbox: true }
      : {}),
  };
}

async function ensureDefaultLab(db: Db) {
  let [lab] = await db.select().from(labs).limit(1);
  if (!lab) {
    [lab] = await db.insert(labs).values({ name: "Default Lab" }).returning();
  }
  return lab;
}

export function createTeamService(db: Db) {
  async function listTeams() {
    const rows = await db.select().from(teams).orderBy(desc(teams.createdAt));
    if (rows.length === 0) {
      return [];
    }

    const members = await db
      .select({
        teamId: teamMembers.teamId,
        agentId: teamMembers.agentId,
      })
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, rows.map((row) => row.id)))
      .orderBy(asc(teamMembers.joinedAt));

    const memberIdsByTeam = new Map<string, string[]>();
    for (const member of members) {
      const current = memberIdsByTeam.get(member.teamId) ?? [];
      current.push(member.agentId);
      memberIdsByTeam.set(member.teamId, current);
    }

    return rows.map((row) => ({
      ...row,
      memberAgentIds: memberIdsByTeam.get(row.id) ?? [],
    }));
  }

  async function getTeamById(id: string) {
    const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    return row ?? null;
  }

  async function getTeamByName(name: string) {
    const [row] = await db.select().from(teams).where(eq(teams.name, name)).limit(1);
    return row ?? null;
  }

  async function updateTeam(
    id: string,
    input: Partial<{
      name: string;
      description: string | null;
      icon: string | null;
      status: string;
      workspaceId: string | null;
    }>,
  ) {
    const current = await getTeamById(id);
    if (!current) return null;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (trimmed.length < 3) {
        throw new Error("Team name must be at least 3 characters");
      }
      if (!isValidHandle(trimmed)) {
        throw new Error("Team name must start with a letter and contain only letters, numbers, and hyphens");
      }
      if (trimmed !== current.name) {
        const existing = await getTeamByName(trimmed);
        if (existing) {
          throw new Error("Team with this name already exists");
        }
        updates.name = trimmed;
      }
    }
    if (input.description !== undefined) updates.description = input.description;
    if (input.icon !== undefined) updates.icon = input.icon;
    if (input.status !== undefined) updates.status = input.status;
    if (input.workspaceId !== undefined) {
      const workspaceId = input.workspaceId?.trim() || null;
      if (workspaceId) {
        const [workspace] = await db
          .select()
          .from(workspaces)
          .where(and(eq(workspaces.id, workspaceId), eq(workspaces.labId, current.labId)))
          .limit(1);
        if (!workspace) {
          throw new Error("Workspace not found in the current lab");
        }
      }
      updates.workspaceId = workspaceId;
    }

    const [updated] = await db
      .update(teams)
      .set(updates as Record<string, never>)
      .where(eq(teams.id, id))
      .returning();
    return updated ?? null;
  }

  async function listTeamMembers(teamId: string) {
    return db
      .select({
        teamId: teamMembers.teamId,
        agentId: teamMembers.agentId,
        role: agents.role,
        teamRole: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        name: agents.name,
        icon: agents.icon,
        status: agents.status,
        adapterType: agents.adapterType,
        reportsTo: agents.reportsTo,
      })
      .from(teamMembers)
      .innerJoin(agents, eq(teamMembers.agentId, agents.id))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(asc(teamMembers.joinedAt), asc(agents.name));
  }

  async function createTeam(input: CreateTeamInput) {
    const teamName = input.name?.trim();
    const leaderName = input.leaderName?.trim();
    const workerCount = Number(input.workerCount);
    const workspaceId = input.workspaceId?.trim() || null;

    if (!teamName || teamName.length < 3) {
      throw new Error("Team name must be at least 3 characters");
    }
    if (!leaderName || leaderName.length < 3) {
      throw new Error("Leader name must be at least 3 characters");
    }
    if (!isValidHandle(teamName)) {
      throw new Error("Team name must start with a letter and contain only letters, numbers, and hyphens");
    }
    if (!isValidHandle(leaderName)) {
      throw new Error("Leader name must start with a letter and contain only letters, numbers, and hyphens");
    }
    if (!Number.isInteger(workerCount) || workerCount < 0 || workerCount > 12) {
      throw new Error("Worker count must be an integer between 0 and 12");
    }
    const existingTeam = await getTeamByName(teamName);
    if (existingTeam) {
      throw new Error("Team with this name already exists");
    }

    const lab = await ensureDefaultLab(db);
    const workspace = workspaceId
      ? (await db
          .select()
          .from(workspaces)
          .where(and(eq(workspaces.id, workspaceId), eq(workspaces.labId, lab.id)))
          .limit(1))[0] ?? null
      : null;
    if (workspaceId && !workspace) {
      throw new Error("Workspace not found in the current lab");
    }
    const adapterType = input.adapterType ?? "codex_local";
    const model = input.model?.trim() || "gpt-5.4";
    const icon = input.icon ?? null;
    const teamSlug = slugifyName(teamName);
    const workerPrefix =
      slugifyName(input.workerNamePrefix?.trim() || `${teamSlug}-worker`) || `${teamSlug}-worker`;
    const description = input.description?.trim() || null;
    const leaderRole = input.leaderRole?.trim() || "leader";
    const workerRole = input.workerRole?.trim() || "worker";
    const adapterConfig = {
      ...buildDefaultAdapterConfig({ adapterType, model }),
      ...(input.adapterConfig ?? {}),
    };
    const baseRuntimeConfig = {
      teamName,
      teamSlug,
      teamSize: workerCount + 1,
      workerCount,
      adapterType,
      model,
      workspaceId,
      ...(input.runtimeConfig ?? {}),
    };

    const generatedWorkerNames = Array.from({ length: workerCount }, (_, index) => {
      const sequence = String(index + 1).padStart(2, "0");
      return `${workerPrefix}-${sequence}`;
    });

    const reservedNames = [leaderName, ...generatedWorkerNames];
    const conflictingAgents = await db
      .select({ name: agents.name })
      .from(agents)
      .where(and(eq(agents.labId, lab.id)));
    const conflictingSet = new Set(conflictingAgents.map((row) => row.name));
    const duplicateName = reservedNames.find((name) => conflictingSet.has(name));
    if (duplicateName) {
      throw new Error(`Agent name already exists: ${duplicateName}`);
    }

    const created = await db.transaction(async (tx) => {
      const [leader] = await tx
        .insert(agents)
        .values({
          labId: lab.id,
          name: leaderName,
          role: leaderRole,
          icon,
          status: "idle",
          adapterType,
          adapterConfig,
          runtimeConfig: {
            ...baseRuntimeConfig,
            teamRole: "leader",
          },
        })
        .returning();

      const [team] = await tx
        .insert(teams)
        .values({
          labId: lab.id,
          workspaceId: workspace?.id ?? null,
          name: teamName,
          description,
          icon,
          leaderAgentId: leader.id,
          runtimeConfig: baseRuntimeConfig,
          metadata: {
            workerRole,
            leaderRole,
          },
        })
        .returning();

      await tx.insert(teamMembers).values({
        teamId: team.id,
        agentId: leader.id,
        role: "leader",
      });

      const leaderRuntimeConfig = {
        ...baseRuntimeConfig,
        teamId: team.id,
        teamRole: "leader",
      };

      await tx
        .update(agents)
        .set({
          runtimeConfig: leaderRuntimeConfig,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, leader.id));

      const workers = [];
      for (const workerName of generatedWorkerNames) {
        const workerRuntimeConfig = {
          ...baseRuntimeConfig,
          teamId: team.id,
          teamRole: "worker",
        };
        const [worker] = await tx
          .insert(agents)
          .values({
            labId: lab.id,
            name: workerName,
            role: workerRole,
            reportsTo: leader.id,
            icon,
            status: "idle",
            adapterType,
            adapterConfig,
            runtimeConfig: workerRuntimeConfig,
          })
          .returning();
        workers.push({
          ...worker,
          runtimeConfig: workerRuntimeConfig,
        });
      }

      if (workers.length > 0) {
        await tx.insert(teamMembers).values(
          workers.map((worker) => ({
            teamId: team.id,
            agentId: worker.id,
            role: "worker",
          })),
        );
      }

      let channel: typeof channels.$inferSelect | null = null;
      if (workspace) {
        const [createdChannel] = await tx
          .insert(channels)
          .values({
            workspaceId: workspace.id,
            scopeType: "team",
            scopeRefId: team.id,
            name: "team-room",
            title: team.name,
            type: "private",
            description: description ?? "Team collaboration channel",
          })
          .returning();
        channel = createdChannel;

        await tx.insert(channelMembers).values(
          [leader, ...workers].map((member) => ({
            channelId: createdChannel.id,
            actorId: member.id,
            actorType: "agent",
          })),
        );
      }

      return {
        team,
        leader: {
          ...leader,
          runtimeConfig: leaderRuntimeConfig,
        },
        workers,
        channel,
      };
    });

    await initializeAgentRuntimeFilesystem({
      agentId: created.leader.id,
      adapterType: created.leader.adapterType,
      runtimeConfig: created.leader.runtimeConfig,
    });
    await Promise.all(
      created.workers.map((worker) =>
        initializeAgentRuntimeFilesystem({
          agentId: worker.id,
          adapterType: worker.adapterType,
          runtimeConfig: worker.runtimeConfig,
        })
      ),
    );

    return created;
  }

  async function deleteTeam(id: string) {
    const current = await getTeamById(id);
    if (!current) {
      return null;
    }

    const members = await listTeamMembers(id);
    const agentIds = members.map((member) => member.agentId);
    const teamRuntimeRoot = resolveTeamRuntimeRootDir(id);
    const runtimeDirs = members.map((member) => ({
      current: resolveAgentRuntimeRootDir(member.agentId, { teamId: id }),
      legacy: resolveLegacyAgentRuntimeRootDir(member.agentId),
    }));

    await fs.rm(teamRuntimeRoot, { recursive: true, force: true });
    await Promise.all(
      runtimeDirs.map(async (runtimeDir) => {
        await fs.rm(runtimeDir.current, { recursive: true, force: true });
        await fs.rm(runtimeDir.legacy, { recursive: true, force: true });
      }),
    );

    await db.transaction(async (tx) => {
      const teamScopedChannels = await tx
        .select({ id: channels.id })
        .from(channels)
        .where(and(eq(channels.scopeType, "team"), eq(channels.scopeRefId, id)));

      const dmChannels = agentIds.length > 0
        ? await tx
            .select({ id: channels.id })
            .from(channels)
            .where(and(eq(channels.scopeType, "agent_dm"), inArray(channels.scopeRefId, agentIds)))
        : [];

      const channelIds = [...teamScopedChannels, ...dmChannels].map((row) => row.id);

      if (channelIds.length > 0) {
        await tx.delete(channelMessages).where(inArray(channelMessages.channelId, channelIds));
        await tx.delete(agentConversationSessions).where(inArray(agentConversationSessions.channelId, channelIds));
        await tx.delete(channelMembers).where(inArray(channelMembers.channelId, channelIds));
        await tx.delete(channels).where(inArray(channels.id, channelIds));
      }

      if (agentIds.length > 0) {
        await tx
          .update(tasks)
          .set({ assigneeAgentId: null, updatedAt: new Date() })
          .where(inArray(tasks.assigneeAgentId, agentIds));
        await tx
          .update(teams)
          .set({ leaderAgentId: null, updatedAt: new Date() })
          .where(inArray(teams.leaderAgentId, agentIds));
        await tx
          .update(workspaces)
          .set({ leadAgentId: null, updatedAt: new Date() })
          .where(inArray(workspaces.leadAgentId, agentIds));
        await tx
          .update(agents)
          .set({ reportsTo: null, updatedAt: new Date() })
          .where(inArray(agents.reportsTo, agentIds));
        await tx.delete(heartbeatRuns).where(inArray(heartbeatRuns.agentId, agentIds));
        await tx.delete(agentConversationSessions).where(inArray(agentConversationSessions.agentId, agentIds));
        await tx.delete(teamMembers).where(eq(teamMembers.teamId, id));
        await tx.delete(agents).where(inArray(agents.id, agentIds));
      } else {
        await tx.delete(teamMembers).where(eq(teamMembers.teamId, id));
      }

      await tx.delete(teams).where(eq(teams.id, id));
    });

    return current;
  }

  return {
    listTeams,
    getTeamById,
    getTeamByName,
    listTeamMembers,
    createTeam,
    updateTeam,
    deleteTeam,
  };
}
