import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { channels } from "./channels.js";

export const agentConversationSessions = pgTable(
  "agent_conversation_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
    title: text("title"),
    codexSessionId: text("codex_session_id"),
    codexSessionParams: jsonb("codex_session_params").$type<Record<string, unknown> | null>(),
    codexSessionDisplayId: text("codex_session_display_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentChannelIdx: index("agent_conversation_sessions_agent_channel_idx").on(
      table.agentId,
      table.channelId,
      table.createdAt,
    ),
  }),
);
