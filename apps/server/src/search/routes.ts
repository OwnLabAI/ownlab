import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import { createSearchService } from "./service.js";

export function searchRoutes(db: Db): RouterType {
  const router = Router();
  const service = createSearchService(db);

  router.get("/", async (req, res) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
      const results = await service.searchAll({ query, limit });
      res.json(results);
    } catch (error) {
      console.error("Failed to search entities:", error);
      res.status(500).json({ error: "Failed to search entities" });
    }
  });

  return router;
}
