import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const workspaceAccessMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull().default("agent"),
    role: text("role").notNull().default("member"),
    displayName: text("display_name"),
    icon: text("icon"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.actorId] }),
    index("workspace_members_actor_idx").on(table.actorId),
    index("workspace_members_workspace_actor_type_idx").on(table.workspaceId, table.actorType),
  ],
);
