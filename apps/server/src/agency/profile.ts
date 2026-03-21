import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { agents } from "@ownlab/db";
import { resolveAgentRuntimeHomeDir } from "../home-paths.js";

type RuntimeRecord = Record<string, unknown>;

export interface AgencyTemplateConfig {
  slug?: string;
  name?: string;
  department?: string;
  path?: string;
}

export interface AgencyProfileMaterialization {
  rootDir: string;
  manifestPath: string;
  sourcePath: string;
  customPath: string;
  agencyFilePath: string;
  template: AgencyTemplateConfig | null;
  sourceHash: string;
  customHash: string;
}

function asRecord(value: unknown): RuntimeRecord | null {
  return typeof value === "object" && value !== null ? (value as RuntimeRecord) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readAgentAgencyConfig(agent: typeof agents.$inferSelect): {
  template: AgencyTemplateConfig | null;
  agencyInstructions: string;
  customAgencyInstructions: string;
} {
  const runtimeConfig = asRecord(agent.runtimeConfig) ?? {};
  const templateRecord = asRecord(runtimeConfig.agencyTemplate);

  return {
    template: templateRecord
      ? {
          slug: asString(templateRecord.slug) || undefined,
          name: asString(templateRecord.name) || undefined,
          department: asString(templateRecord.department) || undefined,
          path: asString(templateRecord.path) || undefined,
        }
      : null,
    agencyInstructions: asString(runtimeConfig.agencyInstructions),
    customAgencyInstructions: asString(runtimeConfig.customAgencyInstructions),
  };
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function buildAgencyFileContents(input: {
  agentName: string;
  template: AgencyTemplateConfig | null;
  agencyInstructions: string;
  customAgencyInstructions: string;
}): string {
  const lines: string[] = [];
  lines.push(`# Agency Profile for ${input.agentName}`);
  lines.push("");
  lines.push("This file is managed by OwnLab. Treat it as the source of truth for your role and operating style.");
  lines.push("");

  if (input.template) {
    lines.push("## Template");
    if (input.template.name) lines.push(`- Name: ${input.template.name}`);
    if (input.template.department) lines.push(`- Department: ${input.template.department}`);
    if (input.template.slug) lines.push(`- Slug: ${input.template.slug}`);
    if (input.template.path) lines.push(`- Source: ${input.template.path}`);
    lines.push("");
  }

  if (input.agencyInstructions) {
    lines.push("## Source Instructions");
    lines.push("");
    lines.push(input.agencyInstructions);
    lines.push("");
  }

  if (input.customAgencyInstructions) {
    lines.push("## Custom Instructions");
    lines.push("");
    lines.push(input.customAgencyInstructions);
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

export async function ensureAgencyProfileMaterialized(
  agent: typeof agents.$inferSelect,
): Promise<AgencyProfileMaterialization | null> {
  const config = readAgentAgencyConfig(agent);
  if (!config.agencyInstructions && !config.customAgencyInstructions && !config.template) {
    return null;
  }

  const agentHome = resolveAgentRuntimeHomeDir(agent.id, agent.runtimeConfig);
  const rootDir = path.join(agentHome, "agency");
  const manifestPath = path.join(rootDir, "manifest.json");
  const sourcePath = path.join(rootDir, "source.md");
  const customPath = path.join(rootDir, "custom.md");
  const agencyFilePath = path.join(rootDir, "AGENCY.md");

  await fs.mkdir(rootDir, { recursive: true });

  const sourceContents = config.agencyInstructions ? `${config.agencyInstructions}\n` : "";
  const customContents = config.customAgencyInstructions ? `${config.customAgencyInstructions}\n` : "";
  const agencyContents = buildAgencyFileContents({
    agentName: agent.name,
    template: config.template,
    agencyInstructions: config.agencyInstructions,
    customAgencyInstructions: config.customAgencyInstructions,
  });

  await writeIfChanged(sourcePath, sourceContents);
  await writeIfChanged(customPath, customContents);
  await writeIfChanged(agencyFilePath, agencyContents);

  const sourceHash = sha256(sourceContents);
  const customHash = sha256(customContents);

  const manifest = {
    agentId: agent.id,
    agentName: agent.name,
    updatedAt: new Date().toISOString(),
    template: config.template,
    files: {
      sourcePath,
      customPath,
      agencyFilePath,
    },
    hashes: {
      sourceHash,
      customHash,
      agencyFileHash: sha256(agencyContents),
    },
  };

  await writeIfChanged(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    rootDir,
    manifestPath,
    sourcePath,
    customPath,
    agencyFilePath,
    template: config.template,
    sourceHash,
    customHash,
  };
}

async function writeIfChanged(filePath: string, nextContents: string) {
  try {
    const currentContents = await fs.readFile(filePath, "utf8");
    if (currentContents === nextContents) {
      return;
    }
  } catch (error) {
    if (!(error instanceof Error) || "code" in error === false || error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.writeFile(filePath, nextContents, "utf8");
}

export function buildAgencyPromptNote(profile: AgencyProfileMaterialization | null): string[] {
  if (!profile) return [];

  const lines: string[] = [];
  lines.push("ACTIVE AGENCY PROFILE:");
  if (profile.template?.name) {
    const summary = [profile.template.name, profile.template.department].filter(Boolean).join(" · ");
    lines.push(summary);
  }
  lines.push(`Read and follow: ${profile.agencyFilePath}`);
  lines.push(`Manifest: ${profile.manifestPath}`);
  lines.push("Treat the agency file as your persistent role definition before responding.");
  return lines;
}
