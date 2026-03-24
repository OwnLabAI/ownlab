import type { Db } from "@ownlab/db";
import {
  agents,
  and,
  asc,
  eq,
  isNull,
  teamMembers,
  teams,
  sql,
  workspaces,
  workspaceAccessMembers,
} from "@ownlab/db";

export type WorkspaceAccessRecord = {
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

  async function listWorkspaceAccess(workspaceId: string): Promise<WorkspaceAccessRecord[]> {
    const directRows = await db
      .select({
        workspaceId: workspaceAccessMembers.workspaceId,
        actorId: workspaceAccessMembers.actorId,
        actorType: workspaceAccessMembers.actorType,
        role: workspaceAccessMembers.role,
        joinedAt: workspaceAccessMembers.joinedAt,
        storedDisplayName: workspaceAccessMembers.displayName,
        storedIcon: workspaceAccessMembers.icon,
        linkedAgentId: agents.id,
        agentName: agents.name,
        agentIcon: agents.icon,
        agentStatus: agents.status,
        agentAdapterType: agents.adapterType,
        linkedTeamId: teamMembers.teamId,
      })
      .from(workspaceAccessMembers)
      .leftJoin(agents, sql`${workspaceAccessMembers.actorId} = ${agents.id}::text`)
      .leftJoin(teamMembers, eq(agents.id, teamMembers.agentId))
      .where(eq(workspaceAccessMembers.workspaceId, workspaceId))
      .orderBy(asc(workspaceAccessMembers.joinedAt));

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

    const membersByActorId = new Map<string, WorkspaceAccessRecord>();

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

  async function listWorkspaceAccessAgents(workspaceId: string): Promise<WorkspaceAccessRecord[]> {
    const accessEntries = await listWorkspaceAccess(workspaceId);
    return accessEntries.filter((entry) => entry.actorType === "agent");
  }

  async function listAvailableWorkspaceAgents(workspaceId: string) {
    const workspace = await getWorkspace(workspaceId);
    if (!workspace) {
      return [];
    }

    const memberAgentIds = new Set(
      (await listWorkspaceAccessAgents(workspaceId)).map((member) => member.actorId),
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

  async function grantWorkspaceAccess(input: {
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
      .insert(workspaceAccessMembers)
      .values({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        actorType,
        role: input.role ?? (actorType === "human" ? "owner" : "member"),
        displayName: input.displayName ?? null,
        icon: input.icon ?? null,
      })
      .onConflictDoUpdate({
        target: [workspaceAccessMembers.workspaceId, workspaceAccessMembers.actorId],
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

  async function revokeWorkspaceAccess(workspaceId: string, actorId: string) {
    const [removed] = await db
      .delete(workspaceAccessMembers)
      .where(
        and(
          eq(workspaceAccessMembers.workspaceId, workspaceId),
          eq(workspaceAccessMembers.actorId, actorId),
        ),
      )
      .returning();

    return removed ?? null;
  }

  async function ensureDefaultWorkspaceOwnerAccess(
    workspaceId: string,
    input?: { actorId?: string; displayName?: string | null; icon?: string | null },
  ) {
    return grantWorkspaceAccess({
      workspaceId,
      actorId: input?.actorId ?? "local-user",
      actorType: "human",
      role: "owner",
      displayName: input?.displayName ?? "You",
      icon: input?.icon ?? null,
    });
  }

  return {
    listWorkspaceAccess,
    listWorkspaceAccessAgents,
    listAvailableWorkspaceAgents,
    grantWorkspaceAccess,
    revokeWorkspaceAccess,
    ensureDefaultWorkspaceOwnerAccess,
  };
}
