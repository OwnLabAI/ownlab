export type PluginCapability =
  | "workspace_view"
  | "sync_jobs"
  | "workspace_context";

export type PluginConfigField = {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
  required?: boolean;
  description?: string;
};

export type PluginJobManifest = {
  key: string;
  label: string;
  trigger: "manual" | "interval";
};

export type PluginManifest = {
  key: string;
  displayName: string;
  version: string;
  description?: string | null;
  icon?: string | null;
  worker: {
    runtime: "node";
    entry: string;
  };
  ui?: {
    workspaceView?: string;
  };
  capabilities: PluginCapability[];
  configFields: PluginConfigField[];
  jobs: PluginJobManifest[];
};

export type PluginRecord = {
  id: string;
  labId: string;
  key: string;
  displayName: string;
  version: string;
  status: string;
  manifest: PluginManifest;
  createdAt: string;
  updatedAt: string;
};

export type WorkspacePluginRecord = {
  id: string;
  workspaceId: string;
  pluginId: string;
  enabled: boolean;
  status: string;
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  plugin: PluginRecord;
};

export type WorkspacePluginViewData = {
  plugin: WorkspacePluginRecord;
  data: Record<string, unknown>;
};
