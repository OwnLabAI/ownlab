import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { labs } from "./labs.js";
import { agents } from "./agents.js";
import { tasks } from "./tasks.js";

/**
 * Heartbeat runs — execution records when an agent is invoked for a task.
 * Supports manual invoke and timer-based task execution records.
 */
export const heartbeatRuns = pgTable(
  "heartbeat_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    taskId: uuid("task_id").references(() => tasks.id, {
      onDelete: "cascade",
    }),
    status: text("status").notNull().default("queued"),
    invocationSource: text("invocation_source").notNull().default("on_demand"),
    triggerDetail: text("trigger_detail"),
    contextSnapshot: jsonb("context_snapshot").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    exitCode: integer("exit_code"),
    resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentIdx: index("heartbeat_runs_agent_idx").on(table.agentId),
    taskIdx: index("heartbeat_runs_task_idx").on(table.taskId),
    statusIdx: index("heartbeat_runs_status_idx").on(table.status),
  }),
);
