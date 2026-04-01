import type { Db } from "@ownlab/db";
import {
  and,
  desc,
  eq,
  plugins,
  workspacePlugins,
  workspaces,
} from "@ownlab/db";
import {
  ZOTERO_MANIFEST,
  ZOTERO_PLUGIN_KEY,
  asStringArray,
  fetchZoteroItems,
  getZoteroContextEntries,
  getZoteroWorkspaceContextItems,
  getZoteroWorkspacePluginStatus,
} from "@ownlab/plugin-zotero";
import type {
  WorkspacePluginRecord,
  WorkspacePluginViewData,
} from "@ownlab/shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildWorkspacePluginRecord(input: {
  workspacePlugin: typeof workspacePlugins.$inferSelect;
  plugin: typeof plugins.$inferSelect;
}): WorkspacePluginRecord {
  return {
    id: input.workspacePlugin.id,
    workspaceId: input.workspacePlugin.workspaceId,
    pluginId: input.workspacePlugin.pluginId,
    enabled: input.workspacePlugin.enabled,
    status: input.workspacePlugin.status,
    config: input.workspacePlugin.config ?? {},
    state: input.workspacePlugin.state ?? {},
    lastSyncedAt: input.workspacePlugin.lastSyncedAt?.toISOString() ?? null,
    createdAt: input.workspacePlugin.createdAt.toISOString(),
    updatedAt: input.workspacePlugin.updatedAt.toISOString(),
    plugin: {
      id: input.plugin.id,
      labId: input.plugin.labId,
      key: input.plugin.key,
      displayName: input.plugin.displayName,
      version: input.plugin.version,
      status: input.plugin.status,
      manifest: input.plugin.manifest,
      createdAt: input.plugin.createdAt.toISOString(),
      updatedAt: input.plugin.updatedAt.toISOString(),
    },
  };
}

export function createPluginService(db: Db) {
  async function getWorkspaceOrThrow(workspaceId: string) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("WORKSPACE_NOT_FOUND");
    }

    return workspace;
  }

  async function ensureOfficialPlugins(labId: string) {
    const [existingZotero] = await db
      .select()
      .from(plugins)
      .where(and(eq(plugins.labId, labId), eq(plugins.key, ZOTERO_PLUGIN_KEY)))
      .limit(1);

    if (existingZotero) {
      return [existingZotero];
    }

    const [created] = await db
      .insert(plugins)
      .values({
        labId,
        key: ZOTERO_PLUGIN_KEY,
        displayName: "Zotero",
        version: ZOTERO_MANIFEST.version,
        status: "active",
        manifest: ZOTERO_MANIFEST,
      })
      .returning();

    return [created];
  }

  async function ensureWorkspacePluginBinding(workspaceId: string, pluginId: string) {
    const [existing] = await db
      .select()
      .from(workspacePlugins)
      .where(
        and(
          eq(workspacePlugins.workspaceId, workspaceId),
          eq(workspacePlugins.pluginId, pluginId),
        ),
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(workspacePlugins)
      .values({
        workspaceId,
        pluginId,
        enabled: true,
        status: "needs_config",
        config: {},
        state: {},
      })
      .returning();

    return created;
  }

  async function ensureWorkspacePluginCatalog(workspaceId: string) {
    const workspace = await getWorkspaceOrThrow(workspaceId);
    const catalog = await ensureOfficialPlugins(workspace.labId);

    await Promise.all(
      catalog.map((plugin) => ensureWorkspacePluginBinding(workspaceId, plugin.id)),
    );

    return workspace;
  }

  async function getWorkspacePluginRow(workspaceId: string, pluginId: string) {
    const [row] = await db
      .select({
        workspacePlugin: workspacePlugins,
        plugin: plugins,
      })
      .from(workspacePlugins)
      .innerJoin(plugins, eq(workspacePlugins.pluginId, plugins.id))
      .where(
        and(
          eq(workspacePlugins.workspaceId, workspaceId),
          eq(workspacePlugins.pluginId, pluginId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async function listWorkspacePlugins(workspaceId: string) {
    await ensureWorkspacePluginCatalog(workspaceId);

    const rows = await db
      .select({
        workspacePlugin: workspacePlugins,
        plugin: plugins,
      })
      .from(workspacePlugins)
      .innerJoin(plugins, eq(workspacePlugins.pluginId, plugins.id))
      .where(eq(workspacePlugins.workspaceId, workspaceId))
      .orderBy(desc(workspacePlugins.updatedAt));

    return rows.map(buildWorkspacePluginRecord);
  }

  async function updateWorkspacePlugin(
    workspaceId: string,
    pluginId: string,
    input: {
      enabled?: boolean;
      config?: Record<string, unknown>;
    },
  ) {
    await ensureWorkspacePluginCatalog(workspaceId);
    const current = await getWorkspacePluginRow(workspaceId, pluginId);
    if (!current) {
      throw new Error("PLUGIN_NOT_FOUND");
    }

    const nextConfig = isRecord(input.config)
      ? { ...(current.workspacePlugin.config ?? {}), ...input.config }
      : (current.workspacePlugin.config ?? {});
    const nextStatus = getZoteroWorkspacePluginStatus(nextConfig);

    const [updated] = await db
      .update(workspacePlugins)
      .set({
        enabled: typeof input.enabled === "boolean" ? input.enabled : current.workspacePlugin.enabled,
        config: nextConfig,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(workspacePlugins.id, current.workspacePlugin.id))
      .returning();

    return buildWorkspacePluginRecord({
      workspacePlugin: updated,
      plugin: current.plugin,
    });
  }

  async function triggerWorkspacePluginAction(
    workspaceId: string,
    pluginId: string,
    actionKey: string,
    payload?: Record<string, unknown>,
  ) {
    await ensureWorkspacePluginCatalog(workspaceId);
    const current = await getWorkspacePluginRow(workspaceId, pluginId);
    if (!current) {
      throw new Error("PLUGIN_NOT_FOUND");
    }

    if (current.plugin.key !== ZOTERO_PLUGIN_KEY) {
      throw new Error("UNSUPPORTED_ACTION");
    }

    const config = current.workspacePlugin.config ?? {};
    const existingState = current.workspacePlugin.state ?? {};
    let nextState = existingState;
    let nextStatus = current.workspacePlugin.status;
    let nextLastSyncedAt = current.workspacePlugin.lastSyncedAt ?? null;

    if (actionKey === "sync") {
      const status = getZoteroWorkspacePluginStatus(config);
      if (status !== "connected") {
        throw new Error("PLUGIN_NEEDS_CONFIG");
      }

      const items = await fetchZoteroItems(config);
      const preservedContextIds = new Set(asStringArray(existingState.contextItemIds));
      const nextContextIds = items
        .map((item) => item.id)
        .filter((itemId) => preservedContextIds.has(itemId));

      nextStatus = "connected";
      nextLastSyncedAt = new Date();
      nextState = {
        ...existingState,
        connectionHealth: "connected",
        lastSyncStatus: "ready",
        syncedItemCount: items.length,
        items,
        contextItemIds: nextContextIds,
      };
    } else if (actionKey === "add_to_context" || actionKey === "remove_from_context") {
      const itemId = typeof payload?.itemId === "string" ? payload.itemId.trim() : "";
      if (!itemId) {
        throw new Error("INVALID_ACTION_PAYLOAD");
      }

      const allItems = Array.isArray(existingState.items) ? existingState.items : [];
      const knownItemIds = new Set(
        allItems
          .filter((entry): entry is Record<string, unknown> => isRecord(entry))
          .map((entry) => (typeof entry.id === "string" ? entry.id : ""))
          .filter(Boolean),
      );
      if (!knownItemIds.has(itemId)) {
        throw new Error("PLUGIN_ITEM_NOT_FOUND");
      }

      const contextIds = new Set(asStringArray(existingState.contextItemIds));
      if (actionKey === "add_to_context") {
        contextIds.add(itemId);
      } else {
        contextIds.delete(itemId);
      }

      nextState = {
        ...existingState,
        contextItemIds: Array.from(contextIds),
      };
    } else {
      throw new Error("UNSUPPORTED_ACTION");
    }

    const [updated] = await db
      .update(workspacePlugins)
      .set({
        status: nextStatus,
        lastSyncedAt: nextLastSyncedAt,
        state: nextState,
        updatedAt: new Date(),
      })
      .where(eq(workspacePlugins.id, current.workspacePlugin.id))
      .returning();

    return buildWorkspacePluginRecord({
      workspacePlugin: updated,
      plugin: current.plugin,
    });
  }

  async function getWorkspacePluginView(
    workspaceId: string,
    pluginId: string,
  ): Promise<WorkspacePluginViewData> {
    await ensureWorkspacePluginCatalog(workspaceId);
    const current = await getWorkspacePluginRow(workspaceId, pluginId);
    if (!current) {
      throw new Error("PLUGIN_NOT_FOUND");
    }

    const plugin = buildWorkspacePluginRecord(current);
    const state = plugin.state ?? {};
    const contextItems = getZoteroWorkspaceContextItems(state);

    return {
      plugin,
      data: {
        connectionHealth:
          typeof state.connectionHealth === "string"
            ? state.connectionHealth
            : plugin.status === "connected"
              ? "connected"
              : "needs_config",
        lastSyncStatus:
          typeof state.lastSyncStatus === "string" ? state.lastSyncStatus : "idle",
        syncedItemCount:
          typeof state.syncedItemCount === "number" ? state.syncedItemCount : 0,
        items: Array.isArray(state.items) ? state.items : [],
        contextItems,
        contextItemIds: asStringArray(state.contextItemIds),
      },
    };
  }

  async function listWorkspaceContextEntries(workspaceId: string) {
    await ensureWorkspacePluginCatalog(workspaceId);
    const rows = await db
      .select({
        workspacePlugin: workspacePlugins,
        plugin: plugins,
      })
      .from(workspacePlugins)
      .innerJoin(plugins, eq(workspacePlugins.pluginId, plugins.id))
      .where(eq(workspacePlugins.workspaceId, workspaceId));

    return rows.flatMap((row) => {
      const state = row.workspacePlugin.state ?? {};
      return getZoteroContextEntries(state).map((entry) => ({
        pluginKey: row.plugin.key,
        pluginName: row.plugin.displayName,
        ...entry,
      }));
    });
  }

  return {
    listWorkspacePlugins,
    updateWorkspacePlugin,
    triggerWorkspacePluginAction,
    getWorkspacePluginView,
    listWorkspaceContextEntries,
  };
}
