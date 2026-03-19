export interface Skill {
  id: string;
  labId: string;
  slug: string;
  name: string;
  description: string | null;
  sourceType: "builtin" | "community";
  localPath: string;
  adapterCompat: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSkillAssignment {
  id: string;
  agentId: string;
  skillId: string;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  skill: Skill;
}
