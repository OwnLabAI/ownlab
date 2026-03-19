export interface Team {
  id: string;
  labId: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  status: string;
  leaderAgentId: string | null;
  runtimeConfig: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  teamId: string;
  agentId: string;
  role: string;
  teamRole: string;
  joinedAt: string;
  name: string;
  icon: string | null;
  status: string;
  adapterType: string;
  reportsTo: string | null;
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  leaderName: string;
  leaderRole?: string;
  workerCount: number;
  workerRole?: string;
  workerNamePrefix?: string;
  workspaceId?: string;
  adapterType: string;
  model: string;
  icon?: string;
  runtimeConfig?: Record<string, unknown>;
  adapterConfig?: Record<string, unknown>;
}
