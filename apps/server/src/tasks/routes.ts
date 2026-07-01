import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import { createHeartbeatService } from "../heartbeat/service.js";
import { createTaskService } from "./service.js";

export function taskRoutes(db: Db): RouterType {
  const router = Router();
  const service = createTaskService(db);
  const heartbeatService = createHeartbeatService(db);

  router.get("/by-board/:boardId", async (req, res) => {
    try {
      const result = await service.listTasksByBoard(req.params.boardId);
      res.json(result);
    } catch (error) {
      console.error("Failed to list tasks:", error);
      res.status(500).json({ error: "Failed to list tasks" });
    }
  });

  router.get("/:id/detail", async (req, res) => {
    try {
      const detail = await service.getTaskDetail(req.params.id);
      if (!detail) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json(detail);
    } catch (error) {
      console.error("Failed to get task detail:", error);
      res.status(500).json({ error: "Failed to get task detail" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const task = await service.getTaskById(req.params.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json(task);
    } catch (error) {
      console.error("Failed to get task:", error);
      res.status(500).json({ error: "Failed to get task" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const {
        boardId,
        workspaceId,
        parentId,
        title,
        objective,
        status,
        priority,
        groupName,
        assigneeAgentId,
        assigneeTeamId,
        scheduleEnabled,
        scheduleType,
        intervalSec,
        mode,
      } = req.body ?? {};

      if (!title || typeof title !== "string" || title.trim().length === 0) {
        res.status(400).json({ error: "Title is required" });
        return;
      }

      const task = await service.createTask({
        boardId: boardId ?? null,
        workspaceId: workspaceId ?? null,
        parentId: parentId ?? null,
        title: title.trim(),
        objective: objective ?? null,
        status: status ?? "backlog",
        priority: priority ?? "medium",
        groupName: groupName ?? null,
        assigneeAgentId: assigneeAgentId ?? null,
        assigneeTeamId: assigneeTeamId ?? null,
        scheduleEnabled:
          typeof scheduleEnabled === "boolean" ? scheduleEnabled : undefined,
        scheduleType: scheduleType ?? "manual",
        intervalSec: typeof intervalSec === "number" ? intervalSec : null,
        mode: mode === "scheduled" || mode === "auto" ? mode : undefined,
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create task:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create task" });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const result = await service.updateTask(req.params.id, req.body ?? {});
      if (!result) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const result = await service.deleteTask(req.params.id);
      if (!result) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to delete task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  router.post("/:id/run", async (req, res) => {
    try {
      const task = await service.getTaskById(req.params.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      const mode = typeof task.metadata?.mode === "string" ? task.metadata.mode : null;
      const run =
        mode === "scheduled"
          ? await heartbeatService.invokeTask(task.id)
          : await service.enqueueTaskRun(req.params.id);
      res.status(201).json(run);
    } catch (error) {
      console.error("Failed to run task:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to run task" });
    }
  });

  router.post("/:id/stop", async (req, res) => {
    try {
      const task = await service.stopTask(req.params.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json(task);
    } catch (error) {
      console.error("Failed to stop task:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to stop task" });
    }
  });

  return router;
}
