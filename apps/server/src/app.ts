import express, { type Express } from "express";
import cors from "cors";
import type { Db } from "@ownlab/db";
import { agentRoutes } from "./agents/routes.js";
import { channelRoutes } from "./channels/routes.js";
import { workspaceRoutes } from "./workspaces/routes.js";
import { taskboardRoutes } from "./tasks/taskboard-routes.js";
import { taskRoutes } from "./tasks/routes.js";
import { chatRoutes } from "./channels/chat-routes.js";
import { heartbeatRoutes } from "./heartbeat/routes.js";
import { skillRoutes } from "./skills/routes.js";
import { searchRoutes } from "./search/routes.js";
import { teamRoutes } from "./teams/routes.js";

export function createApp(db: Db): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "25mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "ownlab-server" });
  });

  app.use("/api/agents", agentRoutes(db));
  app.use("/api/teams", teamRoutes(db));
  app.use("/api/workspaces", workspaceRoutes(db));
  app.use("/api/channels", channelRoutes(db));
  app.use("/api/taskboards", taskboardRoutes(db));
  app.use("/api/tasks", taskRoutes(db));
  app.use("/api/channel-chat", chatRoutes(db));
  app.use("/api/heartbeat", heartbeatRoutes(db));
  app.use("/api/skills", skillRoutes(db));
  app.use("/api/search", searchRoutes(db));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (
      error &&
      typeof error === "object" &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      console.error("Request body too large:", error);
      res.status(413).json({
        error: "Attachment payload is too large. Please use a smaller file.",
      });
      return;
    }

    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status === "number"
    ) {
      console.error("Request parsing failed:", error);
      res.status(error.status).json({
        error:
          "message" in error && typeof error.message === "string"
            ? error.message
            : "Request parsing failed",
      });
      return;
    }

    if (error) {
      console.error("Unhandled app error:", error);
    }
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
