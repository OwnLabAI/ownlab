import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import { createTeamService } from "./service.js";

export function teamRoutes(db: Db): RouterType {
  const router = Router();
  const service = createTeamService(db);

  router.get("/", async (_req, res) => {
    try {
      const rows = await service.listTeams();
      res.json(rows);
    } catch (error) {
      console.error("Failed to list teams:", error);
      res.status(500).json({ error: "Failed to list teams" });
    }
  });

  router.get("/by-name/:name", async (req, res) => {
    try {
      const row = await service.getTeamByName(req.params.name);
      if (!row) {
        res.status(404).json({ error: "Team not found" });
        return;
      }
      res.json(row);
    } catch (error) {
      console.error("Failed to get team:", error);
      res.status(500).json({ error: "Failed to get team" });
    }
  });

  router.get("/:id/members", async (req, res) => {
    try {
      const members = await service.listTeamMembers(req.params.id);
      res.json(members);
    } catch (error) {
      console.error("Failed to list team members:", error);
      res.status(500).json({ error: "Failed to list team members" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const row = await service.getTeamById(req.params.id);
      if (!row) {
        res.status(404).json({ error: "Team not found" });
        return;
      }
      res.json(row);
    } catch (error) {
      console.error("Failed to get team:", error);
      res.status(500).json({ error: "Failed to get team" });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const { name, description, icon, status, workspaceId } = req.body;
      const updated = await service.updateTeam(req.params.id, {
        name,
        description,
        icon,
        status,
        workspaceId,
      });
      if (!updated) {
        res.status(404).json({ error: "Team not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update team:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to update team",
      });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const created = await service.createTeam(req.body);
      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create team:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to create team",
      });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const deleted = await service.deleteTeam(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Team not found" });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to delete team:", error);
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  return router;
}
