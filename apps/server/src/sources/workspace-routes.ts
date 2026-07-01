import type { Router } from "express";
import type { Db } from "@ownlab/db";
import type { CreateWorkspaceSourceInput } from "@ownlab/shared";
import { createSourceService } from "./service.js";

export function registerWorkspaceSourceRoutes(router: Router, db: Db) {
  const sourceService = createSourceService(db);

  router.get("/:id/sources", async (req, res) => {
    try {
      const result = await sourceService.listWorkspaceSources(req.params.id);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      console.error("Failed to fetch workspace sources:", error);
      res.status(500).json({ error: "Failed to fetch workspace sources" });
    }
  });

  router.post("/:id/sources", async (req, res) => {
    try {
      const body = (req.body ?? {}) as Partial<CreateWorkspaceSourceInput>;
      const type = typeof body.type === "string" ? body.type.trim() : "";
      const allowedTypes = new Set(["webpage", "image", "video"]);

      if (!allowedTypes.has(type)) {
        res.status(422).json({ error: "type must be one of: webpage, image, video" });
        return;
      }

      const result = await sourceService.createWorkspaceSource(req.params.id, {
        type: type as CreateWorkspaceSourceInput["type"],
        title: typeof body.title === "string" ? body.title : null,
        summary: typeof body.summary === "string" ? body.summary : null,
        content: typeof body.content === "string" ? body.content : null,
        metadata:
          body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
            ? body.metadata
            : {},
      });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      if (error instanceof Error && error.message === "INVALID_SOURCE_URL") {
        res.status(422).json({ error: "Source URL must be a valid http or https link" });
        return;
      }
      if (error instanceof Error && error.message === "INVALID_VIDEO_URL") {
        res.status(422).json({ error: "Video source must be a valid YouTube link" });
        return;
      }
      if (error instanceof Error && error.message === "INVALID_IMAGE_SOURCE") {
        res.status(422).json({ error: "Image source must include a valid uploaded image file" });
        return;
      }
      if (error instanceof Error && error.message === "WEBPAGE_UNSUPPORTED_CONTENT_TYPE") {
        res.status(422).json({ error: "Webpage source must resolve to an HTML page" });
        return;
      }
      if (error instanceof Error && error.message === "WEBPAGE_EXTRACTION_EMPTY") {
        res.status(422).json({ error: "Could not extract readable content from this webpage" });
        return;
      }
      if (
        error instanceof Error &&
        (error.message === "WEBPAGE_FETCH_FAILED" || error.message === "VIDEO_FETCH_FAILED")
      ) {
        res.status(502).json({ error: "Failed to fetch remote source" });
        return;
      }
      console.error("Failed to create workspace source:", error);
      res.status(500).json({ error: "Failed to create workspace source" });
    }
  });

  router.get("/:id/sources/:sourceId", async (req, res) => {
    try {
      const result = await sourceService.getWorkspaceSource(req.params.id, req.params.sourceId);
      if (!result) {
        res.status(404).json({ error: "Source not found" });
        return;
      }
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      console.error("Failed to fetch workspace source:", error);
      res.status(500).json({ error: "Failed to fetch workspace source" });
    }
  });

  router.delete("/:id/sources/:sourceId", async (req, res) => {
    try {
      const deleted = await sourceService.deleteWorkspaceSource(req.params.id, req.params.sourceId);
      if (!deleted) {
        res.status(404).json({ error: "Source not found" });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      console.error("Failed to delete workspace source:", error);
      res.status(500).json({ error: "Failed to delete workspace source" });
    }
  });
}
