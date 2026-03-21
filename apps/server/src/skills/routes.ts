import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import { createSkillService } from "./service.js";

export function skillRoutes(db: Db): RouterType {
  const router = Router();
  const service = createSkillService(db);

  router.get("/", async (_req, res) => {
    try {
      const rows = await service.listSkills();
      res.json(rows);
    } catch (error) {
      console.error("Failed to list skills:", error);
      res.status(500).json({ error: "Failed to list skills" });
    }
  });

  router.post("/import", async (req, res) => {
    try {
      const { sourcePath, slug } = req.body as {
        sourcePath?: string;
        slug?: string | null;
      };
      if (!sourcePath || typeof sourcePath !== "string") {
        res.status(400).json({ error: "sourcePath is required" });
        return;
      }

      const imported = await service.importCommunitySkill({
        sourcePath,
        slug: typeof slug === "string" ? slug : null,
      });
      res.status(201).json(imported);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import skill";
      console.error("Failed to import skill:", error);
      res.status(400).json({ error: message });
    }
  });

  router.get("/agents/:agentId", async (req, res) => {
    try {
      const rows = await service.listAgentSkills(req.params.agentId);
      res.json(rows);
    } catch (error) {
      console.error("Failed to list agent skills:", error);
      res.status(500).json({ error: "Failed to list agent skills" });
    }
  });

  router.get("/agents/:agentId/runtime", async (req, res) => {
    try {
      const rows = await service.listAgentRuntimeSkills(req.params.agentId);
      res.json(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list agent runtime skills";
      console.error("Failed to list agent runtime skills:", error);
      if (message === "Agent not found") {
        res.status(404).json({ error: message });
        return;
      }
      res.status(500).json({ error: message });
    }
  });

  router.put("/agents/:agentId", async (req, res) => {
    try {
      const { assignments } = req.body as {
        assignments?: Array<{
          skillId: string;
          enabled?: boolean;
          priority?: number;
          config?: Record<string, unknown>;
        }>;
      };
      if (!Array.isArray(assignments)) {
        res.status(400).json({ error: "assignments array is required" });
        return;
      }

      const rows = await service.setAgentSkills({
        agentId: req.params.agentId,
        assignments,
      });
      res.json(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update agent skills";
      console.error("Failed to update agent skills:", error);
      if (message === "Agent not found" || message.startsWith("Skill not found")) {
        res.status(404).json({ error: message });
        return;
      }
      res.status(400).json({ error: message });
    }
  });

  router.get("/:skillId", async (req, res) => {
    try {
      const row = await service.getSkillDetail(req.params.skillId);
      if (!row) {
        res.status(404).json({ error: "Skill not found" });
        return;
      }
      res.json(row);
    } catch (error) {
      console.error("Failed to get skill detail:", error);
      res.status(500).json({ error: "Failed to get skill detail" });
    }
  });

  return router;
}
