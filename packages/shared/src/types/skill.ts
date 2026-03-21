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

export interface AgentRuntimeSkillEntry {
  name: string;
  path: string;
  targetPath: string | null;
  isSymlink: boolean;
}

export interface AgentRuntimeSkills {
  agentId: string;
  adapterType: string;
  rootPath: string | null;
  supported: boolean;
  entries: AgentRuntimeSkillEntry[];
}
