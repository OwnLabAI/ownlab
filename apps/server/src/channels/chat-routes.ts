import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import type { ChannelChatStreamEvent, ChannelMention } from "@ownlab/shared";
import { sendAgentChannelMessage, streamAgentChannelMessage } from "./chat-service.js";
import { createChannelService } from "./service.js";

type ChatRequestBody = {
  channelId?: string;
  agentId?: string;
  workspaceId?: string;
  sessionId?: string;
  content?: string;
  actorId?: string;
  attachments?: Array<{
    type: "file";
    filename?: string;
    mediaType?: string;
    url?: string;
  }>;
  mentions?: ChannelMention[];
  scopeType?: "agent_dm" | "task" | "workspace" | "team";
  taskId?: string;
  assigneeAgentId?: string;
  teamId?: string;
  messages?: Array<{ role: string; content: string }>;
};

function parseChatRequest(bodyRaw: unknown) {
  const body = (bodyRaw ?? {}) as ChatRequestBody;
  const mentions = Array.isArray(body.mentions)
    ? body.mentions.filter(
        (entry): entry is ChannelMention =>
          !!entry &&
          typeof entry.id === "string" &&
          entry.type === "agent" &&
          typeof entry.label === "string",
      )
    : [];
  let content = body.content;
  if (!content && Array.isArray(body.messages) && body.messages.length > 0) {
    const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
    content = lastUser?.content;
  }

  const channelId = body.channelId;
  const workspaceId = body.workspaceId;
  const sessionId = body.sessionId;
  const actorId = body.actorId ?? "human";
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  const scopeType = body.scopeType;
  const taskId = body.taskId;
  const assigneeAgentId = body.assigneeAgentId;
  const teamId = body.teamId;

  let agentId = body.agentId;
  if (scopeType === "task" && assigneeAgentId) {
    agentId = assigneeAgentId;
  }

  return {
    channelId,
    workspaceId,
    sessionId,
    actorId,
    attachments,
    mentions,
    scopeType,
    taskId,
    assigneeAgentId,
    teamId,
    agentId,
    content: content ?? "",
  };
}

export function chatRoutes(db: Db): RouterType {
  const router = Router();

  router.post("/", async (req, res) => {
    try {
      const {
        channelId,
        workspaceId,
        sessionId,
        actorId,
        attachments,
        mentions,
        scopeType,
        taskId,
        assigneeAgentId,
        teamId,
        agentId,
        content,
      } = parseChatRequest(req.body);

      if ((!channelId && (!agentId || !workspaceId)) || (!content && attachments.length === 0)) {
        res.status(400).json({
          error:
            "channelId or (agentId/workspaceId) and message content or attachments are required",
        });
        return;
      }

      const result = await sendAgentChannelMessage({
        db,
        channelId,
        agentId,
        workspaceId,
        content: content ?? "",
        actorId,
        attachments,
        mentions,
        scopeType,
        taskId,
        assigneeAgentId,
      });

      const channelService = createChannelService(db);
      const [userMessage] = await channelService.hydrateMessages([result.userMessage]);
      const assistantMessages = await channelService.hydrateMessages(result.assistantMessages);

      res.status(201).json({
        channelId: result.channelId,
        userMessage,
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
      console.error("Failed to send agent channel message:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to send agent channel message",
      });
    }
  });

  router.post("/stream", async (req, res) => {
    const {
      channelId,
      workspaceId,
      sessionId,
      actorId,
      attachments,
      mentions,
      scopeType,
        taskId,
        assigneeAgentId,
        teamId,
        agentId,
        content,
    } = parseChatRequest(req.body);

    if ((!channelId && (!agentId || !workspaceId)) || (!content && attachments.length === 0)) {
      res.status(400).json({
        error:
          "channelId or (agentId/workspaceId) and message content or attachments are required",
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
      if (closed) {
        return;
      }
      res.write(`${JSON.stringify(event)}\n`);
      const flush = (res as typeof res & { flush?: () => void }).flush;
      flush?.();
    };

    try {
      await streamAgentChannelMessage(
        {
          db,
          channelId,
          agentId,
          workspaceId,
          sessionId,
          content,
          actorId,
          attachments,
          mentions,
          scopeType,
          taskId,
          assigneeAgentId,
          teamId,
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
      console.error("Failed to stream agent channel message:", error);
      writeEvent({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to stream agent channel message",
      });
    } finally {
      if (!closed) {
        res.end();
      }
    }
  });

  return router;
}
