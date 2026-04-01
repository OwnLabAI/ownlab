import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { PluginManifest } from "@ownlab/shared";
import { labs } from "./labs.js";
import { workspaces } from "./workspaces.js";

export const plugins = pgTable(
  "plugins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id").notNull().references(() => labs.id),
    key: text("key").notNull(),
    displayName: text("display_name").notNull(),
    version: text("version").notNull().default("0.1.0"),
    status: text("status").notNull().default("active"),
    manifest: jsonb("manifest").$type<PluginManifest>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    labIdx: index("plugins_lab_idx").on(table.labId),
    labKeyIdx: uniqueIndex("plugins_lab_key_idx").on(table.labId, table.key),
  }),
);

export const workspacePlugins = pgTable(
  "workspace_plugins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, {
      onDelete: "cascade",
    }),
    enabled: boolean("enabled").notNull().default(true),
    status: text("status").notNull().default("needs_config"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    state: jsonb("state").$type<Record<string, unknown>>().notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("workspace_plugins_workspace_idx").on(table.workspaceId),
    workspacePluginIdx: uniqueIndex("workspace_plugins_workspace_plugin_idx").on(
      table.workspaceId,
      table.pluginId,
    ),
  }),
);
