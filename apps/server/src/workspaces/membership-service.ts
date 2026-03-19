import type { Db } from "@ownlab/db";
import {
  agents,
  and,
  asc,
  channelMembers,
  channels,
  eq,
  inArray,
  isNull,
  teamMembers,
  teams,
  sql,
  workspaces,
  workspaceMembers,
} from "@ownlab/db";

export type WorkspaceMemberRecord = {
  workspaceId: string;
  actorId: string;
  actorType: string;
  source: "direct" | "team";
  role: string;
  joinedAt: Date;
  displayName: string | null;
  icon: string | null;
  status: string | null;
  adapterType: string | null;
};

export function createWorkspaceMembershipService(db: Db) {
  async function getWorkspace(workspaceId: string) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    return workspace ?? null;
  }

  async function ensureAgentBelongsToWorkspaceLab(workspaceId: string, agentId: string) {
    const rows = await db
      .select({ id: agents.id })
      .from(workspaces)
      .innerJoin(agents, eq(workspaces.labId, agents.labId))
      .where(and(eq(workspaces.id, workspaceId), eq(agents.id, agentId)))
      .limit(1);

    return rows.length > 0;
  }

  async function isTeamManagedAgent(agentId: string) {
    const rows = await db
      .select({ agentId: teamMembers.agentId })
      .from(teamMembers)
      .where(eq(teamMembers.agentId, agentId))
      .limit(1);

    return rows.length > 0;
  }

  async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]> {
    const directRows = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        actorId: workspaceMembers.actorId,
        actorType: workspaceMembers.actorType,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        storedDisplayName: workspaceMembers.displayName,
        storedIcon: workspaceMembers.icon,
        linkedAgentId: agents.id,
        agentName: agents.name,
        agentIcon: agents.icon,
        agentStatus: agents.status,
        agentAdapterType: agents.adapterType,
        linkedTeamId: teamMembers.teamId,
      })
      .from(workspaceMembers)
      .leftJoin(agents, sql`${workspaceMembers.actorId} = ${agents.id}::text`)
      .leftJoin(teamMembers, eq(agents.id, teamMembers.agentId))
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(asc(workspaceMembers.joinedAt));

    const teamRows = await db
      .select({
        workspaceId: teams.workspaceId,
        actorId: agents.id,
        actorType: sql<string>`'agent'`,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        storedDisplayName: sql<string | null>`null`,
        storedIcon: sql<string | null>`null`,
        linkedAgentId: agents.id,
        agentName: agents.name,
        agentIcon: agents.icon,
        agentStatus: agents.status,
        agentAdapterType: agents.adapterType,
        linkedTeamId: teamMembers.teamId,
      })
      .from(teams)
      .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .innerJoin(agents, eq(teamMembers.agentId, agents.id))
      .where(eq(teams.workspaceId, workspaceId))
      .orderBy(asc(teamMembers.joinedAt), asc(agents.name));

    const membersByActorId = new Map<string, WorkspaceMemberRecord>();

    for (const row of directRows) {
      // Workspace agent membership is only valid when it points to a real agent record.
      if (row.actorType === "agent" && !row.linkedAgentId) {
        continue;
      }

      if (row.actorType === "agent" && row.linkedTeamId) {
        continue;
      }

      membersByActorId.set(row.actorId, {
        workspaceId: row.workspaceId,
        actorId: row.actorId,
        actorType: row.actorType,
        source: "direct",
        role: row.role,
        joinedAt: row.joinedAt,
        displayName:
          row.actorType === "agent"
            ? row.agentName ?? row.storedDisplayName ?? row.actorId
            : row.storedDisplayName ?? (row.actorId === "local-user" ? "You" : row.actorId),
        icon: row.actorType === "agent" ? row.agentIcon ?? row.storedIcon : row.storedIcon,
        status: row.actorType === "agent" ? row.agentStatus : null,
        adapterType: row.actorType === "agent" ? row.agentAdapterType : null,
      });
    }

    for (const row of teamRows) {
      if (!row.workspaceId || membersByActorId.has(row.actorId)) {
        continue;
      }

      membersByActorId.set(row.actorId, {
        workspaceId: row.workspaceId,
        actorId: row.actorId,
        actorType: row.actorType,
        source: "team",
        role: row.role,
        joinedAt: row.joinedAt,
        displayName: row.agentName ?? row.actorId,
        icon: row.agentIcon,
        status: row.agentStatus,
        adapterType: row.agentAdapterType,
      });
    }

    return [...membersByActorId.values()].sort(
      (left, right) => left.joinedAt.getTime() - right.joinedAt.getTime(),
    );
  }

  async function listWorkspaceAgentMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]> {
    const members = await listWorkspaceMembers(workspaceId);
    return members.filter((member) => member.actorType === "agent");
  }

  async function listAvailableWorkspaceAgents(workspaceId: string) {
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return [];
    }

    const memberAgentIds = new Set(
      (await listWorkspaceAgentMembers(workspaceId)).map((member) => member.actorId),
    );

    const rows = await db
      .select({
        id: agents.id,
        name: agents.name,
        icon: agents.icon,
        status: agents.status,
        adapterType: agents.adapterType,
      })
      .from(agents)
      .leftJoin(teamMembers, eq(agents.id, teamMembers.agentId))
      .where(and(eq(agents.labId, workspace.labId), isNull(teamMembers.teamId)))
      .orderBy(asc(agents.name));

    return rows.filter((row) => !memberAgentIds.has(row.id));
  }

  async function addWorkspaceMember(input: {
    workspaceId: string;
    actorId: string;
    actorType?: string;
    role?: string;
    displayName?: string | null;
    icon?: string | null;
  }) {
    const actorType = input.actorType ?? "agent";
    const workspace = await getWorkspace(input.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (actorType === "agent") {
      const isValid = await ensureAgentBelongsToWorkspaceLab(input.workspaceId, input.actorId);
      if (!isValid) {
        throw new Error("Agent not found in workspace lab");
      }

      if (await isTeamManagedAgent(input.actorId)) {
        throw new Error("Team-managed agents are included through their team workspace assignment");
      }
    }

    const inserted = await db
      .insert(workspaceMembers)
      .values({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        actorType,
        role: input.role ?? (actorType === "human" ? "owner" : "member"),
        displayName: input.displayName ?? null,
        icon: input.icon ?? null,
      })
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.actorId],
        set: {
          actorType,
          role: input.role ?? (actorType === "human" ? "owner" : "member"),
          displayName: input.displayName ?? null,
          icon: input.icon ?? null,
        },
      })
      .returning();

    return inserted[0] ?? null;
  }

  async function removeWorkspaceMember(workspaceId: string, actorId: string) {
    const [removed] = await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.actorId, actorId),
        ),
      )
      .returning();

    return removed ?? null;
  }

  async function ensureDefaultWorkspaceHumanMember(
    workspaceId: string,
    input?: { actorId?: string; displayName?: string | null; icon?: string | null },
  ) {
    return addWorkspaceMember({
      workspaceId,
      actorId: input?.actorId ?? "local-user",
      actorType: "human",
      role: "owner",
      displayName: input?.displayName ?? "You",
      icon: input?.icon ?? null,
    });
  }

  async function syncDefaultWorkspaceChannelMembers(channelId: string, workspaceId: string) {
    const members = await listWorkspaceMembers(workspaceId);
    const existing = await db
      .select({
        actorId: channelMembers.actorId,
      })
      .from(channelMembers)
      .where(eq(channelMembers.channelId, channelId));

    const desiredIds = new Set(members.map((member) => member.actorId));
    const existingIds = new Set(existing.map((member) => member.actorId));

    for (const member of members) {
      if (existingIds.has(member.actorId)) {
        continue;
      }

      await db
        .insert(channelMembers)
        .values({
          channelId,
          actorId: member.actorId,
          actorType: member.actorType,
        })
        .onConflictDoNothing({
          target: [channelMembers.channelId, channelMembers.actorId],
        });
    }

    const staleIds = [...existingIds].filter((actorId) => !desiredIds.has(actorId));
    if (staleIds.length > 0) {
      await db
        .delete(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, channelId),
            inArray(channelMembers.actorId, staleIds),
          ),
        );
    }

    return members;
  }

  async function findDefaultWorkspaceChannelId(workspaceId: string) {
    const [channel] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.workspaceId, workspaceId),
          eq(channels.scopeType, "workspace"),
          eq(channels.scopeRefId, workspaceId),
        ),
      )
      .limit(1);

    return channel?.id ?? null;
  }

  return {
    listWorkspaceMembers,
    listWorkspaceAgentMembers,
    listAvailableWorkspaceAgents,
    addWorkspaceMember,
    removeWorkspaceMember,
    ensureDefaultWorkspaceHumanMember,
    syncDefaultWorkspaceChannelMembers,
    findDefaultWorkspaceChannelId,
  };
}
