import { pgTable, uuid, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Labs — top-level ownership unit for an OwnLab instance.
 */
export const labs = pgTable(
  "labs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    taskPrefix: text("task_prefix").notNull().default("LAB"),
    taskCounter: integer("task_counter").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    taskPrefixUniqueIdx: uniqueIndex("labs_task_prefix_idx").on(table.taskPrefix),
  }),
);
