import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import { createChannelService } from "./service.js";
import { channelMessageRoutes } from "./message-routes.js";
import { stopChannelRuns } from "./run-control-service.js";
import { createConversationSessionService } from "./session-service.js";

function getChannelMemberErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (error.message === "Channel not found") {
    return 404;
  }

  if (error.message === "Agent not found in workspace lab") {
    return 422;
  }

  return 500;
}

export function channelRoutes(db: Db): RouterType {
  const router = Router();
  const service = createChannelService(db);
  const conversationSessionService = createConversationSessionService(db);

  router.use("/:channelId/messages", channelMessageRoutes(db));

  router.get("/:channelId/sessions", async (req, res) => {
    try {
      const sessions = await conversationSessionService.listSessions(req.params.channelId);
      res.json(sessions);
    } catch (error) {
      console.error("Failed to list conversation sessions:", error);
      res.status(500).json({ error: "Failed to list conversation sessions" });
    }
  });

  router.post("/:channelId/sessions", async (req, res) => {
    try {
      const channel = await service.getChannelById(req.params.channelId);
      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      if (channel.scopeType !== "agent_dm" || !channel.scopeRefId) {
        res.status(422).json({ error: "Conversation sessions are only supported for agent DM channels" });
        return;
      }
      const created = await conversationSessionService.createSession({
        agentId: channel.scopeRefId,
        channelId: channel.id,
        title: typeof req.body?.title === "string" ? req.body.title : null,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create conversation session:", error);
      res.status(500).json({ error: "Failed to create conversation session" });
    }
  });

  router.delete("/:channelId/sessions/:sessionId", async (req, res) => {
    try {
      const deleted = await conversationSessionService.deleteSession(req.params.sessionId);
      if (!deleted) {
        res.status(404).json({ error: "Conversation session not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete conversation session:", error);
      res.status(500).json({ error: "Failed to delete conversation session" });
    }
  });

  router.get("/", async (req, res) => {
    try {
      const workspaceId = req.query.workspaceId as string | undefined;
      const scopeType = req.query.scopeType as string | undefined;
      const scopeRefId = req.query.scopeRefId as string | undefined;
      const includeArchived = req.query.includeArchived === "true";

      if (!workspaceId && !scopeType) {
        res.status(400).json({ error: "Either workspaceId or scopeType is required" });
        return;
      }

      const rows = await service.listChannels({
        workspaceId,
        scopeType,
        scopeRefId,
        includeArchived,
      });

      res.json(rows);
    } catch (error) {
      console.error("Failed to list channels:", error);
      res.status(500).json({ error: "Failed to list channels" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { workspaceId, name, title, type, description, scopeType, scopeRefId } = req.body as {
        workspaceId: string;
        name?: string;
        title?: string | null;
        type?: string;
        description?: string;
        scopeType?: string;
        scopeRefId?: string | null;
      };
      if (!workspaceId) {
        res.status(400).json({ error: "workspaceId is required" });
        return;
      }
      const channel = await service.createChannel({
        workspaceId,
        name,
        title,
        type,
        description,
        scopeType,
        scopeRefId,
      });
      res.status(201).json(channel);
    } catch (error) {
      console.error("Failed to create channel:", error);
      res.status(500).json({ error: "Failed to create channel" });
    }
  });

  router.get("/workspace/:workspaceId/agents", async (req, res) => {
    try {
      const agentList = await service.listWorkspaceAgents(req.params.workspaceId);
      res.json(agentList);
    } catch (error) {
      console.error("Failed to list workspace agents:", error);
      res.status(500).json({ error: "Failed to list workspace agents" });
    }
  });

  router.get("/workspace/:workspaceId/available-agents", async (req, res) => {
    try {
      const agentList = await service.listAvailableLabAgentsForWorkspace(req.params.workspaceId);
      res.json(agentList);
    } catch (error) {
      console.error("Failed to list available workspace agents:", error);
      res.status(500).json({ error: "Failed to list available workspace agents" });
    }
  });

  router.get("/:channelId", async (req, res) => {
    try {
      const channel = await service.getChannelById(req.params.channelId);
      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      res.json(channel);
    } catch (error) {
      console.error("Failed to get channel:", error);
      res.status(500).json({ error: "Failed to get channel" });
    }
  });

  router.patch("/:channelId", async (req, res) => {
    try {
      const { title, archived } = (req.body ?? {}) as {
        title?: string | null;
        archived?: boolean;
      };
      const channel = await service.updateChannel(req.params.channelId, {
        title,
        archivedAt:
          typeof archived === "boolean"
            ? (archived ? new Date() : null)
            : undefined,
      });
      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      res.json(channel);
    } catch (error) {
      console.error("Failed to update channel:", error);
      res.status(500).json({ error: "Failed to update channel" });
    }
  });

  router.delete("/:channelId", async (req, res) => {
    try {
      const channel = await service.deleteChannel(req.params.channelId);
      if (!channel) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete channel:", error);
      res.status(500).json({ error: "Failed to delete channel" });
    }
  });

  router.post("/ensure-default", async (req, res) => {
    try {
      const { workspaceId } = req.body as { workspaceId: string };
      if (!workspaceId) {
        res.status(400).json({ error: "workspaceId is required" });
        return;
      }
      const channel = await service.ensureDefaultWorkspaceChannel(workspaceId);
      res.status(201).json(channel);
    } catch (error) {
      console.error("Failed to ensure default channel:", error);
      res.status(500).json({ error: "Failed to ensure default channel" });
    }
  });

  router.post("/ensure-agent-dm", async (req, res) => {
    try {
      const { workspaceId, agentId } = req.body as { workspaceId: string; agentId: string };
      if (!workspaceId || !agentId) {
        res.status(400).json({ error: "workspaceId and agentId are required" });
        return;
      }
      const channel = await service.ensureAgentDmChannel(workspaceId, agentId);
      res.status(201).json(channel);
    } catch (error) {
      console.error("Failed to ensure agent DM channel:", error);
      res.status(500).json({ error: "Failed to ensure agent DM channel" });
    }
  });

  router.post("/ensure-task", async (req, res) => {
    try {
      const { workspaceId, taskId } = req.body as { workspaceId: string; taskId: string };
      if (!workspaceId || !taskId) {
        res.status(400).json({ error: "workspaceId and taskId are required" });
        return;
      }
      const channel = await service.ensureTaskChannel(workspaceId, taskId);
      res.status(201).json(channel);
    } catch (error) {
      console.error("Failed to ensure task channel:", error);
      res.status(500).json({ error: "Failed to ensure task channel" });
    }
  });

  router.post("/ensure-team", async (req, res) => {
    try {
      const { workspaceId, teamId } = req.body as { workspaceId: string; teamId: string };
      if (!workspaceId || !teamId) {
        res.status(400).json({ error: "workspaceId and teamId are required" });
        return;
      }
      const channel = await service.ensureTeamChannel(workspaceId, teamId);
      res.status(201).json(channel);
    } catch (error) {
      console.error("Failed to ensure team channel:", error);
      res.status(500).json({ error: "Failed to ensure team channel" });
    }
  });

  router.get("/:channelId/members", async (req, res) => {
    try {
      const members = await service.listChannelMembers(req.params.channelId);
      res.json(members);
    } catch (error) {
      console.error("Failed to list channel members:", error);
      res
        .status(getChannelMemberErrorStatus(error))
        .json({ error: error instanceof Error ? error.message : "Failed to list channel members" });
    }
  });

  router.post("/:channelId/members", async (req, res) => {
    try {
      const { actorId, actorType } = req.body as { actorId: string; actorType?: string };
      if (!actorId) {
        res.status(400).json({ error: "actorId is required" });
        return;
      }
      const member = await service.addChannelMember(
        req.params.channelId,
        actorId,
        actorType ?? "agent",
      );
      res.status(201).json(member);
    } catch (error) {
      console.error("Failed to add channel member:", error);
      res
        .status(getChannelMemberErrorStatus(error))
        .json({ error: error instanceof Error ? error.message : "Failed to add channel member" });
    }
  });

  router.delete("/:channelId/members/:actorId", async (req, res) => {
    try {
      const removed = await service.removeChannelMember(req.params.channelId, req.params.actorId);
      if (!removed) {
        res.status(404).json({ error: "Channel member not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to remove channel member:", error);
      res
        .status(getChannelMemberErrorStatus(error))
        .json({ error: error instanceof Error ? error.message : "Failed to remove channel member" });
    }
  });

  router.post("/:channelId/stop", async (req, res) => {
    try {
      const result = stopChannelRuns(req.params.channelId);
      res.json(result);
    } catch (error) {
      console.error("Failed to stop channel runs:", error);
      res.status(500).json({ error: "Failed to stop channel runs" });
    }
  });

  return router;
}
