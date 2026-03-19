import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { labs } from "./labs.js";

/**
 * Taskboards — collections of tasks within a lab.
 * Each board is a Kanban-style container that groups related tasks.
 */
export const taskboards = pgTable(
  "taskboards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id").notNull().references(() => labs.id),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    labIdx: index("taskboards_lab_idx").on(table.labId),
  }),
);
