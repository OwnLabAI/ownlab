import type { ChatRole } from "../constants.js";

export interface ChatThread {
  id: string;
  labId: string;
  agentId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: ChatRole;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SendChatInput {
  agentId: string;
  threadId?: string;
  messages: Array<{ role: ChatRole; content: string }>;
}
