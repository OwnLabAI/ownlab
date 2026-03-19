import type { Db } from "@ownlab/db";
import type { ChannelAttachment, ChannelDisplayMessage, ChannelMention } from "@ownlab/shared";
import { createChannelService } from "./service.js";

export interface CreateChannelMessageInput {
  channelId: string;
  sessionId?: string | null;
  actorId: string;
  actorType?: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}

export interface CreateHumanChannelMessageInput {
  channelId: string;
  sessionId?: string | null;
  actorId: string;
  content: string;
  attachments?: ChannelAttachment[];
  mentions?: ChannelMention[];
}

export function createChannelMessageService(db: Db) {
  const channelService = createChannelService(db);

  function serializeDisplayMessage(message: Awaited<ReturnType<typeof channelService.hydrateMessages>>[number]): ChannelDisplayMessage {
    return {
      ...message,
      createdAt:
        message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : String(message.createdAt),
    };
  }

  async function listMessages(channelId: string, limit: number, sessionId?: string | null): Promise<ChannelDisplayMessage[]> {
    const messages = await channelService.listMessages(channelId, limit, sessionId);
    return messages.map(serializeDisplayMessage);
  }

  async function appendMessage(input: CreateChannelMessageInput) {
    return channelService.appendMessage(input);
  }

  async function createHumanMessage(input: CreateHumanChannelMessageInput) {
    return channelService.appendMessage({
      channelId: input.channelId,
      sessionId: input.sessionId ?? null,
      actorId: input.actorId,
      actorType: "human",
      content: input.content,
      metadata: {
        actorName: input.actorId === "local-user" ? "You" : "Human",
        attachments: input.attachments ?? [],
        mentions: input.mentions ?? [],
      },
    });
  }

  async function hydrateMessages(
    rows: Parameters<typeof channelService.hydrateMessages>[0],
  ): Promise<ChannelDisplayMessage[]> {
    const messages = await channelService.hydrateMessages(rows);
    return messages.map(serializeDisplayMessage);
  }

  return {
    listMessages,
    appendMessage,
    createHumanMessage,
    hydrateMessages,
  };
}
