import type { ServerAdapterModule } from "@ownlab/adapter-utils";
import {
  execute as codexExecute,
  testEnvironment as codexTestEnvironment,
  sessionCodec as codexSessionCodec,
} from "@ownlab/adapter-codex-local/server";
import {
  type as codexType,
  models as codexModels,
  agentConfigurationDoc as codexAgentConfigurationDoc,
} from "@ownlab/adapter-codex-local";
import {
  execute as cursorExecute,
  testEnvironment as cursorTestEnvironment,
  sessionCodec as cursorSessionCodec,
} from "@ownlab/adapter-cursor-local/server";
import {
  type as cursorType,
  models as cursorModels,
  agentConfigurationDoc as cursorAgentConfigurationDoc,
} from "@ownlab/adapter-cursor-local";
import {
  execute as geminiExecute,
  testEnvironment as geminiTestEnvironment,
  sessionCodec as geminiSessionCodec,
} from "@ownlab/adapter-gemini-local/server";
import {
  type as geminiType,
  models as geminiModels,
  agentConfigurationDoc as geminiAgentConfigurationDoc,
} from "@ownlab/adapter-gemini-local";
import {
  execute as openCodeExecute,
  testEnvironment as openCodeTestEnvironment,
  sessionCodec as openCodeSessionCodec,
  listOpenCodeModels,
} from "@ownlab/adapter-opencode-local/server";
import {
  type as openCodeType,
  agentConfigurationDoc as openCodeAgentConfigurationDoc,
} from "@ownlab/adapter-opencode-local";
import {
  execute as piExecute,
  testEnvironment as piTestEnvironment,
  sessionCodec as piSessionCodec,
  listPiModels,
} from "@ownlab/adapter-pi-local/server";
import {
  type as piType,
  agentConfigurationDoc as piAgentConfigurationDoc,
} from "@ownlab/adapter-pi-local";
import {
  execute as claudeExecute,
  sessionCodec as claudeSessionCodec,
  testEnvironment as claudeTestEnvironment,
} from "@ownlab/adapter-claude-local/server";
import {
  type as claudeType,
  models as claudeModels,
  agentConfigurationDoc as claudeAgentConfigurationDoc,
} from "@ownlab/adapter-claude-local";
import { processAdapter } from "./process/index.js";

const codexAdapter: ServerAdapterModule = {
  type: codexType,
  execute: codexExecute,
  testEnvironment: codexTestEnvironment,
  sessionCodec: codexSessionCodec,
  models: codexModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: codexAgentConfigurationDoc,
};

const claudeAdapter: ServerAdapterModule = {
  type: claudeType,
  execute: claudeExecute,
  testEnvironment: claudeTestEnvironment,
  sessionCodec: claudeSessionCodec,
  models: claudeModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: claudeAgentConfigurationDoc,
};

const cursorAdapter: ServerAdapterModule = {
  type: cursorType,
  execute: cursorExecute,
  testEnvironment: cursorTestEnvironment,
  sessionCodec: cursorSessionCodec,
  models: cursorModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: cursorAgentConfigurationDoc,
};

const geminiAdapter: ServerAdapterModule = {
  type: geminiType,
  execute: geminiExecute,
  testEnvironment: geminiTestEnvironment,
  sessionCodec: geminiSessionCodec,
  models: geminiModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: geminiAgentConfigurationDoc,
};

const openCodeAdapter: ServerAdapterModule = {
  type: openCodeType,
  execute: openCodeExecute,
  testEnvironment: openCodeTestEnvironment,
  sessionCodec: openCodeSessionCodec,
  models: [],
  listModels: listOpenCodeModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: openCodeAgentConfigurationDoc,
};

const piAdapter: ServerAdapterModule = {
  type: piType,
  execute: piExecute,
  testEnvironment: piTestEnvironment,
  sessionCodec: piSessionCodec,
  models: [],
  listModels: listPiModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: piAgentConfigurationDoc,
};

const registeredAdapters = [
  codexAdapter,
  claudeAdapter,
  cursorAdapter,
  geminiAdapter,
  openCodeAdapter,
  piAdapter,
  processAdapter,
] satisfies ServerAdapterModule[];

const adaptersByType = new Map<string, ServerAdapterModule>(
  registeredAdapters.map((adapter) => [adapter.type, adapter]),
);
adaptersByType.set("process_local", processAdapter);

export function getServerAdapter(type: string): ServerAdapterModule | null {
  return adaptersByType.get(type) ?? null;
}

export function findServerAdapter(type: string): ServerAdapterModule | null {
  return adaptersByType.get(type) ?? null;
}

export async function listAdapterModels(type: string) {
  const adapter = adaptersByType.get(type);
  if (!adapter) return [];
  if (typeof adapter.listModels === "function") {
    const discovered = await adapter.listModels();
    if (discovered.length > 0) return discovered;
  }
  return adapter.models ?? [];
}

export function listServerAdapters(): ServerAdapterModule[] {
  return [...registeredAdapters];
}

export const LOCAL_ADAPTER_TYPES = new Set([
  "codex_local",
  "claude_local",
  "cursor",
  "gemini_local",
  "opencode_local",
  "pi_local",
  "process",
  "process_local",
]);

export function isLocalAdapter(adapterType: string): boolean {
  return LOCAL_ADAPTER_TYPES.has(adapterType);
}
