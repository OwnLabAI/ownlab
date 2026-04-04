import path from "node:path";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { Readability } from "@mozilla/readability";
import type { Db } from "@ownlab/db";
import { desc, eq, workspaceSources, workspaces } from "@ownlab/db";
import type { CreateWorkspaceSourceInput, WorkspaceSource } from "@ownlab/shared";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import * as YoutubeTranscriptModule from "youtube-transcript/dist/youtube-transcript.esm.js";
import { validateWorkspaceRoot } from "../workspace/file-tree.js";

type TranscriptSegment = {
  text?: string;
};

function sanitizeSegment(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "source";
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function allocateUniqueBasePath(rootPath: string, baseName: string, extension = ".md") {
  const sanitizedBase = sanitizeSegment(baseName);

  for (let index = 0; index < 200; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const relativePath = path.join("sources", `${sanitizedBase}${suffix}${extension}`);
    const absolutePath = path.join(rootPath, relativePath);
    if (!(await pathExists(absolutePath))) {
      return { relativePath, absolutePath, baseKey: `${sanitizedBase}${suffix}` };
    }
  }

  throw new Error("SOURCE_PATH_ALLOCATION_FAILED");
}

async function allocateUniqueFilePath(
  rootPath: string,
  baseName: string,
  extension: string,
) {
  const sanitizedBase = sanitizeSegment(baseName);

  for (let index = 0; index < 200; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const relativePath = path.join("sources", `${sanitizedBase}${suffix}${extension}`);
    const absolutePath = path.join(rootPath, relativePath);
    if (!(await pathExists(absolutePath))) {
      return { relativePath, absolutePath };
    }
  }

  throw new Error("SOURCE_PATH_ALLOCATION_FAILED");
}

function resolveSourceTitle(input: CreateWorkspaceSourceInput) {
  const explicitTitle = input.title?.trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  if (input.type === "image") {
    const fileName =
      typeof input.metadata?.fileName === "string" ? input.metadata.fileName.trim() : "";
    const baseName = path.basename(fileName, path.extname(fileName)).trim();
    if (baseName) {
      return baseName;
    }
    return "Image";
  }

  if (input.type === "video") {
    return "Video";
  }

  return "Webpage";
}

function buildTextMarkdown(input: {
  title: string;
  summary?: string | null;
  content?: string | null;
}) {
  const parts = [`# ${input.title.trim()}`];
  if (input.summary?.trim()) {
    parts.push(input.summary.trim());
  }
  if (input.content?.trim()) {
    parts.push(input.content.trim());
  }
  return `${parts.join("\n\n").trim()}\n`;
}

function buildUrlMarkdown(input: {
  title: string;
  summary?: string | null;
  url: string;
  label?: string;
}) {
  const parts = [`# ${input.title.trim()}`, `[${input.label ?? "Open link"}](${input.url.trim()})`];
  if (input.summary?.trim()) {
    parts.push(input.summary.trim());
  }
  return `${parts.join("\n\n").trim()}\n`;
}

function matchMetaContent(html: string, attribute: "name" | "property", key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attribute}=["']${key}["'][^>]*>`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

async function fetchHtmlDocument(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "OwnLab/0.1 (+https://ownlab.local; workspace-sources-web-import)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error("WEBPAGE_FETCH_FAILED");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("WEBPAGE_UNSUPPORTED_CONTENT_TYPE");
  }

  return {
    finalUrl: response.url || url,
    html: await response.text(),
  };
}

function htmlToMarkdown(html: string) {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  return turndown.turndown(html).trim();
}

function extractWebpageMarkdown(input: { html: string; url: string }) {
  const dom = new JSDOM(input.html, { url: input.url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const title =
    article?.title?.trim() ||
    matchMetaContent(input.html, "property", "og:title") ||
    dom.window.document.title?.trim() ||
    "Untitled Page";
  const description =
    article?.excerpt?.trim() ||
    matchMetaContent(input.html, "property", "og:description") ||
    matchMetaContent(input.html, "name", "description");
  const siteName =
    article?.siteName?.trim() ||
    matchMetaContent(input.html, "property", "og:site_name");
  const byline = article?.byline?.trim() || null;
  const contentHtml = article?.content?.trim() || dom.window.document.body?.innerHTML || "";
  const markdown = htmlToMarkdown(contentHtml);
  const plainText = article?.textContent?.trim() || dom.window.document.body?.textContent?.trim() || "";

  if (!markdown && !plainText) {
    throw new Error("WEBPAGE_EXTRACTION_EMPTY");
  }

  return {
    title,
    description,
    siteName,
    byline,
    markdown: markdown || plainText,
    textLength: plainText.length,
  };
}

async function fetchYoutubeOEmbed(url: string) {
  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", "json");

  const response = await fetch(endpoint.toString(), {
    headers: {
      "user-agent":
        "OwnLab/0.1 (+https://ownlab.local; workspace-sources-youtube-import)",
      accept: "application/json",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error("VIDEO_FETCH_FAILED");
  }

  const payload = (await response.json()) as {
    title?: string;
    author_name?: string;
    author_url?: string;
    provider_name?: string;
    thumbnail_url?: string;
  };

  return {
    title: payload.title?.trim() || null,
    authorName: payload.author_name?.trim() || null,
    authorUrl: payload.author_url?.trim() || null,
    providerName: payload.provider_name?.trim() || null,
    thumbnailUrl: payload.thumbnail_url?.trim() || null,
  };
}

function buildVideoMarkdown(input: {
  title: string;
  url: string;
  authorName?: string | null;
  authorUrl?: string | null;
  providerName?: string | null;
  summary?: string | null;
  transcript?: string | null;
}) {
  const parts = [`# ${input.title.trim()}`];
  parts.push(`Video: [${input.url}](${input.url})`);
  if (input.providerName?.trim()) {
    parts.push(`Provider: ${input.providerName.trim()}`);
  }
  if (input.authorName?.trim()) {
    parts.push(
      input.authorUrl?.trim()
        ? `Channel: [${input.authorName.trim()}](${input.authorUrl.trim()})`
        : `Channel: ${input.authorName.trim()}`,
    );
  }
  if (input.summary?.trim()) {
    parts.push(input.summary.trim());
  }
  if (input.transcript?.trim()) {
    parts.push("## Transcript");
    parts.push(input.transcript.trim());
  }
  return `${parts.join("\n\n").trim()}\n`;
}

async function fetchYoutubeTranscript(url: string) {
  try {
    const fetchTranscript =
      "fetchTranscript" in YoutubeTranscriptModule &&
      typeof YoutubeTranscriptModule.fetchTranscript === "function"
        ? YoutubeTranscriptModule.fetchTranscript
        : "YoutubeTranscript" in YoutubeTranscriptModule &&
            YoutubeTranscriptModule.YoutubeTranscript &&
            typeof YoutubeTranscriptModule.YoutubeTranscript.fetchTranscript === "function"
          ? YoutubeTranscriptModule.YoutubeTranscript.fetchTranscript.bind(
              YoutubeTranscriptModule.YoutubeTranscript,
            )
          : null;

    if (!fetchTranscript) {
      throw new Error("VIDEO_TRANSCRIPT_MODULE_INVALID");
    }

    const transcript = await fetchTranscript(url);
    const text = transcript
      .map((segment: TranscriptSegment) => segment.text?.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/[ ]{2,}/g, " ")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

function normalizeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("INVALID_SOURCE_URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("INVALID_SOURCE_URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("INVALID_SOURCE_URL");
  }
  return parsed.toString();
}

function normalizeYoutubeUrl(value: string) {
  const normalized = normalizeHttpUrl(value);
  const parsed = new URL(normalized);
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname !== "youtube.com" &&
    hostname !== "www.youtube.com" &&
    hostname !== "m.youtube.com" &&
    hostname !== "youtu.be"
  ) {
    throw new Error("INVALID_VIDEO_URL");
  }
  return normalized;
}

async function readSourceFileContent(rootPath: string, relativeFilePath: string | null) {
  if (!relativeFilePath) {
    return null;
  }

  const absolutePath = path.join(rootPath, relativeFilePath);
  const info = await stat(absolutePath).catch(() => null);
  if (!info || !info.isFile()) {
    return null;
  }

  return readFile(absolutePath, "utf8");
}

function toWorkspaceSource(
  row: typeof workspaceSources.$inferSelect,
  fileContent: string | null,
): WorkspaceSource {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind as WorkspaceSource["kind"],
    type: row.type as WorkspaceSource["type"],
    title: row.title,
    status: row.status,
    summary: row.summary ?? null,
    content: fileContent,
    filePath: row.filePath ?? null,
    metadata: row.metadata ?? {},
    connectorType: row.connectorType ?? null,
    connectorRefId: row.connectorRefId ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createSourceService(db: Db) {
  async function getWorkspace(workspaceId: string) {
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

  async function getWorkspaceRootPath(workspaceId: string) {
    const workspace = await getWorkspace(workspaceId);
    if (!workspace.worktreePath?.trim()) {
      throw new Error("WORKSPACE_PATH_NOT_SET");
    }

    const rootPath = await validateWorkspaceRoot(workspace.worktreePath);
    return { workspace, rootPath };
  }

  async function listWorkspaceSources(workspaceId: string): Promise<WorkspaceSource[]> {
    const { rootPath } = await getWorkspaceRootPath(workspaceId);

    const rows = await db
      .select()
      .from(workspaceSources)
      .where(eq(workspaceSources.workspaceId, workspaceId))
      .orderBy(desc(workspaceSources.updatedAt), desc(workspaceSources.createdAt));

    return Promise.all(
      rows.map(async (row) =>
        toWorkspaceSource(row, await readSourceFileContent(rootPath, row.filePath ?? null)),
      ),
    );
  }

  async function getWorkspaceSource(workspaceId: string, sourceId: string): Promise<WorkspaceSource | null> {
    const { rootPath } = await getWorkspaceRootPath(workspaceId);

    const [row] = await db
      .select()
      .from(workspaceSources)
      .where(eq(workspaceSources.id, sourceId))
      .limit(1);

    if (!row || row.workspaceId !== workspaceId) {
      return null;
    }

    return toWorkspaceSource(row, await readSourceFileContent(rootPath, row.filePath ?? null));
  }

  async function createWorkspaceSource(
    workspaceId: string,
    input: CreateWorkspaceSourceInput,
  ): Promise<WorkspaceSource> {
    const { rootPath } = await getWorkspaceRootPath(workspaceId);
    const sourcesRoot = path.join(rootPath, "sources");
    await mkdir(sourcesRoot, { recursive: true });

    const now = new Date();
    let filePath: string | null = null;
    let fileContent: string | null = null;
    let metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };

    if (input.type === "webpage") {
      const rawUrl = typeof input.metadata?.url === "string" ? input.metadata.url : input.content?.trim() ?? "";
      const url = normalizeHttpUrl(rawUrl);
      const { finalUrl, html } = await fetchHtmlDocument(url);
      const extracted = extractWebpageMarkdown({ html, url: finalUrl });
      const resolvedTitle = extracted.title || resolveSourceTitle(input);

      const allocation = await allocateUniqueBasePath(rootPath, resolvedTitle, ".md");
      filePath = allocation.relativePath;
      fileContent = `${extracted.markdown.trim()}\n`;
      await mkdir(path.dirname(allocation.absolutePath), { recursive: true });
      await writeFile(allocation.absolutePath, fileContent, "utf8");
      metadata = {
        ...metadata,
        url: finalUrl,
        filePath,
        siteName: extracted.siteName,
        description: extracted.description ?? input.summary?.trim() ?? null,
        byline: extracted.byline,
        importedTitle: resolvedTitle,
        textLength: extracted.textLength,
      };
    } else if (input.type === "video") {
      const rawUrl = typeof input.metadata?.url === "string" ? input.metadata.url : input.content?.trim() ?? "";
      const url = normalizeYoutubeUrl(rawUrl);
      const videoInfo = await fetchYoutubeOEmbed(url);
      const transcript = await fetchYoutubeTranscript(url);
      const resolvedTitle = videoInfo.title || resolveSourceTitle(input);
      const allocation = await allocateUniqueBasePath(rootPath, resolvedTitle, ".md");
      filePath = allocation.relativePath;
      fileContent = buildVideoMarkdown({
        title: resolvedTitle,
        url,
        authorName: videoInfo.authorName,
        authorUrl: videoInfo.authorUrl,
        providerName: videoInfo.providerName ?? "YouTube",
        summary: input.summary,
        transcript: transcript ? truncateText(transcript, 24000) : "Transcript unavailable.",
      });
      await mkdir(path.dirname(allocation.absolutePath), { recursive: true });
      await writeFile(allocation.absolutePath, fileContent, "utf8");
      metadata = {
        ...metadata,
        url,
        provider: "youtube",
        filePath,
        importedTitle: resolvedTitle,
        authorName: videoInfo.authorName,
        authorUrl: videoInfo.authorUrl,
        thumbnailUrl: videoInfo.thumbnailUrl,
        transcriptAvailable: Boolean(transcript),
      };
    } else if (input.type === "image") {
      const fileName = typeof input.metadata?.fileName === "string" ? input.metadata.fileName.trim() : "";
      const mimeType = typeof input.metadata?.mimeType === "string" ? input.metadata.mimeType.trim() : "";
      const dataUrl = typeof input.metadata?.dataUrl === "string" ? input.metadata.dataUrl : "";
      const dataUrlMatch = dataUrl.match(/^data:(.+?);base64,(.+)$/);

      if (!fileName || !mimeType || !dataUrlMatch) {
        throw new Error("INVALID_IMAGE_SOURCE");
      }

      const resolvedTitle = resolveSourceTitle(input);
      const originalExtension = path.extname(fileName).toLowerCase();
      const extension = originalExtension || (mimeType === "image/png" ? ".png" : mimeType === "image/jpeg" ? ".jpg" : ".img");
      const imageAllocation = await allocateUniqueFilePath(rootPath, resolvedTitle, extension);
      const imageBuffer = Buffer.from(dataUrlMatch[2], "base64");
      await mkdir(path.dirname(imageAllocation.absolutePath), { recursive: true });
      await writeFile(imageAllocation.absolutePath, imageBuffer);

      const markdownAllocation = await allocateUniqueBasePath(rootPath, `${resolvedTitle}-image`, ".md");
      filePath = markdownAllocation.relativePath;
      fileContent = buildTextMarkdown({
        title: resolvedTitle,
        summary: input.summary,
        content: `Image file: \`${imageAllocation.relativePath}\``,
      });
      await mkdir(path.dirname(markdownAllocation.absolutePath), { recursive: true });
      await writeFile(markdownAllocation.absolutePath, fileContent, "utf8");

      metadata = {
        ...metadata,
        assetPath: imageAllocation.relativePath,
        fileName,
        mimeType,
        importedTitle: resolvedTitle,
      };
    }

    const [row] = await db
      .insert(workspaceSources)
      .values({
        workspaceId,
        kind: "native",
        type: input.type,
        title:
          (typeof metadata.importedTitle === "string" && metadata.importedTitle.trim()) ||
          resolveSourceTitle(input),
        status: "ready",
        summary: input.summary?.trim() || null,
        filePath,
        metadata,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return toWorkspaceSource(row, fileContent);
  }

  async function deleteWorkspaceSource(workspaceId: string, sourceId: string): Promise<boolean> {
    const { rootPath } = await getWorkspaceRootPath(workspaceId);
    const current = await getWorkspaceSource(workspaceId, sourceId);
    if (!current) {
      return false;
    }

    const assetPath =
      typeof current.metadata?.assetPath === "string" ? current.metadata.assetPath : null;
    if (assetPath) {
      await rm(path.join(rootPath, assetPath), { recursive: false, force: true }).catch(() => {});
    }
    if (current.filePath) {
      await rm(path.join(rootPath, current.filePath), { recursive: false, force: true }).catch(() => {});
    }

    await db.delete(workspaceSources).where(eq(workspaceSources.id, sourceId));
    return true;
  }

  return {
    listWorkspaceSources,
    getWorkspaceSource,
    createWorkspaceSource,
    deleteWorkspaceSource,
  };
}
