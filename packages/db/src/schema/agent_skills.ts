import { pgTable, uuid, boolean, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { skills } from "./skills.js";

export const agentSkills = pgTable(
  "agent_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull().default(100),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentSkillsUniqueIdx: uniqueIndex("agent_skills_agent_skill_idx").on(table.agentId, table.skillId),
    agentSkillsAgentIdx: index("agent_skills_agent_idx").on(table.agentId, table.updatedAt),
    agentSkillsSkillIdx: index("agent_skills_skill_idx").on(table.skillId, table.updatedAt),
  }),
);
