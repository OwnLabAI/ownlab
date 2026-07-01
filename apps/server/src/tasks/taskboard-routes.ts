import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import { taskboards, tasks, labs, eq, desc } from "@ownlab/db";
import { createTaskService } from "./service.js";

export function taskboardRoutes(db: Db): RouterType {
  const router = Router();
  const taskService = createTaskService(db);

  router.get("/", async (_req, res) => {
    try {
      const result = await db.select().from(taskboards).orderBy(desc(taskboards.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Failed to list taskboards:", error);
      res.status(500).json({ error: "Failed to list taskboards" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const result = await db.select().from(taskboards).where(eq(taskboards.id, req.params.id));
      if (result.length === 0) {
        res.status(404).json({ error: "Taskboard not found" });
        return;
      }
      res.json(result[0]);
    } catch (error) {
      console.error("Failed to get taskboard:", error);
      res.status(500).json({ error: "Failed to get taskboard" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      let labResult = await db.select().from(labs).limit(1);
      if (labResult.length === 0) {
        labResult = await db.insert(labs).values({ name: "Default Lab" }).returning();
      }
      const labId = labResult[0].id;

      const result = await db
        .insert(taskboards)
        .values({
          name: name.trim(),
          labId,
          description: description ?? null,
        })
        .returning();

      res.status(201).json(result[0]);
    } catch (error) {
      console.error("Failed to create taskboard:", error);
      res.status(500).json({ error: "Failed to create taskboard" });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const { name, description, status } = req.body;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;

      const result = await db
        .update(taskboards)
        .set(updates)
        .where(eq(taskboards.id, req.params.id))
        .returning();

      if (result.length === 0) {
        res.status(404).json({ error: "Taskboard not found" });
        return;
      }
      res.json(result[0]);
    } catch (error) {
      console.error("Failed to update taskboard:", error);
      res.status(500).json({ error: "Failed to update taskboard" });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const boardId = req.params.id;
      const boardTasks = await db.select().from(tasks).where(eq(tasks.boardId, boardId));
      for (const task of boardTasks) {
        await taskService.deleteTask(task.id);
      }
      const result = await db.delete(taskboards).where(eq(taskboards.id, boardId)).returning();
      if (result.length === 0) {
        res.status(404).json({ error: "Taskboard not found" });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to delete taskboard:", error);
      res.status(500).json({ error: "Failed to delete taskboard" });
    }
  });

  return router;
}
