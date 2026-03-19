import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import type { ChannelChatStreamEvent, ChannelMention } from "@ownlab/shared";
import { createChannelMessageService } from "./message-service.js";
import { sendAgentChannelMessage, streamAgentChannelMessage } from "./chat-service.js";

export function channelMessageRoutes(db: Db): RouterType {
  const router = Router({ mergeParams: true });
  const messageService = createChannelMessageService(db);

  function parseMentions(value: unknown): ChannelMention[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const id = typeof entry.id === "string" ? entry.id : null;
      const type = entry.type === "agent" ? "agent" : null;
      const label = typeof entry.label === "string" ? entry.label : null;

      if (!id || !type || !label) {
        return [];
      }

      return [{ id, type, label }];
    });
  }

  router.get("/", async (req, res) => {
    try {
      const params = req.params as Record<string, string | undefined>;
      const channelId = String(params.channelId ?? "");
      const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const messages = await messageService.listMessages(channelId, limit, sessionId);
      res.json(messages);
    } catch (error) {
      console.error("Failed to get channel messages:", error);
      res.status(500).json({ error: "Failed to get channel messages" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const params = req.params as Record<string, string | undefined>;
      const channelId = String(params.channelId ?? "");
      const { actorId, actorType, content, metadata, sessionId } = req.body as {
        actorId: string;
        actorType?: string;
        content: string;
        metadata?: Record<string, unknown>;
        sessionId?: string;
      };
      if (!actorId || !content) {
        res.status(400).json({ error: "actorId and content are required" });
        return;
      }
      const message = await messageService.appendMessage({
        channelId,
        sessionId,
        actorId,
        actorType,
        content,
        metadata: metadata ?? null,
      });
      const [hydrated] = await messageService.hydrateMessages([message]);
      res.status(201).json(hydrated ?? message);
    } catch (error) {
      console.error("Failed to save channel message:", error);
      res.status(500).json({ error: "Failed to save channel message" });
    }
  });

  router.post("/respond", async (req, res) => {
    try {
      const params = req.params as Record<string, string | undefined>;
      const channelId = String(params.channelId ?? "");
      const { actorId, content, attachments, sessionId, mentions } = (req.body ?? {}) as {
        actorId?: string;
        content?: string;
        sessionId?: string;
        attachments?: Array<{
          type: "file";
          filename?: string;
          mediaType?: string;
          url?: string;
        }>;
        mentions?: ChannelMention[];
      };

      if (!actorId || (!content && (!Array.isArray(attachments) || attachments.length === 0))) {
        res.status(400).json({ error: "actorId and message content or attachments are required" });
        return;
      }

      const result = await sendAgentChannelMessage({
        db,
        channelId,
        sessionId,
        actorId,
        content: content ?? "",
        attachments: Array.isArray(attachments) ? attachments : [],
        mentions: parseMentions(mentions),
      });

      const [userMessage] = await messageService.hydrateMessages([result.userMessage]);
      const assistantMessages = await messageService.hydrateMessages(result.assistantMessages);

      res.status(201).json({
        channelId: result.channelId,
        userMessage: userMessage ?? null,
        assistantMessage: assistantMessages[0] ?? null,
        assistantMessages,
        execution: {
          exitCode: result.execution?.exitCode ?? null,
          timedOut: result.execution?.timedOut ?? false,
          errorMessage: result.execution?.errorMessage ?? null,
          usage: result.execution?.usage,
          provider: result.execution?.provider,
          model: result.execution?.model,
        },
        executions: result.executions.map((execution) => ({
          exitCode: execution.exitCode,
          timedOut: execution.timedOut,
          errorMessage: execution.errorMessage,
          usage: execution.usage,
          provider: execution.provider,
          model: execution.model,
        })),
      });
    } catch (error) {
      console.error("Failed to send channel message and gather agent responses:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to send channel message and gather agent responses",
      });
    }
  });

  router.post("/respond/stream", async (req, res) => {
    const params = req.params as Record<string, string | undefined>;
    const channelId = String(params.channelId ?? "");
    const { actorId, content, attachments, sessionId, mentions } = (req.body ?? {}) as {
      actorId?: string;
      content?: string;
      sessionId?: string;
      attachments?: Array<{
        type: "file";
        filename?: string;
        mediaType?: string;
        url?: string;
      }>;
      mentions?: ChannelMention[];
    };

    if (!actorId || (!content && (!Array.isArray(attachments) || attachments.length === 0))) {
      res.status(400).json({
        error: "actorId and message content or attachments are required",
      });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let closed = false;
    res.on("close", () => {
      closed = true;
    });

    const writeEvent = (event: ChannelChatStreamEvent) => {
      if (!closed) {
        res.write(`${JSON.stringify(event)}\n`);
        const flush = (res as typeof res & { flush?: () => void }).flush;
        flush?.();
      }
    };

    try {
      await streamAgentChannelMessage(
        {
          db,
          channelId,
          sessionId,
          actorId,
          content: content ?? "",
          attachments: Array.isArray(attachments) ? attachments : [],
          mentions: parseMentions(mentions),
        },
        {
          onUserMessage(message) {
            writeEvent({ type: "user_message", message });
          },
          onAssistantMessageStart(message) {
            writeEvent({ type: "assistant_message_start", message });
          },
          onAssistantMessageContent(messageId, nextContent) {
            writeEvent({
              type: "assistant_message_content",
              messageId,
              content: nextContent,
            });
          },
          onAssistantMessageComplete(temporaryMessageId, message, execution) {
            writeEvent({
              type: "assistant_message_complete",
              temporaryMessageId,
              message,
              execution: {
                exitCode: execution.exitCode,
                timedOut: execution.timedOut,
                errorMessage: execution.errorMessage ?? null,
                usage: execution.usage ? { ...execution.usage } : null,
                provider: execution.provider ?? null,
                model: execution.model ?? null,
              },
            });
          },
          onStatus(message) {
            writeEvent({ type: "status", message });
          },
        },
      );
    } catch (error) {
      console.error("Failed to stream channel message agent responses:", error);
      writeEvent({
        type: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to stream channel message agent responses",
      });
    } finally {
      if (!closed) {
        res.end();
      }
    }
  });

  return router;
}
