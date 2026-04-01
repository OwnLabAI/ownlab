import { randomUUID } from "node:crypto";
import type { Db } from "@ownlab/db";
import {
  agents,
  channelMessages,
  eq,
} from "@ownlab/db";
import type {
  AdapterAgent,
  AdapterRuntime,
  AdapterExecutionResult,
} from "@ownlab/adapter-utils";
import type { ChannelAttachment, ChannelDisplayMessage } from "@ownlab/shared";
import { parseClaudeStreamJson } from "@ownlab/adapter-claude-local/server";
import { parseCodexJsonl } from "@ownlab/adapter-codex-local/server";
import { parseCursorJsonl } from "@ownlab/adapter-cursor-local/server";
import { parseGeminiJsonl } from "@ownlab/adapter-gemini-local/server";
import { parseOpenCodeJsonl } from "@ownlab/adapter-opencode-local/server";
import { parsePiJsonl } from "@ownlab/adapter-pi-local/server";
import { getServerAdapter } from "../adapters/registry.js";
import { resolveAgentExecutionRuntimeContext } from "../agents/runtime-context.js";
import {
  buildAgencyPromptNote,
  ensureAgencyProfileMaterialized,
  type AgencyProfileMaterialization,
} from "../agency/profile.js";
import { createPluginService } from "../plugins/service.js";
import { createSkillService } from "../skills/service.js";
import { createAttachmentProcessingService } from "./attachment-processing-service.js";
import { createChannelMessageService } from "./message-service.js";
import { createConversationSessionService } from "./session-service.js";
import {
  clearChannelRunInterrupted,
  isChannelRunInterrupted,
  registerChannelRun,
  unregisterChannelRun,
} from "./run-control-service.js";
import { createChannelService } from "./service.js";

type StoredChannelMessage = typeof channelMessages.$inferSelect;
type ChatMessage = {
  actorType: string;
  actorName: string;
  content: string;
};

export interface ChannelDeliveryCallbacks {
  onAssistantMessageStart?: (message: ChannelDisplayMessage) => Promise<void> | void;
  onAssistantMessageContent?: (messageId: string, content: string) => Promise<void> | void;
  onAssistantMessageComplete?: (
    temporaryMessageId: string,
    message: ChannelDisplayMessage,
    execution: AdapterExecutionResult,
  ) => Promise<void> | void;
  onStatus?: (message: string) => Promise<void> | void;
}

export interface ExecuteAgentDeliveriesInput {
  channel: {
    id: string;
    workspaceId: string;
  };
  channelMembers: Array<{
    actorId: string;
    actorType: string;
    name?: string | null;
    icon?: string | null;
    status?: string | null;
    role?: string | null;
  }>;
  participantMembers: Array<{
    actorId: string;
    actorType: string;
    name?: string | null;
    icon?: string | null;
    status?: string | null;
    runtimeState?: Record<string, unknown> | null;
    runtimeUpdatedAt?: Date | null;
  }>;
  conversationSession?: {
    id: string;
    runtimeSessionId: string | null;
    runtimeSessionParams: Record<string, unknown> | null;
    runtimeSessionDisplayId: string | null;
    transcriptPath: string | null;
    transcriptStatus: "pending" | "active" | "archived" | "missing";
    title: string | null;
  } | null;
  history: StoredChannelMessage[];
}

function buildPromptFromMessages(
  agent: typeof agents.$inferSelect,
  messages: ChatMessage[],
  agencyProfile: AgencyProfileMaterialization | null,
  channelMembers: ExecuteAgentDeliveriesInput["channelMembers"],
  activeSkillNames: string[],
  workspaceContextEntries: Array<{
    pluginName: string;
    title: string;
    citationText: string;
    abstract: string;
    tags: string[];
    zoteroUrl: string | null;
  }>,
): string {
  const lines: string[] = [];

  lines.push(`You are ${agent.name}, an AI agent collaborating inside a shared Ownlab channel.`);
  lines.push("Stay consistent with your configured role, tone, and responsibilities.");
  lines.push("You are one participant among humans and other agents, not a single all-knowing assistant.");
  lines.push("Treat any agency profile or manifest setup as internal context. Do not mention loading, reading, or checking those files unless the human explicitly asks.");
  lines.push(`Configured role: ${agent.role || "general"}`);
  lines.push("");

  const agencyLines = buildAgencyPromptNote(agencyProfile);
  if (agencyLines.length > 0) {
    lines.push(...agencyLines);
    lines.push("");
  }

  if (channelMembers.length > 0) {
    lines.push("Current channel roster:");
    for (const member of channelMembers) {
      const typeLabel = member.actorType === "agent" ? "Agent" : "Human";
      const name = member.name?.trim() || member.actorId;
      const extras = [member.role, member.status].filter(Boolean).join(", ");
      lines.push(`- ${typeLabel}: ${name}${extras ? ` (${extras})` : ""}`);
    }
    lines.push("");
  }

  if (activeSkillNames.length > 0) {
    lines.push(`Active skills: ${activeSkillNames.join(", ")}`);
    lines.push("");
  }

  if (workspaceContextEntries.length > 0) {
    lines.push("Workspace source context:");
    for (const entry of workspaceContextEntries) {
      lines.push(`- [${entry.pluginName}] ${entry.title}`);
      lines.push(`  Citation: ${entry.citationText}`);
      if (entry.abstract) {
        lines.push(`  Abstract: ${entry.abstract}`);
      }
      if (entry.tags.length > 0) {
        lines.push(`  Tags: ${entry.tags.join(", ")}`);
      }
      if (entry.zoteroUrl) {
        lines.push(`  URL: ${entry.zoteroUrl}`);
      }
    }
    lines.push("");
  }

  for (const message of messages) {
    const typeLabel = message.actorType === "agent" ? "AGENT" : "HUMAN";
    lines.push(`${typeLabel} ${message.actorName}:`);
    lines.push(message.content);
    lines.push("");
  }

  lines.push(`AGENT ${agent.name}:`);

  return lines.join("\n");
}

function getMessageAttachments(
  row: Pick<StoredChannelMessage, "metadata">,
): ChannelAttachment[] {
  const rawAttachments = row.metadata?.attachments;
  if (!Array.isArray(rawAttachments)) {
    return [];
  }

  return rawAttachments.flatMap((attachment) => {
    if (!attachment || typeof attachment !== "object" || attachment.type !== "file") {
      return [];
    }

    return [{
      type: "file" as const,
      filename: typeof attachment.filename === "string" ? attachment.filename : undefined,
      mediaType: typeof attachment.mediaType === "string" ? attachment.mediaType : undefined,
      url: typeof attachment.url === "string" ? attachment.url : undefined,
      textContent: typeof attachment.textContent === "string" ? attachment.textContent : null,
      textExtractionKind:
        typeof attachment.textExtractionKind === "string"
          ? attachment.textExtractionKind
          : null,
    }];
  });
}

function buildMessageContentWithAttachments(content: string, attachments: ChannelAttachment[]) {
  if (attachments.length === 0) {
    return content;
  }

  const attachmentProcessingService = createAttachmentProcessingService();
  const promptAttachments = attachmentProcessingService.buildPromptContents(attachments);
  const attachmentLines = promptAttachments.map((attachment) => `- ${attachment.label}`);
  const attachmentBodies = promptAttachments
    .filter((attachment) => attachment.body)
    .map((attachment) => `--- BEGIN ATTACHMENT: ${attachment.label} ---\n${attachment.body}\n--- END ATTACHMENT: ${attachment.label} ---`);

  const sections = [`${content}\n\nAttachments:\n${attachmentLines.join("\n")}`.trimEnd()];
  if (attachmentBodies.length > 0) {
    sections.push(attachmentBodies.join("\n\n"));
  }
  return sections.join("\n\n").trim();
}

function sanitizeUserVisibleAssistantContent(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => !isInternalAgencyNarration(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isInternalAgencyNarration(line: string): boolean {
  const normalized = line.trim();
  if (!normalized) {
    return false;
  }

  return (
    /(agency profile and manifest).*(correct role and channel style|before responding)/i.test(normalized) ||
    /^(?:i(?:'|’)m|i am)\s+(?:loading|reading|checking)\s+the agency (?:profile|file|manifest)/i.test(normalized)
  );
}

function mapChannelMessagesToChatMessages(
  rows: ChannelDisplayMessage[],
): ChatMessage[] {
  return rows.map((row) => ({
    actorType: row.actorType,
    actorName: row.actorName ?? row.actorId,
    content: buildMessageContentWithAttachments(row.content, getMessageAttachments(row)),
  }));
}

function getPreviewContent(adapterType: string, stdout: string): string {
  if (!stdout.trim()) {
    return "";
  }

  switch (adapterType) {
    case "claude_local":
      return parseClaudeStreamJson(stdout).summary ?? "";
    case "codex_local":
      return parseCodexJsonl(stdout).summary ?? "";
    case "cursor":
      return parseCursorJsonl(stdout).summary ?? "";
    case "gemini_local":
      return parseGeminiJsonl(stdout).summary ?? "";
    case "opencode_local":
      return parseOpenCodeJsonl(stdout).summary ?? "";
    case "pi_local": {
      const parsed = parsePiJsonl(stdout);
      return parsed.finalMessage ?? parsed.messages.join("\n\n");
    }
    default:
      return "";
  }
}

function normalizeStatusLines(chunk: string): string[] {
  return chunk
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-5);
}

// Only explicitly approved user-facing progress text may leave the server as
// a status event. Internal adapter/runtime diagnostics must stay in logs.
const USER_VISIBLE_OWNLAB_STATUS_PATTERNS: RegExp[] = [];

function getUserVisibleStatusLine(line: string): string | null {
  const normalized = line.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("[ownlab]")) {
    const message = normalized.replace(/^\[ownlab\]\s*/, "");
    return USER_VISIBLE_OWNLAB_STATUS_PATTERNS.some((pattern) => pattern.test(message))
      ? message
      : null;
  }

  return null;
}

function createTemporaryAssistantMessage(input: {
  id: string;
  channelId: string;
  actorId: string;
  actorName: string | null;
  actorIcon: string | null;
}): ChannelDisplayMessage {
  return {
    id: input.id,
    channelId: input.channelId,
    actorId: input.actorId,
    actorType: "agent",
    content: "",
    metadata: {
      actorName: input.actorName,
      actorIcon: input.actorIcon,
    },
    mentions: [],
    actorName: input.actorName ?? "Agent",
    actorIcon: input.actorIcon,
    attachments: [],
    createdAt: new Date().toISOString(),
  };
}

export function createChannelDeliveryService(db: Db) {
  const messageService = createChannelMessageService(db);
  const channelService = createChannelService(db);
  const pluginService = createPluginService(db);
  const skillService = createSkillService(db);
  const conversationSessionService = createConversationSessionService(db);

  async function executeAgentDeliveries(
    input: ExecuteAgentDeliveriesInput,
    callbacks?: ChannelDeliveryCallbacks,
  ) {
    const assistantMessages: StoredChannelMessage[] = [];
    const executions: AdapterExecutionResult[] = [];
    const history = [...input.history];

    for (const participant of input.participantMembers) {
      const participantId = participant.actorId;
      const agentRows = await db
        .select()
        .from(agents)
        .where(eq(agents.id, participantId))
        .limit(1);

      if (agentRows.length === 0) {
        continue;
      }

      const agent = agentRows[0];
      if (!agent.adapterType) {
        continue;
      }

      const adapter = getServerAdapter(agent.adapterType);
      if (!adapter) {
        continue;
      }

      const conversationSession = input.conversationSession ?? null;
      const runtimeState = asRecord(participant.runtimeState);
      const useConversationRuntime = Boolean(conversationSession?.id);
      const rawRuntimeParams = useConversationRuntime
        ? conversationSession?.runtimeSessionParams ?? null
        : conversationSession?.runtimeSessionParams ?? runtimeState?.sessionParams ?? null;
      const restoredSessionParams = adapter.sessionCodec?.deserialize(
        rawRuntimeParams,
      ) ?? asRecord(rawRuntimeParams);

      const agencyProfile = await ensureAgencyProfileMaterialized(agent);
      const runtimeWorkspace = await resolveAgentExecutionRuntimeContext(
        db,
        agent,
        input.channel.workspaceId,
        input.channel.id,
      );
      const effectiveSkills = await skillService.listEffectiveSkillsForChannelAgent(
        input.channel.id,
        agent.id,
      );
      const workspaceContextEntries = await pluginService.listWorkspaceContextEntries(
        input.channel.workspaceId,
      );
      const hydratedHistory = await messageService.hydrateMessages(history);
      const prompt = buildPromptFromMessages(
        agent,
        mapChannelMessagesToChatMessages(hydratedHistory),
        agencyProfile,
        input.channelMembers,
        effectiveSkills.skills.map((skill) => skill.name),
        workspaceContextEntries,
      );

      const adapterAgent: AdapterAgent = {
        id: agent.id,
        labId: agent.labId,
        companyId: agent.labId,
        name: agent.name,
        adapterType: agent.adapterType,
        adapterConfig: agent.adapterConfig,
      };

      const runtime: AdapterRuntime = {
        sessionId: useConversationRuntime
          ? asString(conversationSession?.runtimeSessionId)
          : asString(conversationSession?.runtimeSessionId) ?? asString(runtimeState?.sessionId),
        sessionParams: restoredSessionParams,
        sessionDisplayId:
          (useConversationRuntime
            ? asString(conversationSession?.runtimeSessionDisplayId)
            : asString(conversationSession?.runtimeSessionDisplayId) ??
              asString(runtimeState?.sessionDisplayId)) ??
          adapter.sessionCodec?.getDisplayId?.(restoredSessionParams) ??
          null,
      };

      const runId = randomUUID();
      const temporaryMessageId = `stream-${runId}`;
      let previewContent = "";
      let streamedMessageStarted = false;
      let stdout = "";

      registerChannelRun(input.channel.id, runId);
      const execution = await adapter.execute({
        runId,
        agent: adapterAgent,
        runtime,
        config: {
          promptTemplate: "{{context.prompt}}",
          ...((agent.adapterConfig ?? {}) as Record<string, unknown>),
        },
        context: {
          prompt,
          workspaceId: input.channel.workspaceId,
          channelId: input.channel.id,
          agentId: agent.id,
          ownlabWorkspace: {
            cwd: runtimeWorkspace.cwd,
            source: runtimeWorkspace.workspaceSource,
            workspaceId: runtimeWorkspace.workspaceId,
            worktreePath: runtimeWorkspace.worktreePath,
            agentHome: runtimeWorkspace.agentHome,
            channelHome: runtimeWorkspace.channelHome,
            name: runtimeWorkspace.workspaceName,
          },
          effectiveSkills: effectiveSkills.skills.map((skill) => ({
            id: skill.id,
            slug: skill.slug,
            name: skill.name,
            localPath: skill.localPath,
            adapterCompat: skill.adapterCompat,
          })),
          workspacePluginContext: workspaceContextEntries,
          agencyProfile: agencyProfile
            ? {
                rootDir: agencyProfile.rootDir,
                manifestPath: agencyProfile.manifestPath,
                agencyFilePath: agencyProfile.agencyFilePath,
                sourcePath: agencyProfile.sourcePath,
                customPath: agencyProfile.customPath,
              }
            : null,
        },
        onLog: async (stream, chunk) => {
          const prefix = `[adapter:${adapter.type} run:${runId}]`;
          if (stream === "stderr") {
            console.error(prefix, chunk);
            for (const line of normalizeStatusLines(chunk)) {
              const userVisibleLine = getUserVisibleStatusLine(line);
              if (userVisibleLine) {
                await callbacks?.onStatus?.(userVisibleLine);
              }
            }
            return;
          }

          console.log(prefix, chunk);
          stdout += chunk;
          const nextContent = sanitizeUserVisibleAssistantContent(
            getPreviewContent(adapter.type, stdout).trim(),
          );
          if (!nextContent || nextContent === previewContent) {
            return;
          }

          if (!streamedMessageStarted) {
            streamedMessageStarted = true;
            await callbacks?.onAssistantMessageStart?.(
              createTemporaryAssistantMessage({
                id: temporaryMessageId,
                channelId: input.channel.id,
                actorId: agent.id,
                actorName: agent.name,
                actorIcon: agent.icon,
              }),
            );
          }

          previewContent = nextContent;
          await callbacks?.onAssistantMessageContent?.(temporaryMessageId, previewContent);
        },
      }).finally(() => {
        unregisterChannelRun(input.channel.id, runId);
      });

      executions.push(execution);
      const interrupted = isChannelRunInterrupted(runId);
      clearChannelRunInterrupted(runId);

      if (!interrupted && ((execution.exitCode ?? 0) !== 0 || execution.timedOut)) {
        if (execution.clearSession) {
          if (!useConversationRuntime) {
            await channelService.updateChannelMemberRuntimeState(input.channel.id, agent.id, null);
          }
          if (conversationSession?.id) {
            await conversationSessionService.updateSessionAfterMessage({
              sessionId: conversationSession.id,
              runtimeSessionId: null,
              runtimeSessionParams: null,
              runtimeSessionDisplayId: null,
              transcriptPath: null,
              transcriptStatus: "missing",
            });
          }
        }
        const message =
          execution.errorMessage ||
          (execution.timedOut ? "Adapter execution timed out" : "Adapter execution failed");
        throw new Error(message);
      }

      if (!interrupted) {
        const serializedSessionParams = adapter.sessionCodec?.serialize(
          execution.sessionParams ?? runtime.sessionParams,
        ) ?? asRecord(execution.sessionParams ?? runtime.sessionParams);
        const nextRuntimeState = execution.clearSession
          ? null
          : {
              sessionId: execution.sessionId ?? runtime.sessionId ?? null,
              sessionParams: serializedSessionParams,
              sessionDisplayId:
                execution.sessionDisplayId ??
                adapter.sessionCodec?.getDisplayId?.(execution.sessionParams ?? runtime.sessionParams) ??
                runtime.sessionDisplayId ??
                null,
            };
        if (!useConversationRuntime) {
          await channelService.updateChannelMemberRuntimeState(input.channel.id, agent.id, nextRuntimeState);
        }
        if (conversationSession?.id) {
          await conversationSessionService.updateSessionAfterMessage({
            sessionId: conversationSession.id,
            runtimeSessionId: nextRuntimeState?.sessionId ?? null,
            runtimeSessionParams: asRecord(nextRuntimeState?.sessionParams),
            runtimeSessionDisplayId: nextRuntimeState?.sessionDisplayId ?? null,
            transcriptStatus: nextRuntimeState ? "active" : "missing",
          });
        }
      }

      const assistantContent = sanitizeUserVisibleAssistantContent(
        (execution.summary && execution.summary.trim()) ||
        previewContent ||
        (interrupted ? "(interrupted)" : "(no output)"),
      ) || (interrupted ? "(interrupted)" : "(no output)");

      const assistantMessage = await messageService.appendMessage({
        channelId: input.channel.id,
        sessionId: conversationSession?.id ?? null,
        actorId: agent.id,
        actorType: "agent",
        content: assistantContent,
        metadata: {
          actorName: agent.name,
          actorIcon: agent.icon,
          interrupted,
        },
      });

      assistantMessages.push(assistantMessage);
      history.push(assistantMessage);
      if (conversationSession?.id) {
        await conversationSessionService.updateSessionAfterMessage({
          sessionId: conversationSession.id,
          titleHint: inferConversationTitle(input.history),
        });
      }

      if (!streamedMessageStarted) {
        await callbacks?.onAssistantMessageStart?.(
          createTemporaryAssistantMessage({
            id: temporaryMessageId,
            channelId: input.channel.id,
            actorId: agent.id,
            actorName: agent.name,
            actorIcon: agent.icon,
          }),
        );
      }

      const [hydratedAssistantMessage] = await messageService.hydrateMessages([assistantMessage]);
      if (hydratedAssistantMessage) {
        if (interrupted) {
          await callbacks?.onStatus?.("Response interrupted");
        }
        await callbacks?.onAssistantMessageContent?.(temporaryMessageId, assistantContent);
        await callbacks?.onAssistantMessageComplete?.(
          temporaryMessageId,
          hydratedAssistantMessage,
          execution,
        );
      }

      await db
        .update(agents)
        .set({
          status: "idle",
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id));
    }

    if (assistantMessages.length === 0) {
      throw new Error("No agent responses were produced for this channel");
    }

    return {
      assistantMessages,
      execution: executions[0] ?? null,
      executions,
    };
  }

  return {
    executeAgentDeliveries,
  };
}

function inferConversationTitle(history: StoredChannelMessage[]): string | null {
  const firstHuman = history.find((message) => message.actorType === "human" && message.content.trim().length > 0);
  if (!firstHuman) return null;
  const trimmed = firstHuman.content.trim().replace(/\s+/g, " ");
  return trimmed.length > 80 ? `${trimmed.slice(0, 79)}…` : trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
