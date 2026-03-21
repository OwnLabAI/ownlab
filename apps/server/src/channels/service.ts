import type { Db } from "@ownlab/db";
import {
  channels,
  channelMessages,
  channelMembers,
  agents,
  tasks,
  teamMembers,
  teams,
  workspaces,
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "@ownlab/db";
import type { ChannelAttachment, ChannelMention } from "@ownlab/shared";
import { createWorkspaceMembershipService } from "../workspaces/membership-service.js";

export interface ListChannelsQuery {
  workspaceId?: string;
  scopeType?: string;
  scopeRefId?: string;
  includeArchived?: boolean;
}

export interface CreateChannelInput {
  workspaceId: string;
  name?: string;
  title?: string | null;
  type?: string;
  description?: string | null;
  scopeType?: string;
  scopeRefId?: string | null;
}

export interface AppendMessageInput {
  channelId: string;
  sessionId?: string | null;
  actorId: string;
  actorType?: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateChannelInput {
  title?: string | null;
  archivedAt?: Date | null;
}

type StoredChannelMessage = typeof channelMessages.$inferSelect;

type ChannelMessageDisplay = StoredChannelMessage & {
  actorName: string | null;
  actorIcon: string | null;
  mentions: ChannelMention[];
  attachments: ChannelAttachment[];
};

export function createChannelService(db: Db) {
  const workspaceMembershipService = createWorkspaceMembershipService(db);

  type WorkspaceLeadAgent = {
    id: string;
    name: string | null;
    icon: string | null;
    status: string | null;
  };

  async function getRequiredChannel(channelId: string) {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) {
      throw new Error("Channel not found");
    }

    return channel;
  }

  async function getWorkspaceLeadAgent(
    workspaceId: string,
  ): Promise<WorkspaceLeadAgent | null> {
    const [row] = await db
      .select({
        id: agents.id,
        name: agents.name,
        icon: agents.icon,
        status: agents.status,
      })
      .from(workspaces)
      .leftJoin(agents, eq(workspaces.leadAgentId, agents.id))
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!row?.id) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      status: row.status,
    };
  }

  async function getTaskAssigneeAgent(taskId: string): Promise<WorkspaceLeadAgent | null> {
    const [row] = await db
      .select({
        id: agents.id,
        name: agents.name,
        icon: agents.icon,
        status: agents.status,
      })
      .from(tasks)
      .leftJoin(agents, eq(tasks.assigneeAgentId, agents.id))
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!row?.id) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      status: row.status,
    };
  }

  async function listTeamSeedAgents(teamId: string): Promise<WorkspaceLeadAgent[]> {
    return db
      .select({
        id: agents.id,
        name: agents.name,
        icon: agents.icon,
        status: agents.status,
      })
      .from(teamMembers)
      .innerJoin(agents, eq(teamMembers.agentId, agents.id))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(asc(teamMembers.joinedAt), asc(agents.name));
  }

  async function getSeedAgentsForChannel(
    channel: typeof channels.$inferSelect,
  ): Promise<WorkspaceLeadAgent[]> {
    if (channel.scopeType === "agent_dm" && channel.scopeRefId) {
      const [agent] = await db
        .select({
          id: agents.id,
          name: agents.name,
          icon: agents.icon,
          status: agents.status,
        })
        .from(agents)
        .where(eq(agents.id, channel.scopeRefId))
        .limit(1);

      return agent ? [agent] : [];
    }

    if (channel.scopeType === "task" && channel.scopeRefId) {
      const assignee = await getTaskAssigneeAgent(channel.scopeRefId);
      return assignee ? [assignee] : [];
    }

    if (channel.scopeType === "team" && channel.scopeRefId) {
      return listTeamSeedAgents(channel.scopeRefId);
    }

    return [];
  }

  function isDefaultWorkspaceChannel(channel: typeof channels.$inferSelect) {
    return channel.scopeType === "workspace" && channel.scopeRefId === channel.workspaceId;
  }

  async function isAgentInWorkspaceLab(workspaceId: string, agentId: string) {
    const rows = await db
      .select({ id: agents.id })
      .from(workspaces)
      .innerJoin(agents, eq(workspaces.labId, agents.labId))
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(agents.id, agentId),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  function isMissingChannelMembersTableError(error: unknown) {
    return (
      error instanceof Error &&
      /channel_members|relation .*channel_members.* does not exist/i.test(error.message)
    );
  }

  async function listStoredChannelMembers(channelId: string) {
    return db
      .select({
        channelId: channelMembers.channelId,
        actorId: channelMembers.actorId,
        actorType: channelMembers.actorType,
        runtimeState: channelMembers.runtimeState,
        runtimeUpdatedAt: channelMembers.runtimeUpdatedAt,
        joinedAt: channelMembers.joinedAt,
        name: agents.name,
        icon: agents.icon,
        status: agents.status,
        role: agents.role,
      })
      .from(channelMembers)
      .leftJoin(agents, sql`${channelMembers.actorId} = ${agents.id}::text`)
      .where(eq(channelMembers.channelId, channelId))
      .orderBy(asc(channelMembers.joinedAt));
  }

  async function ensureScopedChannelSeedMembers(
    channel: typeof channels.$inferSelect,
  ) {
    if (isDefaultWorkspaceChannel(channel)) {
      await workspaceMembershipService.ensureDefaultWorkspaceHumanMember(channel.workspaceId);
      await workspaceMembershipService.syncDefaultWorkspaceChannelMembers(
        channel.id,
        channel.workspaceId,
      );
      return;
    }

    const seedAgents = await getSeedAgentsForChannel(channel);
    if (seedAgents.length === 0) {
      return;
    }

    try {
      await Promise.all(
        seedAgents.map((agent) =>
          db
            .insert(channelMembers)
            .values({
              channelId: channel.id,
              actorId: agent.id,
              actorType: "agent",
            })
            .onConflictDoNothing({
              target: [channelMembers.channelId, channelMembers.actorId],
            }),
        ),
      );
    } catch (error) {
      if (isMissingChannelMembersTableError(error)) {
        return;
      }
      throw error;
    }
  }

  async function listChannels(input: ListChannelsQuery) {
    const conditions = [];
    if (input.workspaceId) {
      conditions.push(eq(channels.workspaceId, input.workspaceId));
    }
    if (input.scopeType) {
      conditions.push(eq(channels.scopeType, input.scopeType));
    }
    if (input.scopeRefId) {
      conditions.push(eq(channels.scopeRefId, input.scopeRefId));
    }
    if (!input.includeArchived) {
      conditions.push(isNull(channels.archivedAt));
    }

    const whereClause =
      conditions.length === 0 ? undefined : and(...conditions);

    const query = db.select().from(channels);
    const orderByRecentActivity = sql`coalesce(${channels.lastMessageAt}, ${channels.updatedAt}, ${channels.createdAt}) desc`;

    if (!whereClause) {
      return query.orderBy(orderByRecentActivity, desc(channels.createdAt));
    }

    return query.where(whereClause).orderBy(orderByRecentActivity, desc(channels.createdAt));
  }

  async function createChannel(input: CreateChannelInput) {
    const [row] = await db
      .insert(channels)
      .values({
        workspaceId: input.workspaceId,
        scopeType: input.scopeType ?? "workspace",
        scopeRefId: input.scopeRefId ?? input.workspaceId,
        name: input.name ?? "general",
        title: input.title ?? null,
        type: input.type ?? "public",
        description: input.description ?? null,
      })
      .returning();

    await ensureScopedChannelSeedMembers(row);

    return row;
  }

  async function getChannelById(id: string) {
    const rows = await db
      .select()
      .from(channels)
      .where(eq(channels.id, id));
    return rows[0] ?? null;
  }

  async function listMessages(channelId: string, limit: number, sessionId?: string | null) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const whereClause = sessionId
      ? and(eq(channelMessages.channelId, channelId), eq(channelMessages.sessionId, sessionId))
      : eq(channelMessages.channelId, channelId);
    const rows = await db
      .select()
      .from(channelMessages)
      .where(whereClause)
      .orderBy(desc(channelMessages.createdAt))
      .limit(safeLimit);

    return hydrateMessages([...rows].reverse());
  }

  function getActorSnapshot(message: StoredChannelMessage) {
    const metadata = message.metadata ?? {};
    const actorName =
      typeof metadata.actorName === "string"
        ? metadata.actorName
        : typeof metadata.senderName === "string"
          ? metadata.senderName
          : null;
    const actorIcon =
      typeof metadata.actorIcon === "string"
        ? metadata.actorIcon
        : typeof metadata.senderIcon === "string"
          ? metadata.senderIcon
          : null;

    return { actorIcon, actorName };
  }

  function getAttachments(message: StoredChannelMessage): ChannelAttachment[] {
    const rawAttachments = message.metadata?.attachments;
    if (!Array.isArray(rawAttachments)) {
      return [];
    }

    return rawAttachments
      .filter(
        (attachment): attachment is ChannelAttachment =>
          !!attachment &&
          typeof attachment === "object" &&
          "type" in attachment &&
          attachment.type === "file",
      )
      .map((attachment) => ({
        type: "file",
        filename:
          typeof attachment.filename === "string" ? attachment.filename : undefined,
        mediaType:
          typeof attachment.mediaType === "string" ? attachment.mediaType : undefined,
        url: typeof attachment.url === "string" ? attachment.url : undefined,
        textContent:
          typeof attachment.textContent === "string" ? attachment.textContent : null,
        textExtractionKind:
          typeof attachment.textExtractionKind === "string"
            ? attachment.textExtractionKind
            : null,
      }));
  }

  function getMentions(message: StoredChannelMessage): ChannelMention[] {
    const rawMentions = message.metadata?.mentions;
    if (!Array.isArray(rawMentions)) {
      return [];
    }

    return rawMentions.flatMap((mention) => {
      if (!mention || typeof mention !== "object") {
        return [];
      }

      const id = typeof mention.id === "string" ? mention.id : null;
      const type = mention.type === "agent" ? "agent" : null;
      const label = typeof mention.label === "string" ? mention.label : null;

      if (!id || !type || !label) {
        return [];
      }

      return [{ id, type, label }];
    });
  }

  function getHumanActorName(actorId: string, snapshotName: string | null) {
    if (snapshotName) {
      return snapshotName;
    }

    return actorId === "local-user" ? "You" : "Human";
  }

  async function hydrateMessages(
    rows: StoredChannelMessage[],
  ): Promise<ChannelMessageDisplay[]> {
    const agentIds = [...new Set(rows
      .filter((row) => row.actorType === "agent")
      .map((row) => row.actorId))];

    const agentMap = new Map<string, { name: string | null; icon: string | null }>();

    if (agentIds.length > 0) {
      const agentRows = await db
        .select({
          id: agents.id,
          name: agents.name,
          icon: agents.icon,
        })
        .from(agents)
        .where(inArray(agents.id, agentIds));

      for (const agent of agentRows) {
        agentMap.set(agent.id, { icon: agent.icon, name: agent.name });
      }
    }

    return rows.map((row) => {
      const snapshot = getActorSnapshot(row);
      const agent = row.actorType === "agent" ? agentMap.get(row.actorId) : null;

      return {
        ...row,
        actorName:
          row.actorType === "agent"
            ? snapshot.actorName ?? agent?.name ?? "Agent"
            : getHumanActorName(row.actorId, snapshot.actorName),
        actorIcon:
          row.actorType === "agent"
            ? snapshot.actorIcon ?? agent?.icon ?? null
            : snapshot.actorIcon ?? null,
        mentions: getMentions(row),
        attachments: getAttachments(row),
      };
    });
  }

  async function appendMessage(input: AppendMessageInput) {
    const nextTitle = await maybeDeriveChannelTitle(
      input.channelId,
      input.actorType ?? "human",
      input.content,
    );
    const now = new Date();
    const [row] = await db
      .insert(channelMessages)
      .values({
        channelId: input.channelId,
        sessionId: input.sessionId ?? null,
        actorId: input.actorId,
        actorType: input.actorType ?? "human",
        content: input.content,
        metadata: input.metadata ?? null,
      })
      .returning();

    await db
      .update(channels)
      .set({
        updatedAt: now,
        lastMessageAt: now,
        lastMessagePreview: buildMessagePreview(input.content),
        ...(nextTitle ? { title: nextTitle } : {}),
      })
      .where(eq(channels.id, input.channelId));

    return row;
  }

  async function updateChannel(channelId: string, input: UpdateChannelInput) {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) {
      updates.title = input.title;
    }

    if (input.archivedAt !== undefined) {
      updates.archivedAt = input.archivedAt;
    }

    const [row] = await db
      .update(channels)
      .set(updates)
      .where(eq(channels.id, channelId))
      .returning();

    return row ?? null;
  }

  async function deleteChannel(channelId: string) {
    await db
      .delete(channelMessages)
      .where(eq(channelMessages.channelId, channelId));

    try {
      await db
        .delete(channelMembers)
        .where(eq(channelMembers.channelId, channelId));
    } catch (error) {
      if (!isMissingChannelMembersTableError(error)) {
        throw error;
      }
    }

    const [row] = await db
      .delete(channels)
      .where(eq(channels.id, channelId))
      .returning();

    return row ?? null;
  }

  async function ensureDefaultWorkspaceChannel(workspaceId: string) {
    const existing = await db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.workspaceId, workspaceId),
          eq(channels.scopeType, "workspace"),
          eq(channels.scopeRefId, workspaceId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await ensureScopedChannelSeedMembers(existing[0]);
      return existing[0];
    }

    const [channel] = await db
      .insert(channels)
      .values({
        workspaceId,
        scopeType: "workspace",
        scopeRefId: workspaceId,
        name: "general",
        type: "public",
        description: "Default workspace channel",
      })
      .returning();

    await ensureScopedChannelSeedMembers(channel);

    return channel;
  }

  async function ensureAgentDmChannel(workspaceId: string, agentId: string) {
    const existing = await db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.workspaceId, workspaceId),
          eq(channels.scopeType, "agent_dm"),
          eq(channels.scopeRefId, agentId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await ensureScopedChannelSeedMembers(existing[0]);
      return existing[0];
    }

    const [channel] = await db
      .insert(channels)
      .values({
        workspaceId,
        scopeType: "agent_dm",
        scopeRefId: agentId,
        name: "agent-dm",
        type: "private",
        description: "Agent direct message channel",
      })
      .returning();

    await ensureScopedChannelSeedMembers(channel);

    return channel;
  }

  async function ensureTaskChannel(workspaceId: string, taskId: string) {
    const existing = await db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.workspaceId, workspaceId),
          eq(channels.scopeType, "task"),
          eq(channels.scopeRefId, taskId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await ensureScopedChannelSeedMembers(existing[0]);
      return existing[0];
    }

    const [channel] = await db
      .insert(channels)
      .values({
        workspaceId,
        scopeType: "task",
        scopeRefId: taskId,
        name: "task-comments",
        type: "private",
        description: "Task comments and discussion",
      })
      .returning();

    await ensureScopedChannelSeedMembers(channel);

    return channel;
  }

  async function ensureTeamChannel(workspaceId: string, teamId: string) {
    const existing = await db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.workspaceId, workspaceId),
          eq(channels.scopeType, "team"),
          eq(channels.scopeRefId, teamId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await ensureScopedChannelSeedMembers(existing[0]);
      return existing[0];
    }

    const [team] = await db
      .select({ name: teams.name, description: teams.description })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    const [channel] = await db
      .insert(channels)
      .values({
        workspaceId,
        scopeType: "team",
        scopeRefId: teamId,
        name: "team-room",
        title: team?.name ?? null,
        type: "private",
        description: team?.description ?? "Team collaboration channel",
      })
      .returning();

    await ensureScopedChannelSeedMembers(channel);

    return channel;
  }

  async function listChannelMembers(channelId: string) {
    const channel = await getRequiredChannel(channelId);

    await ensureScopedChannelSeedMembers(channel);

    if (isDefaultWorkspaceChannel(channel)) {
      const members = await workspaceMembershipService.listWorkspaceMembers(channel.workspaceId);
      return members.map((member) => ({
        channelId: channel.id,
        actorId: member.actorId,
        actorType: member.actorType,
        runtimeState: null,
        runtimeUpdatedAt: null,
        joinedAt: member.joinedAt,
        name: member.displayName,
        icon: member.icon,
        status: member.status,
        role: member.role,
      }));
    }

    try {
      return await listStoredChannelMembers(channelId);
    } catch (error) {
      if (!isMissingChannelMembersTableError(error)) {
        throw error;
      }

      return [];
    }
  }

  async function addChannelMember(channelId: string, actorId: string, actorType = "agent") {
    const channel = await getRequiredChannel(channelId);

    if (isDefaultWorkspaceChannel(channel)) {
      await workspaceMembershipService.addWorkspaceMember({
        workspaceId: channel.workspaceId,
        actorId,
        actorType,
      });
      await workspaceMembershipService.syncDefaultWorkspaceChannelMembers(
        channel.id,
        channel.workspaceId,
      );
      const members = await listChannelMembers(channelId);
      const member = members.find((entry) => entry.actorId === actorId);
      if (!member) {
        throw new Error("Failed to add channel member");
      }
      return member;
    }

    if (actorType === "agent") {
      const agentInWorkspace = await isAgentInWorkspaceLab(channel.workspaceId, actorId);
      if (!agentInWorkspace) {
        throw new Error("Agent not found in workspace lab");
      }
    }

    const inserted = await db
      .insert(channelMembers)
      .values({
        channelId,
        actorId,
        actorType,
      })
      .onConflictDoNothing({
        target: [channelMembers.channelId, channelMembers.actorId],
      })
      .returning();

    if (inserted[0]) {
      return inserted[0];
    }

    const [existing] = await db
      .select()
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.actorId, actorId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error("Failed to add channel member");
    }

    return existing;
  }

  async function removeChannelMember(channelId: string, actorId: string) {
    const channel = await getRequiredChannel(channelId);

    if (isDefaultWorkspaceChannel(channel)) {
      const removed = await workspaceMembershipService.removeWorkspaceMember(
        channel.workspaceId,
        actorId,
      );
      await workspaceMembershipService.syncDefaultWorkspaceChannelMembers(
        channel.id,
        channel.workspaceId,
      );
      return removed;
    }

    const [row] = await db
      .delete(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.actorId, actorId),
        ),
      )
      .returning();

    return row;
  }

  async function listChannelAgentMembers(channelId: string) {
    const channel = await getRequiredChannel(channelId);
    await ensureScopedChannelSeedMembers(channel);

    if (isDefaultWorkspaceChannel(channel)) {
      await workspaceMembershipService.syncDefaultWorkspaceChannelMembers(channel.id, channel.workspaceId);
    }

    try {
      return await db
        .select({
          actorId: channelMembers.actorId,
          actorType: channelMembers.actorType,
          runtimeState: channelMembers.runtimeState,
          runtimeUpdatedAt: channelMembers.runtimeUpdatedAt,
          name: agents.name,
          icon: agents.icon,
          status: agents.status,
          role: agents.role,
        })
        .from(channelMembers)
        .leftJoin(agents, sql`${channelMembers.actorId} = ${agents.id}::text`)
        .where(
          and(
            eq(channelMembers.channelId, channelId),
            eq(channelMembers.actorType, "agent"),
          ),
        )
        .orderBy(asc(channelMembers.joinedAt));
    } catch (error) {
      if (!isMissingChannelMembersTableError(error)) {
        throw error;
      }

      return [];
    }
  }

  async function updateChannelMemberRuntimeState(
    channelId: string,
    actorId: string,
    runtimeState: Record<string, unknown> | null,
  ) {
    await getRequiredChannel(channelId);

    const values = {
      runtimeState,
      runtimeUpdatedAt: new Date(),
    };

    const [row] = await db
      .update(channelMembers)
      .set(values)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.actorId, actorId),
        ),
      )
      .returning();

    return row ?? null;
  }

  async function listWorkspaceAgents(workspaceId: string) {
    const members = await workspaceMembershipService.listWorkspaceAgentMembers(workspaceId);

    return members.map((member) => ({
      id: member.actorId,
      name: member.displayName ?? member.actorId,
      icon: member.icon,
      status: member.status ?? "unknown",
      adapterType: member.adapterType ?? "unknown",
    }));
  }

  async function listAvailableLabAgentsForWorkspace(workspaceId: string) {
    return workspaceMembershipService.listAvailableWorkspaceAgents(workspaceId);
  }

  async function maybeDeriveChannelTitle(
    channelId: string,
    actorType: string,
    content: string,
  ) {
    if (actorType !== "human") {
      return null;
    }

    const nextTitle = deriveConversationTitle(content);
    if (!nextTitle) {
      return null;
    }

    const [channel] = await db
      .select({ title: channels.title })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) {
      return null;
    }

    if (typeof channel.title === "string" && channel.title.trim().length > 0) {
      return null;
    }

    return nextTitle;
  }

  return {
    listChannels,
    createChannel,
    getChannelById,
    listMessages,
    hydrateMessages,
    appendMessage,
    updateChannel,
    deleteChannel,
    ensureDefaultWorkspaceChannel,
    ensureAgentDmChannel,
    ensureTaskChannel,
    ensureTeamChannel,
    listChannelMembers,
    addChannelMember,
    removeChannelMember,
    listChannelAgentMembers,
    updateChannelMemberRuntimeState,
    listWorkspaceAgents,
    listAvailableLabAgentsForWorkspace,
  };
}

function buildMessagePreview(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.slice(0, 280);
}

function deriveConversationTitle(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 80);
}
