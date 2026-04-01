import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import { createPluginService } from "./service.js";

function getErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  if (error.message === "WORKSPACE_NOT_FOUND" || error.message === "PLUGIN_NOT_FOUND") {
    return 404;
  }

  if (error.message === "PLUGIN_NEEDS_CONFIG" || error.message === "UNSUPPORTED_ACTION") {
    return 400;
  }

  if (error.message === "INVALID_ACTION_PAYLOAD" || error.message === "PLUGIN_ITEM_NOT_FOUND") {
    return 422;
  }

  return 500;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  switch (error.message) {
    case "WORKSPACE_NOT_FOUND":
      return "Workspace not found";
    case "PLUGIN_NOT_FOUND":
      return "Plugin not found";
    case "PLUGIN_NEEDS_CONFIG":
      return "Plugin configuration is incomplete";
    case "UNSUPPORTED_ACTION":
      return "Unsupported plugin action";
    case "INVALID_ACTION_PAYLOAD":
      return "Invalid plugin action payload";
    case "PLUGIN_ITEM_NOT_FOUND":
      return "Plugin item not found";
    default:
      return fallback;
  }
}

export function pluginRoutes(db: Db): RouterType {
  const router = Router();
  const service = createPluginService(db);

  router.get("/workspace/:workspaceId", async (req, res) => {
    try {
      const result = await service.listWorkspacePlugins(req.params.workspaceId);
      res.json(result);
    } catch (error) {
      console.error("Failed to list workspace plugins:", error);
      res.status(getErrorStatus(error)).json({
        error: getErrorMessage(error, "Failed to list workspace plugins"),
      });
    }
  });

  router.patch("/workspace/:workspaceId/:pluginId", async (req, res) => {
    try {
      const result = await service.updateWorkspacePlugin(
        req.params.workspaceId,
        req.params.pluginId,
        req.body ?? {},
      );
      res.json(result);
    } catch (error) {
      console.error("Failed to update workspace plugin:", error);
      res.status(getErrorStatus(error)).json({
        error: getErrorMessage(error, "Failed to update workspace plugin"),
      });
    }
  });

  router.post("/workspace/:workspaceId/:pluginId/actions/:actionKey", async (req, res) => {
    try {
      const result = await service.triggerWorkspacePluginAction(
        req.params.workspaceId,
        req.params.pluginId,
        req.params.actionKey,
        req.body ?? {},
      );
      res.status(201).json(result);
    } catch (error) {
      console.error("Failed to trigger workspace plugin action:", error);
      res.status(getErrorStatus(error)).json({
        error: getErrorMessage(error, "Failed to trigger workspace plugin action"),
      });
    }
  });

  router.get("/workspace/:workspaceId/:pluginId/view", async (req, res) => {
    try {
      const result = await service.getWorkspacePluginView(
        req.params.workspaceId,
        req.params.pluginId,
      );
      res.json(result);
    } catch (error) {
      console.error("Failed to load workspace plugin view:", error);
      res.status(getErrorStatus(error)).json({
        error: getErrorMessage(error, "Failed to load workspace plugin view"),
      });
    }
  });

  return router;
}
