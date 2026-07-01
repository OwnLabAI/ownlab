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
  offset?: number;
  duration?: number;
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

function collapseWhitespace(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function getMetaContent(document: Document, selectors: string[]) {
  for (const selector of selectors) {
    const value = collapseWhitespace(document.querySelector(selector)?.getAttribute("content"));
    if (value) {
      return value;
    }
  }

  return null;
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\`*_[\]{}()#+\-.!|>])/g, "\\$1");
}

function stripLeadingHeading(markdown: string, title: string) {
  const normalizedTitle = title.trim().toLowerCase();
  const lines = markdown.trim().split(/\r?\n/);
  const firstLine = lines[0]?.trim() ?? "";
  const firstHeading = firstLine.replace(/^#+\s*/, "").trim().toLowerCase();

  if (firstHeading && firstHeading === normalizedTitle) {
    return lines.slice(1).join("\n").trim();
  }

  return markdown.trim();
}

function sanitizeDocumentTitle(input: {
  title: string | null;
  siteName?: string | null;
}) {
  const title = collapseWhitespace(input.title);
  if (!title) {
    return null;
  }

  const siteName = collapseWhitespace(input.siteName)?.toLowerCase() ?? null;
  const separators = [" | ", " - ", " — ", " – ", " · ", " —"];
  for (const separator of separators) {
    if (!title.includes(separator)) {
      continue;
    }

    const parts = title
      .split(separator)
      .map((part) => collapseWhitespace(part))
      .filter((part): part is string => Boolean(part));

    if (parts.length < 2) {
      continue;
    }

    if (siteName) {
      const filtered = parts.filter((part) => part.toLowerCase() !== siteName);
      if (filtered.length > 0 && filtered.length < parts.length) {
        return filtered[0] ?? title;
      }
    }

    return parts[0] ?? title;
  }

  return title;
}

function buildWebpageMarkdown(input: {
  title: string;
  url: string;
  siteName?: string | null;
  byline?: string | null;
  description?: string | null;
  markdown: string;
}) {
  const parts = [`# ${input.title.trim()}`, `[Open original webpage](${input.url.trim()})`];

  if (input.siteName?.trim()) {
    parts.push(`Site: ${escapeMarkdownText(input.siteName.trim())}`);
  }

  if (input.byline?.trim()) {
    parts.push(`Byline: ${escapeMarkdownText(input.byline.trim())}`);
  }

  if (input.description?.trim()) {
    parts.push(input.description.trim());
  }

  if (input.markdown.trim()) {
    parts.push(stripLeadingHeading(input.markdown, input.title));
  }

  return `${parts.join("\n\n").trim()}\n`;
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
  const document = dom.window.document;
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const siteName =
    getMetaContent(document, [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="apple-mobile-web-app-title"]',
    ]) ||
    collapseWhitespace(article?.siteName) ||
    null;
  const openGraphTitle = getMetaContent(document, [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]',
  ]);
  const documentTitle = sanitizeDocumentTitle({
    title: collapseWhitespace(document.title),
    siteName,
  });
  const readabilityTitle = sanitizeDocumentTitle({
    title: collapseWhitespace(article?.title),
    siteName,
  });
  const title =
    openGraphTitle ||
    documentTitle ||
    readabilityTitle ||
    "Untitled Page";
  const description =
    getMetaContent(document, [
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ]) ||
    collapseWhitespace(article?.excerpt) ||
    null;
  const byline = collapseWhitespace(article?.byline) || null;
  const contentHtml = article?.content?.trim() || document.body?.innerHTML || "";
  const markdown = htmlToMarkdown(contentHtml);
  const plainText = collapseWhitespace(article?.textContent) || collapseWhitespace(document.body?.textContent) || "";

  if (!markdown && !plainText) {
    throw new Error("WEBPAGE_EXTRACTION_EMPTY");
  }

  return {
    title,
    description,
    siteName,
    byline,
    markdown: buildWebpageMarkdown({
      title,
      url: input.url,
      siteName,
      byline,
      description,
      markdown: markdown || plainText,
    }),
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

function getVideoTranscriptFormatVersion(metadata: Record<string, unknown>) {
  return typeof metadata.sourceFormat === "string" ? metadata.sourceFormat : null;
}

function formatTranscriptTimestamp(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function normalizeTranscriptOffset(offset: number) {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  // youtube-transcript offsets are often milliseconds.
  if (offset > 12 * 60 * 60) {
    return offset / 1000;
  }

  return offset;
}

function formatTranscriptSegments(segments: TranscriptSegment[]) {
  const paragraphs: string[] = [];
  let currentStart: number | null = null;
  let currentTextParts: string[] = [];

  function flushParagraph() {
    if (currentTextParts.length === 0) {
      return;
    }

    const paragraphText = currentTextParts.join(" ").replace(/\s+/g, " ").trim();
    if (!paragraphText) {
      currentTextParts = [];
      currentStart = null;
      return;
    }

    const timestamp = currentStart !== null ? formatTranscriptTimestamp(currentStart) : null;
    paragraphs.push(timestamp ? `[${timestamp}] ${paragraphText}` : paragraphText);
    currentTextParts = [];
    currentStart = null;
  }

  for (const segment of segments) {
    const text = collapseWhitespace(segment.text);
    if (!text) {
      continue;
    }

    const offset =
      typeof segment.offset === "number" && Number.isFinite(segment.offset)
        ? normalizeTranscriptOffset(segment.offset)
        : null;

    if (currentStart === null) {
      currentStart = offset ?? 0;
    }

    currentTextParts.push(text);

    const hasSentenceBoundary = /[.!?]["']?$/.test(text);
    const shouldSplitForTime =
      offset !== null && currentStart !== null && offset - currentStart >= 30;

    if (hasSentenceBoundary || shouldSplitForTime) {
      flushParagraph();
    }
  }

  flushParagraph();

  return paragraphs.join("\n\n").trim();
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

    const transcript = (await fetchTranscript(url)) as TranscriptSegment[];
    const text = formatTranscriptSegments(transcript);
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

async function writeSourceFileContent(rootPath: string, relativeFilePath: string, content: string) {
  const absolutePath = path.join(rootPath, relativeFilePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

function toWorkspaceSource(
  row: typeof workspaceSources.$inferSelect,
  fileContent: string | null,
): WorkspaceSource {
  const metadataDescription =
    typeof row.metadata?.description === "string" && row.metadata.description.trim()
      ? row.metadata.description.trim()
      : null;

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind as WorkspaceSource["kind"],
    type: row.type as WorkspaceSource["type"],
    title: row.title,
    status: row.status,
    summary: row.summary ?? metadataDescription ?? null,
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

  async function maybeRefreshVideoSourceContent(
    rootPath: string,
    row: typeof workspaceSources.$inferSelect,
  ) {
    if (
      row.type !== "video" ||
      !row.filePath ||
      typeof row.metadata?.url !== "string" ||
      row.metadata.url.trim().length === 0
    ) {
      return row;
    }

    const metadata = row.metadata ?? {};
    const videoUrl = typeof metadata.url === "string" ? metadata.url : "";
    const currentFormat = getVideoTranscriptFormatVersion(metadata);
    if (currentFormat === "video_markdown_v3") {
      return row;
    }

    const transcript = await fetchYoutubeTranscript(videoUrl);
    const refreshedContent = buildVideoMarkdown({
      title: row.title,
      url: videoUrl,
      authorName: typeof metadata.authorName === "string" ? metadata.authorName : null,
      authorUrl: typeof metadata.authorUrl === "string" ? metadata.authorUrl : null,
      providerName: "YouTube",
      summary: row.summary,
      transcript: transcript || "Transcript unavailable.",
    });

    await writeSourceFileContent(rootPath, row.filePath, refreshedContent);

    const nextMetadata = {
      ...metadata,
      sourceFormat: "video_markdown_v3",
      transcriptAvailable: Boolean(transcript),
      transcriptLength: transcript?.length ?? 0,
    };

    const [updatedRow] = await db
      .update(workspaceSources)
      .set({
        metadata: nextMetadata,
        updatedAt: new Date(),
      })
      .where(eq(workspaceSources.id, row.id))
      .returning();

    return updatedRow ?? row;
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

    const [rawRow] = await db
      .select()
      .from(workspaceSources)
      .where(eq(workspaceSources.id, sourceId))
      .limit(1);

    if (!rawRow || rawRow.workspaceId !== workspaceId) {
      return null;
    }

    const row = await maybeRefreshVideoSourceContent(rootPath, rawRow);

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
      const resolvedSummary =
        extracted.description ||
        input.summary?.trim() ||
        null;

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
        description: resolvedSummary,
        byline: extracted.byline,
        importedTitle: resolvedTitle,
        textLength: extracted.textLength,
        sourceFormat: "webpage_markdown_v2",
      };
      input = {
        ...input,
        summary: resolvedSummary,
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
        transcript: transcript || "Transcript unavailable.",
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
        transcriptLength: transcript?.length ?? 0,
        sourceFormat: "video_markdown_v3",
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
        summary:
          input.summary?.trim() ||
          (typeof metadata.description === "string" && metadata.description.trim()) ||
          null,
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
