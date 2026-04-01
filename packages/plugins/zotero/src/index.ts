import type { PluginManifest } from "@ownlab/shared";

export const ZOTERO_PLUGIN_KEY = "zotero";

export const ZOTERO_MANIFEST: PluginManifest = {
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

export type ZoteroEntry = {
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

export type ZoteroContextEntry = {
  title: string;
  citationText: string;
  creators: string[];
  abstract: string;
  zoteroUrl: string | null;
  tags: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
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
    typeof data.abstractNote === 'string' && data.abstractNote.trim()
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
    citationText: buildCitationText({
      title,
      creators,
      year,
      publication,
    }),
  };
}

export function getZoteroWorkspacePluginStatus(config: Record<string, unknown>) {
  const apiKey = getConfigString(config, "apiKey");
  const libraryType = getConfigString(config, "libraryType");
  const libraryId = getConfigString(config, "libraryId");
  return apiKey && libraryType && libraryId ? "connected" : "needs_config";
}

export async function fetchZoteroItems(config: Record<string, unknown>): Promise<ZoteroEntry[]> {
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

export function getZoteroWorkspaceContextItems(state: Record<string, unknown>): ZoteroEntry[] {
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

export function getZoteroContextEntries(state: Record<string, unknown>): ZoteroContextEntry[] {
  return getZoteroWorkspaceContextItems(state).map((entry) => ({
    title: entry.title,
    citationText: entry.citationText,
    creators: entry.creators,
    abstract: entry.abstract,
    zoteroUrl: entry.zoteroUrl,
    tags: entry.tags,
  }));
}
