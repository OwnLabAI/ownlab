import {
  type AnyPgColumn,
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { workspaces } from "./workspaces.js";
import { labs } from "./labs.js";
import { taskboards } from "./taskboards.js";

/**
 * Tasks — work items within a lab.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id").notNull().references(() => labs.id),
    boardId: uuid("board_id").references(() => taskboards.id),
    workspaceId: uuid("workspace_id").references(() => workspaces.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id),
    type: text("type").notNull().default("auto"),
    title: text("title").notNull(),
    objective: text("objective"),
    description: text("description"),
    status: text("status").notNull().default("backlog"),
    priority: text("priority").notNull().default("medium"),
    groupName: text("group_name"),
    assigneeAgentId: uuid("assignee_agent_id").references(() => agents.id),
    scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
    scheduleType: text("schedule_type").notNull().default("manual"),
    intervalSec: integer("interval_sec"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastResultSummary: text("last_result_summary"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    taskNumber: integer("task_number"),
    identifier: text("identifier"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    labStatusIdx: index("tasks_lab_status_idx").on(table.labId, table.status),
    boardIdx: index("tasks_board_idx").on(table.boardId),
    assigneeStatusIdx: index("tasks_lab_assignee_status_idx").on(
      table.labId,
      table.assigneeAgentId,
      table.status,
    ),
    parentIdx: index("tasks_lab_parent_idx").on(table.labId, table.parentId),
    workspaceIdx: index("tasks_lab_workspace_idx").on(table.labId, table.workspaceId),
    identifierIdx: uniqueIndex("tasks_identifier_idx").on(table.identifier),
  }),
);
