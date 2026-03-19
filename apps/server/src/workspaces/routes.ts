import { Router, type Router as RouterType } from "express";
import type { Db } from "@ownlab/db";
import {
  channelMembers,
  channelMessages,
  channels,
  labs,
  tasks,
  workspaces,
  workspaceMembers,
  eq,
  asc,
  inArray,
} from "@ownlab/db";
import { createWorkspaceMembershipService } from "./membership-service.js";
import {
  createWorkspaceEntry,
  deleteWorkspaceEntry,
  listWorkspaceFolder,
  moveWorkspaceEntry,
  pickWorkspaceFolder,
  readWorkspaceFile,
  readWorkspaceFileRaw,
  renameWorkspaceEntry,
  validateWorkspaceRoot,
} from "./file-tree.js";

function isValidationError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    (error.message.includes("Workspace path") ||
      error.message.includes("absolute folder path") ||
      error.message.includes("folder") ||
      "code" in error)
  );
}

function getWorkspacePathErrorResponse(
  error: unknown
): { status: number; error: string } | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const code = "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
  if (code === "ENOENT") {
    return {
      status: 409,
      error: "Configured workspace folder does not exist. Re-link a local folder.",
    };
  }

  if (
    error.message.includes("Workspace path") ||
    error.message.includes("absolute folder path") ||
    error.message.includes("folder")
  ) {
    return {
      status: 409,
      error: error.message,
    };
  }

  return null;
}

async function getWorkspaceOrThrow(db: Db, workspaceId: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  if (!workspace.worktreePath?.trim()) {
    throw new Error("WORKSPACE_PATH_NOT_SET");
  }

  const rootPath = await validateWorkspaceRoot(workspace.worktreePath);

  return { workspace, rootPath };
}

export function workspaceRoutes(db: Db): RouterType {
  const router = Router();
  const membershipService = createWorkspaceMembershipService(db);

  // List workspaces (optionally by labId)
  router.get("/", async (req, res) => {
    try {
      const labId = req.query.labId as string | undefined;
      const query = db.select().from(workspaces).orderBy(asc(workspaces.createdAt));
      const result = labId ? await query.where(eq(workspaces.labId, labId)) : await query;
      res.json(result);
    } catch (error) {
      console.error("Failed to list workspaces:", error);
      res.status(500).json({ error: "Failed to list workspaces" });
    }
  });

  // Create workspace – ensures there is at least one lab and attaches workspace to it.
  router.post("/", async (req, res) => {
    try {
      const { name, description, worktreePath } = req.body as {
        name: string;
        description?: string | null;
        worktreePath?: string | null;
      };
      if (!name || !name.trim()) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      if (!worktreePath || !worktreePath.trim()) {
        res.status(400).json({ error: "worktreePath is required" });
        return;
      }

      // Pick an existing lab or create a default one.
      let [lab] = await db.select().from(labs).limit(1);
      if (!lab) {
        [lab] = await db
          .insert(labs)
          .values({
            name: "Default Lab",
            description: "Auto-created default lab",
          })
          .returning();
      }

      const trimmedName = name.trim();
      const normalizedWorktreePath = await validateWorkspaceRoot(worktreePath);
      const workspaceName = trimmedName;

      const [workspace] = await db
        .insert(workspaces)
        .values({
          labId: lab.id,
          name: workspaceName,
          description: description ?? null,
          worktreePath: normalizedWorktreePath,
        })
        .returning();

      await membershipService.ensureDefaultWorkspaceHumanMember(workspace.id);

      res.status(201).json(workspace);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(422).json({
          error:
            error.code === "ENOENT"
              ? "Workspace folder does not exist"
              : error.message,
        });
        return;
      }
      console.error("Failed to create workspace:", error);
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  // Update workspace name/description/status
  router.patch("/:id", async (req, res) => {
    try {
      const { name, description, status, worktreePath } = req.body as {
        name?: string;
        description?: string | null;
        status?: string;
        worktreePath?: string | null;
      };

      const updates: Partial<{
        name: string;
        description: string | null;
        status: string;
        worktreePath: string | null;
      }> = {};
      if (typeof name === "string" && name.trim()) updates.name = name.trim();
      if (description !== undefined) updates.description = description;
      if (typeof status === "string") updates.status = status;
      if (worktreePath !== undefined) {
        updates.worktreePath = worktreePath?.trim()
          ? await validateWorkspaceRoot(worktreePath)
          : null;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "No valid fields to update" });
        return;
      }

      const [updated] = await db
        .update(workspaces)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(workspaces.id, req.params.id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      res.json(updated);
    } catch (error) {
      if (isValidationError(error)) {
        res.status(422).json({
          error:
            error.code === "ENOENT"
              ? "Workspace folder does not exist"
              : error.message,
        });
        return;
      }
      console.error("Failed to update workspace:", error);
      res.status(500).json({ error: "Failed to update workspace" });
    }
  });

  // Get file tree for workspace (requires worktreePath to be set)
  router.get("/:id/file-tree", async (req, res) => {
    try {
      const { workspace, rootPath } = await getWorkspaceOrThrow(db, req.params.id);
      const tree = await listWorkspaceFolder(rootPath);
      res.json({
        rootName: workspace.name,
        rootPath,
        items: tree,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      const pathError = getWorkspacePathErrorResponse(error);
      if (pathError) {
        res.status(pathError.status).json({ error: pathError.error });
        return;
      }
      console.error("Failed to read workspace file tree:", error);
      res.status(500).json({ error: "Failed to read file tree" });
    }
  });

  // Get direct children of a folder (lazy tree). path= empty or omitted = root.
  router.get("/:id/folder-contents", async (req, res) => {
    try {
      const { rootPath } = await getWorkspaceOrThrow(db, req.params.id);
      const relativeDir = typeof req.query.path === "string" ? req.query.path : "";
      const tree = await listWorkspaceFolder(rootPath, relativeDir);
      res.json(tree);
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      const pathError = getWorkspacePathErrorResponse(error);
      if (pathError) {
        res.status(pathError.status).json({ error: pathError.error });
        return;
      }
      console.error("Failed to read folder contents:", error);
      res.status(500).json({ error: "Failed to read folder contents" });
    }
  });

  // Read file content (path = relative path, required)
  router.get("/:id/files/content", async (req, res) => {
    try {
      const { rootPath } = await getWorkspaceOrThrow(db, req.params.id);
      const relativePath = typeof req.query.path === "string" ? req.query.path : "";
      if (!relativePath) {
        res.status(400).json({ error: "path query is required" });
        return;
      }

      const normalizedPath = relativePath.toLowerCase();

      if (normalizedPath.endsWith(".pdf")) {
        const content = await readWorkspaceFileRaw(rootPath, relativePath);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline");
        res.send(content);
        return;
      }

      if (normalizedPath.endsWith(".png")) {
        const content = await readWorkspaceFileRaw(rootPath, relativePath);
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Disposition", "inline");
        res.send(content);
        return;
      }

      const content = await readWorkspaceFile(rootPath, relativePath);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(content);
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      const pathError = getWorkspacePathErrorResponse(error);
      if (pathError) {
        res.status(pathError.status).json({ error: pathError.error });
        return;
      }
      console.error("Failed to read file content:", error);
      res.status(500).json({ error: "Failed to read file" });
    }
  });

  // Create file or folder in workspace worktree
  router.post("/:id/files", async (req, res) => {
    try {
      const { rootPath } = await getWorkspaceOrThrow(db, req.params.id);
      const { path: relativePath, type } = req.body as {
        path?: string;
        type?: "file" | "folder";
      };
      if (!relativePath || typeof relativePath !== "string" || !type || (type !== "file" && type !== "folder")) {
        res.status(400).json({ error: "path (string) and type (file|folder) are required" });
        return;
      }
      await createWorkspaceEntry(rootPath, relativePath, type);
      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      const pathError = getWorkspacePathErrorResponse(error);
      if (pathError) {
        res.status(pathError.status).json({ error: pathError.error });
        return;
      }
      console.error("Failed to create file/folder:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to create file or folder",
      });
    }
  });

  // Rename file or folder (path = current relative path, newName = new name only)
  router.patch("/:id/files", async (req, res) => {
    try {
      const { rootPath } = await getWorkspaceOrThrow(db, req.params.id);
      const { path: relativePath, newName } = req.body as { path?: string; newName?: string };
      if (typeof relativePath !== "string" || !relativePath || typeof newName !== "string" || !newName.trim()) {
        res.status(400).json({ error: "path and newName are required" });
        return;
      }
      const result = await renameWorkspaceEntry(rootPath, relativePath, newName.trim());
      res.json({ ok: true, item: result });
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      const pathError = getWorkspacePathErrorResponse(error);
      if (pathError) {
        res.status(pathError.status).json({ error: pathError.error });
        return;
      }
      console.error("Failed to rename file/folder:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to rename",
      });
    }
  });

  // Delete file or folder (path = relative path)
  router.delete("/:id/files", async (req, res) => {
    try {
      const { rootPath } = await getWorkspaceOrThrow(db, req.params.id);
      const relativePath = typeof req.query.path === "string" ? req.query.path : "";
      if (!relativePath) {
        res.status(400).json({ error: "path query is required" });
        return;
      }
      await deleteWorkspaceEntry(rootPath, relativePath);
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
      const pathError = getWorkspacePathErrorResponse(error);
      if (pathError) {
        res.status(pathError.status).json({ error: pathError.error });
        return;
      }
      console.error("Failed to delete file/folder:", error);
      res.status(500).json({ error: "Failed to delete" });
    }
  });

  router.post("/:id/files/move", async (req, res) => {
    try {
      const { rootPath } = await getWorkspaceOrThrow(db, req.params.id);
      const { path: relativePath, destinationPath } = req.body as {
        path?: string;
        destinationPath?: string;
      };
      if (typeof relativePath !== "string" || !relativePath) {
        res.status(400).json({ error: "path is required" });
        return;
      }
      const result = await moveWorkspaceEntry(
        rootPath,
        relativePath,
        typeof destinationPath === "string" ? destinationPath : ""
      );
      res.json({ ok: true, item: result });
    } catch (error) {
      if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      if (error instanceof Error && error.message === "WORKSPACE_PATH_NOT_SET") {
        res.status(409).json({ error: "Workspace has no local folder configured" });
        return;
      }
      const pathError = getWorkspacePathErrorResponse(error);
      if (pathError) {
        res.status(pathError.status).json({ error: pathError.error });
        return;
      }
      console.error("Failed to move file/folder:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to move",
      });
    }
  });

  router.post("/browse-folder", async (_req, res) => {
    try {
      const result = await pickWorkspaceFolder();
      res.json(result);
    } catch (error) {
      console.error("Failed to browse for workspace folder:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to open folder picker",
      });
    }
  });

  router.get("/:id/members", async (req, res) => {
    try {
      const members = await membershipService.listWorkspaceMembers(req.params.id);
      res.json(members.map((member) => ({
        workspaceId: member.workspaceId,
        actorId: member.actorId,
        actorType: member.actorType,
        source: member.source,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        name: member.displayName,
        icon: member.icon,
        status: member.status,
      })));
    } catch (error) {
      console.error("Failed to list workspace members:", error);
      res.status(500).json({ error: "Failed to list workspace members" });
    }
  });

  router.post("/:id/members", async (req, res) => {
    try {
      const { actorId, actorType, role, displayName, icon } = req.body as {
        actorId?: string;
        actorType?: string;
        role?: string;
        displayName?: string | null;
        icon?: string | null;
      };

      if (!actorId || !actorId.trim()) {
        res.status(400).json({ error: "actorId is required" });
        return;
      }

      const member = await membershipService.addWorkspaceMember({
        workspaceId: req.params.id,
        actorId: actorId.trim(),
        actorType,
        role,
        displayName,
        icon,
      });

      const defaultChannelId = await membershipService.findDefaultWorkspaceChannelId(req.params.id);
      if (defaultChannelId) {
        await membershipService.syncDefaultWorkspaceChannelMembers(defaultChannelId, req.params.id);
      }

      res.status(201).json(member);
    } catch (error) {
      console.error("Failed to add workspace member:", error);
      if (error instanceof Error && error.message === "Workspace not found") {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === "Agent not found in workspace lab") {
        res.status(422).json({ error: error.message });
        return;
      }
      if (error instanceof Error && error.message === "Team-managed agents are included through their team workspace assignment") {
        res.status(422).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Failed to add workspace member" });
    }
  });

  router.delete("/:id/members/:actorId", async (req, res) => {
    try {
      const removed = await membershipService.removeWorkspaceMember(req.params.id, req.params.actorId);
      if (!removed) {
        res.status(404).json({ error: "Workspace member not found" });
        return;
      }

      const defaultChannelId = await membershipService.findDefaultWorkspaceChannelId(req.params.id);
      if (defaultChannelId) {
        await membershipService.syncDefaultWorkspaceChannelMembers(defaultChannelId, req.params.id);
      }

      res.status(204).send();
    } catch (error) {
      console.error("Failed to remove workspace member:", error);
      res.status(500).json({ error: "Failed to remove workspace member" });
    }
  });

  // Delete workspace
  router.delete("/:id", async (req, res) => {
    try {
      const deletedWorkspace = await db.transaction(async (tx) => {
        const [workspace] = await tx
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, req.params.id))
          .limit(1);

        if (!workspace) {
          return null;
        }

        const workspaceChannels = await tx
          .select({ id: channels.id })
          .from(channels)
          .where(eq(channels.workspaceId, workspace.id));
        const workspaceChannelIds = workspaceChannels.map((channel) => channel.id);

        if (workspaceChannelIds.length > 0) {
          await tx
            .delete(channelMessages)
            .where(inArray(channelMessages.channelId, workspaceChannelIds));

          await tx
            .delete(channelMembers)
            .where(inArray(channelMembers.channelId, workspaceChannelIds));

          await tx
            .delete(channels)
            .where(inArray(channels.id, workspaceChannelIds));
        }

        await tx
          .delete(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, workspace.id));

        await tx
          .update(tasks)
          .set({
            workspaceId: null,
            updatedAt: new Date(),
          })
          .where(eq(tasks.workspaceId, workspace.id));

        const [deleted] = await tx
          .delete(workspaces)
          .where(eq(workspaces.id, workspace.id))
          .returning();

        return deleted ?? null;
      });

      if (!deletedWorkspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Failed to delete workspace:", error);
      res.status(500).json({ error: "Failed to delete workspace" });
    }
  });

  return router;
}
