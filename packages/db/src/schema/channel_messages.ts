import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { channels } from "./channels.js";
import { agentConversationSessions } from "./agent_conversation_sessions.js";

/**
 * Channel messages — messages from humans or agents in a channel.
 * actorType distinguishes between human and agent senders.
 */
export const channelMessages = pgTable(
  "channel_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id").notNull().references(() => channels.id),
    sessionId: uuid("session_id").references(() => agentConversationSessions.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull().default("human"),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelCreatedIdx: index("channel_messages_channel_created_idx").on(table.channelId, table.createdAt),
    sessionCreatedIdx: index("channel_messages_session_created_idx").on(table.sessionId, table.createdAt),
  }),
);
