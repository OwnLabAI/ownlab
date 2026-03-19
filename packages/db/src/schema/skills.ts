import { pgTable, uuid, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { labs } from "./labs.js";

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id").notNull().references(() => labs.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sourceType: text("source_type").notNull().default("builtin"),
    localPath: text("local_path").notNull(),
    adapterCompat: jsonb("adapter_compat").$type<string[]>().notNull().default(["codex_local", "claude_local"]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    skillsLabSlugUniqueIdx: uniqueIndex("skills_lab_slug_idx").on(table.labId, table.slug),
    skillsLabSourceIdx: index("skills_lab_source_idx").on(table.labId, table.sourceType),
  }),
);
