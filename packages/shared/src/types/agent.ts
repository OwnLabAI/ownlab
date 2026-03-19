import type { AdapterType, AgentStatus } from "../constants.js";

export interface Agent {
  id: string;
  labId: string;
  name: string;
  role: string;
  reportsTo: string | null;
  title: string | null;
  icon: string | null;
  status: AgentStatus;
  adapterType: AdapterType;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  role?: string;
  reportsTo?: string | null;
  adapterType: AdapterType;
  model: string;
  icon?: string | null;
  style?: string;
  agentType?: "local" | "cloud";
  adapterConfig?: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
}
