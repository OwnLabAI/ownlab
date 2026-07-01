import type { Db } from "@ownlab/db";
import type {
  WorkspacePluginRecord,
  WorkspacePluginViewData,
} from "@ownlab/shared";

const PLUGINS_DISABLED_ERROR = "PLUGINS_DISABLED";

function throwPluginsDisabled(): never {
  throw new Error(PLUGINS_DISABLED_ERROR);
}

export function createPluginService(_db: Db) {
  async function listWorkspacePlugins(_workspaceId: string): Promise<WorkspacePluginRecord[]> {
    throwPluginsDisabled();
  }

  async function updateWorkspacePlugin(
    _workspaceId: string,
    _pluginId: string,
    _input: {
      enabled?: boolean;
      config?: Record<string, unknown>;
    },
  ): Promise<WorkspacePluginRecord> {
    throwPluginsDisabled();
  }

  async function triggerWorkspacePluginAction(
    _workspaceId: string,
    _pluginId: string,
    _actionKey: string,
    _payload?: Record<string, unknown>,
  ): Promise<WorkspacePluginRecord> {
    throwPluginsDisabled();
  }

  async function getWorkspacePluginView(
    _workspaceId: string,
    _pluginId: string,
  ): Promise<WorkspacePluginViewData> {
    throwPluginsDisabled();
  }

  async function listWorkspaceContextEntries(_workspaceId: string): Promise<never[]> {
    return [];
  }

  return {
    listWorkspacePlugins,
    updateWorkspacePlugin,
    triggerWorkspacePluginAction,
    getWorkspacePluginView,
    listWorkspaceContextEntries,
  };
}
