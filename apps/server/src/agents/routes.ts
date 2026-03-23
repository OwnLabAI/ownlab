import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import { createAgentService } from "./service.js";
import { createAgencyTemplateService } from "../agency/service.js";

export function agentRoutes(db: Db): RouterType {
  const router = Router();
  const service = createAgentService(db);
  const agencyTemplates = createAgencyTemplateService();

  router.get("/adapters/:type/models", async (req, res) => {
    try {
      const adapterType = req.params.type;
      const models = await service.listModels(adapterType);
      res.json(models);
    } catch (error) {
      console.error("Failed to list adapter models:", error);
      res.status(500).json({ error: "Failed to list adapter models" });
    }
  });

  router.post("/adapters/:type/test-environment", async (req, res) => {
    try {
      const adapterType = req.params.type;
      const { labId, adapterConfig } = (req.body ?? {}) as {
        labId?: string;
        adapterConfig?: Record<string, unknown>;
      };

      const result = await service.testEnvironment({
        adapterType,
        labId: labId ?? null,
        adapterConfig: adapterConfig ?? {},
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to test adapter environment:", error);
      res.status(500).json({ error: "Failed to test adapter environment" });
    }
  });

  router.get("/", async (_req, res) => {
    try {
      const rows = await service.listAgents();
      res.json(rows);
    } catch (error) {
      console.error("Failed to list agents:", error);
      res.status(500).json({ error: "Failed to list agents" });
    }
  });

  router.get("/agencies", async (_req, res) => {
    try {
      const templates = await agencyTemplates.listTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Failed to list agency templates:", error);
      res.status(500).json({ error: "Failed to list agency templates" });
    }
  });

  router.get("/agencies/:slug", async (req, res) => {
    try {
      const template = await agencyTemplates.getTemplateBySlug(req.params.slug);
      if (!template) {
        res.status(404).json({ error: "Agency template not found" });
        return;
      }
      res.json(template);
    } catch (error) {
      console.error("Failed to get agency template:", error);
      res.status(500).json({ error: "Failed to get agency template" });
    }
  });

  router.get("/by-name/:name", async (req, res) => {
    try {
      const row = await service.getAgentByName(req.params.name);
      if (!row) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      res.json(row);
    } catch (error) {
      console.error("Failed to get agent:", error);
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const row = await service.getAgentById(req.params.id);
      if (!row) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      res.json(row);
    } catch (error) {
      console.error("Failed to get agent:", error);
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const {
        name,
        role,
        reportsTo,
        adapterType,
        model,
        icon,
        style,
        agentType,
        adapterConfig,
        runtimeConfig,
      } = req.body;

      if (!name || typeof name !== "string" || name.length < 3) {
        res.status(400).json({ error: "Name must be at least 3 characters" });
        return;
      }

      const existing = await service.getAgentByName(name);
      if (existing) {
        res.status(409).json({ error: "An agent with this name already exists" });
        return;
      }

      const created = await service.createAgent({
        name,
        role,
        reportsTo,
        adapterType,
        model,
        icon,
        style,
        agentType,
        adapterConfig,
        runtimeConfig,
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("Failed to create agent:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to create agent",
      });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const { name, role, reportsTo, adapterType, icon, status, adapterConfig, runtimeConfig } = req.body;

      const updated = await service.updateAgent(req.params.id, {
        name,
        role,
        reportsTo,
        adapterType,
        icon,
        status,
        adapterConfig,
        runtimeConfig,
      });

      if (!updated) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update agent:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to update agent",
      });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const deleted = await service.deleteAgent(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to delete agent:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  return router;
}
