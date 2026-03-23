import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "@ownlab/db";
import type { AgentRuntimeSkills } from "@ownlab/shared";
import {
  agentSkills,
  agents,
  desc,
  eq,
  inArray,
  labs,
  skills,
} from "@ownlab/db";
import {
  resolveAgentClaudeContainerDir,
  resolveAgentCodexHomeDir,
  resolveManagedSkillsRootDir,
} from "../home-paths.js";
import { syncSkillLinks } from "./runtime-links.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
const BUILTIN_SKILL_ROOT_CANDIDATES = [
  path.resolve(__moduleDir, "../../../../skills"),
  path.resolve(process.cwd(), "skills"),
  path.resolve(__moduleDir, "../../../skills"),
];

type SkillCatalogEntry = {
  slug: string;
  name: string;
  description: string | null;
  sourceType: "builtin" | "community";
  localPath: string;
  adapterCompat: string[];
  metadata: Record<string, unknown>;
};

type MarketplaceManifest = {
  name?: string;
  owner?: {
    name?: string;
    email?: string;
  };
  metadata?: {
    description?: string;
    version?: string;
  };
  plugins?: Array<{
    name?: string;
    description?: string;
    source?: string;
    skills?: string[];
  }>;
};

export function createSkillService(db: Db) {
  async function listSkillsByIds(skillIds: string[]) {
    if (skillIds.length === 0) {
      return [];
    }
    return db.select().from(skills).where(inArray(skills.id, skillIds));
  }

  async function ensureDefaultLab() {
    let rows = await db.select().from(labs).limit(1);
    if (rows.length === 0) {
      rows = await db.insert(labs).values({ name: "Default Lab" }).returning();
    }
    return rows[0];
  }

  async function resolveBuiltinSkillRoot(): Promise<string | null> {
    for (const candidate of BUILTIN_SKILL_ROOT_CANDIDATES) {
      const isDir = await fs.stat(candidate).then((s) => s.isDirectory()).catch(() => false);
      if (isDir) return candidate;
    }
    return null;
  }

  async function resolveCommunitySkillRoot(): Promise<string> {
    const root = path.resolve(resolveManagedSkillsRootDir(), "community");
    await fs.mkdir(root, { recursive: true });
    return root;
  }

  async function listCatalogEntries(): Promise<SkillCatalogEntry[]> {
    const builtinRoot = await resolveBuiltinSkillRoot();
    const communityRoot = await resolveCommunitySkillRoot();
    const entries: SkillCatalogEntry[] = [];

    if (builtinRoot) {
      entries.push(...await scanSkillRoot(builtinRoot, "builtin"));
    }
    entries.push(...await scanSkillRoot(communityRoot, "community"));
    return entries;
  }

  async function syncCatalog() {
    const lab = await ensureDefaultLab();
    const entries = await listCatalogEntries();

    for (const entry of entries) {
      await db
        .insert(skills)
        .values({
          labId: lab.id,
          slug: entry.slug,
          name: entry.name,
          description: entry.description,
          sourceType: entry.sourceType,
          localPath: entry.localPath,
          adapterCompat: entry.adapterCompat,
          metadata: entry.metadata,
        })
        .onConflictDoUpdate({
          target: [skills.labId, skills.slug],
          set: {
            name: entry.name,
            description: entry.description,
            sourceType: entry.sourceType,
            localPath: entry.localPath,
            adapterCompat: entry.adapterCompat,
            metadata: entry.metadata,
            updatedAt: new Date(),
          },
        });
    }

    return db
      .select()
      .from(skills)
      .where(eq(skills.labId, lab.id))
      .orderBy(desc(skills.updatedAt));
  }

  async function listSkills() {
    try {
      return await syncCatalog();
    } catch {
      const lab = await ensureDefaultLab();
      const entries = await listCatalogEntries();
      return entries.map((entry) => ({
        id: entry.slug,
        labId: lab.id,
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        sourceType: entry.sourceType,
        localPath: entry.localPath,
        adapterCompat: entry.adapterCompat,
        metadata: entry.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }
  }

  async function getSkillDetail(skillIdOrSlug: string) {
    const catalog = await listSkills();
    const skill = catalog.find((row) => row.id === skillIdOrSlug || row.slug === skillIdOrSlug);
    if (!skill) {
      return null;
    }

    const content = await readSkillContent(skill.localPath);
    return {
      ...skill,
      content,
    };
  }

  async function importCommunitySkill(input: {
    sourcePath: string;
    slug?: string | null;
  }) {
    const sourcePath = path.resolve(input.sourcePath);
    const stat = await fs.stat(sourcePath).catch(() => null);
    if (!stat?.isDirectory()) {
      throw new Error("Skill source path must be a directory");
    }

    const sourceSkill = await readSkillEntry(sourcePath, "community", input.slug ?? null);
    if (!sourceSkill) {
      throw new Error("Skill source path must contain a SKILL.md file");
    }

    const communityRoot = await resolveCommunitySkillRoot();
    const targetDir = path.join(communityRoot, sourceSkill.slug);
    const targetExists = await fs.stat(targetDir).then(() => true).catch(() => false);
    if (!targetExists) {
      await fs.cp(sourcePath, targetDir, { recursive: true });
    }

    await syncCatalog();
    const rows = await db
      .select()
      .from(skills)
      .where(eq(skills.slug, sourceSkill.slug))
      .orderBy(desc(skills.updatedAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async function listAgentSkills(agentId: string) {
    try {
      await syncCatalog();
    } catch {
      return [];
    }
    const assignments = await db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.agentId, agentId))
      .orderBy(agentSkills.priority)
      .catch(() => []);

    if (assignments.length === 0) {
      return [];
    }

    const skillRows = await db
      .select()
      .from(skills)
      .where(inArray(skills.id, assignments.map((assignment) => assignment.skillId)));

    const byId = new Map(skillRows.map((row) => [row.id, row]));
    return assignments.flatMap((assignment) => {
      const skillRow = byId.get(assignment.skillId);
      if (!skillRow) return [];
      return [{
        ...assignment,
        skill: skillRow,
      }];
    });
  }

  async function setAgentSkills(input: {
    agentId: string;
    assignments: Array<{
      skillId: string;
      enabled?: boolean;
      priority?: number;
      config?: Record<string, unknown>;
    }>;
  }) {
    await syncCatalog();
    const [agent] = await db.select().from(agents).where(eq(agents.id, input.agentId)).limit(1);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const catalog = await db.select().from(skills);
    const skillsByIdentifier = new Map<string, (typeof catalog)[number]>();
    for (const row of catalog) {
      skillsByIdentifier.set(row.id, row);
      skillsByIdentifier.set(row.slug, row);
    }

    const resolvedAssignments = input.assignments.map((assignment) => {
      const skillRow = skillsByIdentifier.get(assignment.skillId);
      if (!skillRow) {
        throw new Error(`Skill not found: ${assignment.skillId}`);
      }
      return {
        ...assignment,
        skillId: skillRow.id,
      };
    });

    const existingAssignments = await db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.agentId, input.agentId));
    const requestedSkillIds = new Set(resolvedAssignments.map((assignment) => assignment.skillId));

    for (const existing of existingAssignments) {
      if (!requestedSkillIds.has(existing.skillId)) {
        await db.delete(agentSkills).where(eq(agentSkills.id, existing.id));
      }
    }

    for (const assignment of resolvedAssignments) {
      await db
        .insert(agentSkills)
        .values({
          agentId: input.agentId,
          skillId: assignment.skillId,
          enabled: assignment.enabled ?? true,
          priority: assignment.priority ?? 100,
          config: assignment.config ?? {},
        })
        .onConflictDoUpdate({
          target: [agentSkills.agentId, agentSkills.skillId],
          set: {
            enabled: assignment.enabled ?? true,
            priority: assignment.priority ?? 100,
            config: assignment.config ?? {},
            updatedAt: new Date(),
          },
        });
    }

    await syncAgentRuntimeSkills(input.agentId);
    return listAgentSkills(input.agentId);
  }

  async function syncAgentRuntimeSkills(agentId: string) {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const assignments = await listAgentSkills(agentId);
    const enabledSkills = assignments.filter((assignment) => assignment.enabled);
    const adapterType = agent.adapterType?.trim() ?? "";

    if (adapterType === "codex_local") {
      await syncSkillLinks(
        path.join(resolveAgentCodexHomeDir(agentId, agent.runtimeConfig), "skills"),
        enabledSkills
          .filter((assignment) => assignment.skill.adapterCompat.includes("codex_local"))
          .map((assignment) => ({
            slug: assignment.skill.slug,
            localPath: assignment.skill.localPath,
          })),
      );
    }

    if (adapterType === "claude_local") {
      await syncSkillLinks(
        path.join(resolveAgentClaudeContainerDir(agentId, agent.runtimeConfig), "skills"),
        enabledSkills
          .filter((assignment) => assignment.skill.adapterCompat.includes("claude_local"))
          .map((assignment) => ({
            slug: assignment.skill.slug,
            localPath: assignment.skill.localPath,
          })),
      );
    }
  }

  async function listEffectiveSkillsForChannelAgent(_channelId: string, agentId: string) {
    return {
      preference: null,
      mode: "inherit" as const,
      skills: (await listAgentSkills(agentId))
        .filter((assignment) => assignment.enabled)
        .map((assignment) => assignment.skill),
    };
  }

  async function listAgentRuntimeSkills(agentId: string): Promise<AgentRuntimeSkills> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const adapterType = agent.adapterType?.trim() ?? "";
    const rootPath =
      adapterType === "codex_local"
        ? path.join(resolveAgentCodexHomeDir(agentId, agent.runtimeConfig), "skills")
        : adapterType === "claude_local"
          ? path.join(resolveAgentClaudeContainerDir(agentId, agent.runtimeConfig), "skills")
          : null;

    if (!rootPath) {
      return {
        agentId,
        adapterType,
        rootPath: null,
        supported: false,
        entries: [],
      };
    }

    const dirEntries = await fs.readdir(rootPath, { withFileTypes: true }).catch(() => []);
    const entries = await Promise.all(
      dirEntries
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (entry) => {
          const fullPath = path.join(rootPath, entry.name);
          const linkTarget = entry.isSymbolicLink()
            ? await fs.readlink(fullPath).catch(() => null)
            : null;

          return {
            name: entry.name,
            path: fullPath,
            targetPath: linkTarget ? path.resolve(path.dirname(fullPath), linkTarget) : null,
            isSymlink: entry.isSymbolicLink(),
          };
        }),
    );
    const visibleEntries = entries.filter((entry) => !entry.name.startsWith("."));

    return {
      agentId,
      adapterType,
      rootPath,
      supported: true,
      entries: visibleEntries,
    };
  }

  return {
    listSkills,
    getSkillDetail,
    importCommunitySkill,
    listAgentSkills,
    setAgentSkills,
    syncAgentRuntimeSkills,
    listEffectiveSkillsForChannelAgent,
    listAgentRuntimeSkills,
  };
}

async function scanSkillRoot(rootDir: string, sourceType: "builtin" | "community"): Promise<SkillCatalogEntry[]> {
  const skillsFound: SkillCatalogEntry[] = [];
  const seen = new Set<string>();

  function pushSkill(skill: SkillCatalogEntry | null) {
    if (!skill || seen.has(skill.localPath)) {
      return;
    }
    skillsFound.push(skill);
    seen.add(skill.localPath);
  }

  async function walk(currentDir: string, depth: number) {
    if (depth > 4) return;

    const marketplaceEntries = await readMarketplaceSkillEntries(currentDir, sourceType);
    for (const entry of marketplaceEntries) {
      pushSkill(entry);
    }

    const skill = await readSkillEntry(currentDir, sourceType, null, {
      allowReadmeFallback: marketplaceEntries.length === 0,
    });
    if (skill) {
      pushSkill(skill);
    }

    const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;
      await walk(path.join(currentDir, entry.name), depth + 1);
    }
  }

  await walk(rootDir, 0);
  return skillsFound;
}

async function readSkillEntry(
  skillDir: string,
  sourceType: "builtin" | "community",
  forcedSlug?: string | null,
  options?: {
    allowReadmeFallback?: boolean;
    metadata?: Record<string, unknown>;
  },
): Promise<SkillCatalogEntry | null> {
  const skillFile = await resolveSkillContentPath(skillDir, options);
  if (!skillFile) return null;

  const raw = await fs.readFile(skillFile, "utf8");
  const frontmatter = parseFrontmatter(raw);
  const slug = sanitizeSlug(forcedSlug ?? path.basename(skillDir));

  return {
    slug,
    name: frontmatter.name ?? slug,
    description: frontmatter.description ?? null,
    sourceType,
    localPath: skillDir,
    adapterCompat: ["codex_local", "claude_local"],
    metadata: {
      category: inferSkillCategory(skillDir, sourceType),
      contentFile: path.basename(skillFile),
      hasReferences: await fs.stat(path.join(skillDir, "references")).then((s) => s.isDirectory()).catch(() => false),
      hasScripts: await fs.stat(path.join(skillDir, "scripts")).then((s) => s.isDirectory()).catch(() => false),
      hasAssets: await fs.stat(path.join(skillDir, "assets")).then((s) => s.isDirectory()).catch(() => false),
      ...options?.metadata,
    },
  };
}

async function resolveSkillContentPath(
  skillDir: string,
  options?: { allowReadmeFallback?: boolean },
): Promise<string | null> {
  const filenames = options?.allowReadmeFallback ? ["SKILL.md", "README.md"] : ["SKILL.md"];
  for (const filename of filenames) {
    const candidate = path.join(skillDir, filename);
    const exists = await fs.stat(candidate).then((s) => s.isFile()).catch(() => false);
    if (exists) return candidate;
  }
  return null;
}

async function readSkillContent(skillDir: string): Promise<string> {
  const contentPath = await resolveSkillContentPath(skillDir, { allowReadmeFallback: true });
  if (!contentPath) {
    return "";
  }
  return fs.readFile(contentPath, "utf8");
}

function parseFrontmatter(markdown: string): { name?: string; description?: string } {
  const match = /^---\s*\n([\s\S]*?)\n---/m.exec(markdown);
  if (!match) return {};

  const result: { name?: string; description?: string } = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (key === "name" && value) result.name = value;
    if (key === "description" && value) result.description = value;
  }
  return result;
}

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "skill";
}

function inferSkillCategory(
  skillDir: string,
  sourceType: "builtin" | "community",
): string {
  const normalized = skillDir.replace(/\\/g, "/").toLowerCase();

  if (normalized.includes("/work-skills/")) {
    return "Work";
  }

  if (normalized.includes("/scientific-skills/")) {
    return "Research";
  }

  return sourceType === "community" ? "Collection" : "Research";
}

async function readMarketplaceSkillEntries(
  rootDir: string,
  sourceType: "builtin" | "community",
): Promise<SkillCatalogEntry[]> {
  const manifestPath = path.join(rootDir, ".claude-plugin", "marketplace.json");
  const exists = await fs.stat(manifestPath).then((s) => s.isFile()).catch(() => false);
  if (!exists) {
    return [];
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as MarketplaceManifest;
  const entries: SkillCatalogEntry[] = [];

  for (const plugin of manifest.plugins ?? []) {
    for (const rawSkillPath of plugin.skills ?? []) {
      if (typeof rawSkillPath !== "string" || rawSkillPath.trim().length === 0) {
        continue;
      }

      const skillDir = path.resolve(rootDir, rawSkillPath);
      const entry = await readSkillEntry(skillDir, sourceType, null, {
        allowReadmeFallback: false,
        metadata: {
          category: inferMarketplaceCategory(manifest, plugin),
          collectionName: manifest.name ?? path.basename(rootDir),
          collectionDescription: manifest.metadata?.description ?? null,
          collectionVersion: manifest.metadata?.version ?? null,
          pluginName: plugin.name ?? null,
          pluginDescription: plugin.description ?? null,
          ownerName: manifest.owner?.name ?? null,
          ownerEmail: manifest.owner?.email ?? null,
        },
      });

      if (entry) {
        entries.push(entry);
      }
    }
  }

  return entries;
}

function inferMarketplaceCategory(
  manifest: MarketplaceManifest,
  plugin: NonNullable<MarketplaceManifest["plugins"]>[number],
): string {
  const combined = [
    manifest.name,
    manifest.metadata?.description,
    plugin.name,
    plugin.description,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (combined.includes("scientific") || combined.includes("research")) {
    return "Research";
  }

  return "Collection";
}
