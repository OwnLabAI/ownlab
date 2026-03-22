import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { labs } from "./labs.js";
import { agents } from "./agents.js";

/**
 * Workspaces — filesystem-backed project containers within a lab.
 */
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id").notNull().references(() => labs.id),
    name: text("name").notNull(),
    description: text("description"),
    goalMarkdown: text("goal_markdown"),
    goalUpdatedAt: timestamp("goal_updated_at", { withTimezone: true }),
    /** Local filesystem path for this workspace (e.g. project folder). Used to show file tree in File tab when server can read it. */
    worktreePath: text("worktree_path"),
    status: text("status").notNull().default("active"),
    leadAgentId: uuid("lead_agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    labIdx: index("workspaces_lab_idx").on(table.labId),
  }),
);
