export type WorkspaceSourceKind = "native" | "connector";

export type WorkspaceSourceType =
  | "webpage"
  | "image"
  | "video"
  | "obsidian";

export type WorkspaceSourceStatus =
  | "ready"
  | "processing"
  | "syncing"
  | "error"
  | "stale"
  | "needs_config";

export type WorkspaceSource = {
  id: string;
  workspaceId: string;
  kind: WorkspaceSourceKind;
  type: WorkspaceSourceType;
  title: string;
  status: WorkspaceSourceStatus | string;
  summary: string | null;
  content: string | null;
  filePath: string | null;
  metadata: Record<string, unknown>;
  connectorType: string | null;
  connectorRefId: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkspaceSourceInput = {
  type: Extract<WorkspaceSourceType, "webpage" | "image" | "video">;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown>;
};
