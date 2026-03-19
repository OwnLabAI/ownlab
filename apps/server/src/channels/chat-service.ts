import type { Db } from "@ownlab/db";
import {
  channelMessages,
  and,
  asc,
  eq,
} from "@ownlab/db";
import type {
  AdapterExecutionResult,
} from "@ownlab/adapter-utils";
import type { ChannelAttachment, ChannelDisplayMessage, ChannelMention } from "@ownlab/shared";
import { createChannelMessageService } from "./message-service.js";
import { createChannelRoutingService } from "./routing-service.js";
import { createChannelDeliveryService } from "./delivery-service.js";
import { createAttachmentProcessingService } from "./attachment-processing-service.js";
import { createConversationSessionService } from "./session-service.js";

type StoredChannelMessage = typeof channelMessages.$inferSelect;

export interface SendAgentChannelMessageInput {
  db: Db;
  channelId?: string;
  agentId?: string;
  workspaceId?: string;
  sessionId?: string;
  content: string;
  actorId: string;
  attachments?: ChannelAttachment[];
  mentions?: ChannelMention[];
  scopeType?: "agent_dm" | "task" | "workspace" | "team";
  taskId?: string;
  assigneeAgentId?: string;
  teamId?: string;
}

export interface SendAgentChannelMessageResult {
  channelId: string;
  userMessage: StoredChannelMessage;
  assistantMessage: StoredChannelMessage | null;
  assistantMessages: StoredChannelMessage[];
  execution: AdapterExecutionResult | null;
  executions: AdapterExecutionResult[];
}

export interface StreamAgentChannelMessageCallbacks {
  onUserMessage?: (message: ChannelDisplayMessage) => Promise<void> | void;
  onAssistantMessageStart?: (message: ChannelDisplayMessage) => Promise<void> | void;
  onAssistantMessageContent?: (messageId: string, content: string) => Promise<void> | void;
  onAssistantMessageComplete?: (
    temporaryMessageId: string,
    message: ChannelDisplayMessage,
    execution: AdapterExecutionResult,
  ) => Promise<void> | void;
  onStatus?: (message: string) => Promise<void> | void;
}

function assertMessageNotEmpty(input: SendAgentChannelMessageInput) {
  if (!input.content.trim() && (!input.attachments || input.attachments.length === 0)) {
    throw new Error("Message content or attachments must not be empty");
  }
}

async function sendAgentChannelMessageInternal(
  input: SendAgentChannelMessageInput,
  callbacks?: StreamAgentChannelMessageCallbacks,
): Promise<SendAgentChannelMessageResult> {
  assertMessageNotEmpty(input);

  const routingService = createChannelRoutingService(input.db);
  const messageService = createChannelMessageService(input.db);
  const deliveryService = createChannelDeliveryService(input.db);
  const conversationSessionService = createConversationSessionService(input.db);
  const attachmentProcessingService = createAttachmentProcessingService();
  const attachments = await attachmentProcessingService.enrichAttachments(input.attachments ?? []);

  const plan = await routingService.resolveResponsePlan({
    channelId: input.channelId,
    agentId: input.agentId,
    workspaceId: input.workspaceId,
    scopeType: input.scopeType,
    taskId: input.taskId,
    assigneeAgentId: input.assigneeAgentId,
    teamId: input.teamId,
    content: input.content,
    mentions: input.mentions,
  });

  const primaryParticipant = plan.participantMembers[0] ?? null;
  const conversationSession =
    input.scopeType === "agent_dm" || plan.channel.scopeType === "agent_dm"
      ? await conversationSessionService.ensureSession({
          agentId: primaryParticipant?.actorId ?? input.agentId ?? "",
          channelId: plan.channel.id,
          sessionId: input.sessionId ?? null,
        })
      : null;

  const userMessage = await messageService.createHumanMessage({
    channelId: plan.channel.id,
    sessionId: conversationSession?.id ?? null,
    actorId: input.actorId,
    content: input.content,
    attachments,
    mentions: input.mentions,
  });

  if (callbacks?.onUserMessage) {
    const [hydratedUserMessage] = await messageService.hydrateMessages([userMessage]);
    if (hydratedUserMessage) {
      await callbacks.onUserMessage(hydratedUserMessage);
    }
  }

  const history = await input.db
    .select()
    .from(channelMessages)
    .where(
      conversationSession
        ? and(eq(channelMessages.channelId, plan.channel.id), eq(channelMessages.sessionId, conversationSession.id))
        : eq(channelMessages.channelId, plan.channel.id),
    )
    .orderBy(asc(channelMessages.createdAt))
    .limit(50);

  const deliveryResult = await deliveryService.executeAgentDeliveries(
    {
      channel: {
        id: plan.channel.id,
        workspaceId: plan.channel.workspaceId,
      },
      channelMembers: plan.channelMembers,
      participantMembers: plan.participantMembers,
      conversationSession,
      history,
    },
    callbacks,
  );

  return {
    channelId: plan.channel.id,
    userMessage,
    assistantMessage: deliveryResult.assistantMessages[0] ?? null,
    assistantMessages: deliveryResult.assistantMessages,
    execution: deliveryResult.execution,
    executions: deliveryResult.executions,
  };
}

export async function sendAgentChannelMessage(
  input: SendAgentChannelMessageInput,
): Promise<SendAgentChannelMessageResult> {
  return sendAgentChannelMessageInternal(input);
}

export async function streamAgentChannelMessage(
  input: SendAgentChannelMessageInput,
  callbacks: StreamAgentChannelMessageCallbacks,
): Promise<SendAgentChannelMessageResult> {
  return sendAgentChannelMessageInternal(input, callbacks);
}
