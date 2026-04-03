import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Channels — unified chat containers where humans and agents interact.
 * Every dialog surface in ownlab (workspace chat, agent DM, task comments, etc.)
 * should map to a channel with an appropriate scope.
 */
export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    /**
     * Scope of this channel within ownlab.
     * Examples: workspace | agent_dm | task | lab | system
     */
    scopeType: text("scope_type").notNull().default("workspace"),
    /**
     * Optional reference id depending on scopeType.
     * For example: workspaceId, agentId, taskId, labId, etc.
     */
    scopeRefId: text("scope_ref_id"),
    name: text("name").notNull().default("general"),
    title: text("title"),
    type: text("type").notNull().default("public"),
    description: text("description"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessagePreview: text("last_message_preview"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("channels_workspace_idx").on(table.workspaceId),
    scopeIdx: index("channels_scope_idx").on(table.scopeType, table.scopeRefId),
    workspaceScopeRefUniqueIdx: uniqueIndex("channels_workspace_scope_ref_unique_idx").on(
      table.workspaceId,
      table.scopeType,
      table.scopeRefId,
    ),
  }),
);

/**
 * Channel members — humans and agents that participate in a channel.
 * For workspace channels, members can be added/removed via the Members panel.
 */
export const channelMembers = pgTable(
  "channel_members",
  {
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull().default("agent"),
    runtimeState: jsonb("runtime_state").$type<Record<string, unknown> | null>(),
    runtimeUpdatedAt: timestamp("runtime_updated_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.channelId, table.actorId] }),
    index("channel_members_actor_idx").on(table.actorId),
  ],
);
