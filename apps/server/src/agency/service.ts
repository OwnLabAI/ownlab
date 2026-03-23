import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const AGENCY_TEMPLATES_ROOT_CANDIDATES = [
  path.resolve(__moduleDir, "../../../../mart/agency"),
  path.resolve(__moduleDir, "../../../mart/agency"),
  path.resolve(process.cwd(), "mart/agency"),
];

const EXCLUDED_DIRS = new Set([".git", ".github", "scripts", "examples", "integrations", "strategy"]);

const DEPARTMENT_BY_CATEGORY: Record<string, string> = {
  engineering: "Engineering",
  design: "Design",
  marketing: "Marketing",
  "paid-media": "Marketing",
  sales: "Sales",
  support: "Support",
  product: "Research",
  testing: "Data",
  "project-management": "Operations",
};

export interface AgencyTemplateSummary {
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  vibe: string | null;
  category: string;
  department: string;
  path: string;
}

export interface AgencyTemplateDetail extends AgencyTemplateSummary {
  content: string;
}

type ParsedFrontmatter = {
  attributes: Record<string, string>;
  body: string;
};

function parseFrontmatter(markdown: string): ParsedFrontmatter {
  if (!markdown.startsWith("---\n")) {
    return { attributes: {}, body: markdown };
  }

  const end = markdown.indexOf("\n---\n", 4);
  if (end === -1) {
    return { attributes: {}, body: markdown };
  }

  const raw = markdown.slice(4, end);
  const body = markdown.slice(end + 5).trim();
  const attributes: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) {
      attributes[key] = value;
    }
  }

  return { attributes, body };
}

function titleFromMarkdown(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function humanizeSlug(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function readTemplateFromFile(filePath: string): Promise<AgencyTemplateDetail> {
  const markdown = await fs.readFile(filePath, "utf8");
  const { attributes, body } = parseFrontmatter(markdown);
  const category = path.basename(path.dirname(filePath));
  const slug = path.basename(filePath, ".md");
  const name =
    attributes.name?.trim() ||
    titleFromMarkdown(body) ||
    humanizeSlug(slug);

  return {
    slug,
    name,
    description: attributes.description?.trim() || null,
    emoji: attributes.emoji?.trim() || null,
    color: attributes.color?.trim() || null,
    vibe: attributes.vibe?.trim() || null,
    category,
    department: DEPARTMENT_BY_CATEGORY[category] ?? "Other",
    path: filePath,
    content: markdown,
  };
}

async function listCandidateFiles(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const childEntries = await fs.readdir(entryPath, { withFileTypes: true });
      for (const child of childEntries) {
        if (!child.isFile() || !child.name.endsWith(".md")) continue;
        files.push(path.join(entryPath, child.name));
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function resolveAgencyTemplatesRoot(): Promise<string> {
  for (const candidate of AGENCY_TEMPLATES_ROOT_CANDIDATES) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) {
        return candidate;
      }
    } catch {
      /* continue to next candidate */
    }
  }

  throw new Error(
    `Agency templates directory not found. Checked: ${AGENCY_TEMPLATES_ROOT_CANDIDATES.join(", ")}`,
  );
}

export function createAgencyTemplateService() {
  async function listTemplates(): Promise<AgencyTemplateSummary[]> {
    const rootDir = await resolveAgencyTemplatesRoot();
    const files = await listCandidateFiles(rootDir);
    const templates = await Promise.all(files.map((filePath) => readTemplateFromFile(filePath)));

    return templates.map(({ content: _content, ...summary }) => summary);
  }

  async function getTemplateBySlug(slug: string): Promise<AgencyTemplateDetail | null> {
    const rootDir = await resolveAgencyTemplatesRoot();
    const files = await listCandidateFiles(rootDir);
    const match = files.find((filePath) => path.basename(filePath, ".md") === slug);
    if (!match) return null;
    return readTemplateFromFile(match);
  }

  return {
    listTemplates,
    getTemplateBySlug,
  };
}
