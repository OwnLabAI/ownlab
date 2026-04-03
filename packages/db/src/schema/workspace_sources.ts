import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const workspaceSources = pgTable(
  "workspace_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("native"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("ready"),
    summary: text("summary"),
    filePath: text("file_path"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    connectorType: text("connector_type"),
    connectorRefId: text("connector_ref_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("workspace_sources_workspace_idx").on(table.workspaceId),
    workspaceUpdatedIdx: index("workspace_sources_workspace_updated_idx").on(
      table.workspaceId,
      table.updatedAt,
    ),
  }),
);
