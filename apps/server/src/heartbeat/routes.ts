import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import { createHeartbeatService } from "./service.js";

export function heartbeatRoutes(db: Db): RouterType {
  const router = Router();
  const service = createHeartbeatService(db);

  router.post("/invoke-task", async (req, res) => {
    try {
      const { taskId, agentId, requestedByActorId } = (req.body ?? {}) as {
        taskId?: string;
        agentId?: string;
        requestedByActorId?: string;
      };

      if (!taskId) {
        res.status(400).json({ error: "taskId is required" });
        return;
      }

      const run = await service.invokeTask(taskId, {
        agentId,
        requestedByActorId,
      });

      res.status(201).json(run);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to invoke task";
      console.error("Heartbeat invoke-task failed:", error);
      res.status(400).json({ error: message });
    }
  });

  router.get("/runs/task/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string, 10) || 20, 1),
        100,
      );
      const runs = await service.listRunsForTask(taskId, limit);
      res.json(runs);
    } catch (error) {
      console.error("Failed to list heartbeat runs:", error);
      res.status(500).json({ error: "Failed to list runs" });
    }
  });

  router.get("/runs/:runId", async (req, res) => {
    try {
      const run = await service.getRun(req.params.runId);
      if (!run) {
        res.status(404).json({ error: "Run not found" });
        return;
      }
      res.json(run);
    } catch (error) {
      console.error("Failed to get heartbeat run:", error);
      res.status(500).json({ error: "Failed to get run" });
    }
  });

  return router;
}
