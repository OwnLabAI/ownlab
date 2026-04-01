import type { Db } from "@ownlab/db";
import {
  and,
  desc,
  eq,
  plugins,
  workspacePlugins,
  workspaces,
} from "@ownlab/db";
import type {
  PluginManifest,
  WorkspacePluginRecord,
  WorkspacePluginViewData,
} from "@ownlab/shared";

const ZOTERO_PLUGIN_KEY = "zotero";

const ZOTERO_MANIFEST: PluginManifest = {
  key: ZOTERO_PLUGIN_KEY,
  displayName: "Zotero",
  version: "0.1.0",
  description: "Connect a Zotero library to this workspace and bring sources into the creative flow.",
  icon: "LibraryBig",
  worker: {
    runtime: "node",
    entry: "@ownlab/plugin-zotero/worker",
  },
  ui: {
    workspaceView: "@ownlab/plugin-zotero/workspace-view",
  },
  capabilities: ["workspace_view", "sync_jobs", "workspace_context"],
  configFields: [
    {
      key: "endpoint",
      label: "API Endpoint",
      type: "text",
      placeholder: "https://api.zotero.org",
      required: true,
    },
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      placeholder: "zotero-api-key",
      required: true,
    },
    {
      key: "libraryType",
      label: "Library Type",
      type: "text",
      placeholder: "users or groups",
      required: true,
    },
    {
      key: "libraryId",
      label: "Library ID",
      type: "text",
      placeholder: "user or group library id",
      required: true,
    },
    {
      key: "collection",
      label: "Collection",
      type: "text",
      placeholder: "optional collection key",
      required: false,
    },
  ],
  jobs: [
    {
      key: "sync",
      label: "Sync library",
      trigger: "manual",
    },
  ],
};

type ZoteroEntry = {
  id: string;
  key: string;
  title: string;
  creators: string[];
  year: string | null;
  publication: string;
  abstract: string;
  tags: string[];
  noteCount: number;
  attachmentCount: number;
  zoteroUrl: string | null;
  citationText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getWorkspacePluginStatus(config: Record<string, unknown>) {
  const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
  const libraryType = typeof config.libraryType === "string" ? config.libraryType.trim() : "";
  const libraryId = typeof config.libraryId === "string" ? config.libraryId.trim() : "";
  return apiKey && libraryType && libraryId ? "connected" : "needs_config";
}

function getConfigString(config: Record<string, unknown>, key: string) {
  return typeof config[key] === "string" ? config[key].trim() : "";
}

function parseZoteroYear(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const match = value.match(/\b(\d{4})\b/);
  return match ? match[1] : null;
}

function buildCitationText(input: {
  title: string;
  creators: string[];
  year: string | null;
  publication: string;
}) {
  const authors = input.creators.length > 0 ? input.creators.join(", ") : "Unknown author";
  const year = input.year ?? "n.d.";
  const publication = input.publication ? ` ${input.publication}.` : "";
  return `${authors} (${year}). ${input.title}.${publication}`.trim();
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function buildZoteroEntryFromApi(item: Record<string, unknown>): ZoteroEntry | null {
  const data = isRecord(item.data) ? item.data : null;
  if (!data) {
    return null;
  }

  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Untitled";
  const creators = Array.isArray(data.creators)
    ? data.creators.flatMap((entry) => {
        if (!isRecord(entry)) {
          return [];
        }
        const fullName = typeof entry.name === "string" ? entry.name.trim() : "";
        const firstName = typeof entry.firstName === "string" ? entry.firstName.trim() : "";
        const lastName = typeof entry.lastName === "string" ? entry.lastName.trim() : "";
        const combined = [firstName, lastName].filter(Boolean).join(" ").trim();
        return [fullName || combined].filter(Boolean);
      })
    : [];
  const publication = [
    typeof data.publicationTitle === "string" ? data.publicationTitle.trim() : "",
    typeof data.bookTitle === "string" ? data.bookTitle.trim() : "",
    typeof data.publisher === "string" ? data.publisher.trim() : "",
  ].find(Boolean) ?? "";
  const abstract =
    typeof data.abstractNote === "string" && data.abstractNote.trim()
      ? data.abstractNote.trim()
      : "";
  const tags = Array.isArray(data.tags)
    ? data.tags.flatMap((entry) =>
        isRecord(entry) && typeof entry.tag === "string" && entry.tag.trim() ? [entry.tag.trim()] : [],
      )
    : [];
  const year = parseZoteroYear(data.date);
  const noteCount =
    typeof data.numNotes === "number"
      ? data.numNotes
      : typeof data.numNotes === "string"
        ? Number(data.numNotes) || 0
        : 0;
  const attachmentCount =
    typeof data.numAttachments === "number"
      ? data.numAttachments
      : typeof data.numAttachments === "string"
        ? Number(data.numAttachments) || 0
        : 0;
  const key = typeof item.key === "string" ? item.key : typeof data.key === "string" ? data.key : title;
  const zoteroUrl = typeof data.url === "string" && data.url.trim() ? data.url.trim() : null;
  const citationText = buildCitationText({
    title,
    creators,
    year,
    publication,
  });

  return {
    id: key,
    key,
    title,
    creators,
    year,
    publication,
    abstract,
    tags,
    noteCount,
    attachmentCount,
    zoteroUrl,
    citationText,
  };
}

async function fetchZoteroItems(config: Record<string, unknown>): Promise<ZoteroEntry[]> {
  const endpoint = getConfigString(config, "endpoint") || "https://api.zotero.org";
  const libraryType = getConfigString(config, "libraryType");
  const libraryId = getConfigString(config, "libraryId");
  const apiKey = getConfigString(config, "apiKey");
  const collection = getConfigString(config, "collection");

  if (!endpoint || !libraryType || !libraryId || !apiKey) {
    throw new Error("PLUGIN_NEEDS_CONFIG");
  }

  const url = new URL(`${endpoint.replace(/\/$/, "")}/${libraryType}/${libraryId}/items/top`);
  url.searchParams.set("format", "json");
  url.searchParams.set("include", "data");
  url.searchParams.set("limit", "50");
  url.searchParams.set("sort", "dateModified");
  url.searchParams.set("direction", "desc");
  if (collection) {
    url.searchParams.set("collection", collection);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      headers: {
        "Zotero-API-Key": apiKey,
        "Zotero-API-Version": "3",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        body.trim()
          ? `Zotero sync failed (${response.status}): ${body.trim()}`
          : `Zotero sync failed with status ${response.status}`,
      );
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error("Zotero sync failed: unexpected response shape");
    }

    return payload
      .map((item) => (isRecord(item) ? buildZoteroEntryFromApi(item) : null))
      .filter((entry): entry is ZoteroEntry => Boolean(entry));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Zotero sync timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getWorkspaceContextItems(state: Record<string, unknown>): ZoteroEntry[] {
  const items = Array.isArray(state.items) ? state.items : [];
  const contextIds = new Set(asStringArray(state.contextItemIds));
  return items.filter((entry): entry is ZoteroEntry => {
    if (!isRecord(entry)) {
      return false;
    }
    const id = typeof entry.id === "string" ? entry.id : "";
    return Boolean(id) && contextIds.has(id);
  }) as ZoteroEntry[];
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
    const nextStatus = getWorkspacePluginStatus(nextConfig);

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
      const status = getWorkspacePluginStatus(config);
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
    const contextItems = getWorkspaceContextItems(state);

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
      return getWorkspaceContextItems(state).map((entry) => ({
        pluginKey: row.plugin.key,
        pluginName: row.plugin.displayName,
        title: entry.title,
        citationText: entry.citationText,
        creators: entry.creators,
        abstract: entry.abstract,
        zoteroUrl: entry.zoteroUrl,
        tags: entry.tags,
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
