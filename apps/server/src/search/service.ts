import type { Db } from "@ownlab/db";
import {
  agents,
  desc,
  ilike,
  or,
  taskboards,
  tasks,
  workspaces,
  eq,
} from "@ownlab/db";

export interface SearchAgentResult {
  id: string;
  name: string;
  icon: string | null;
  status: string;
}

export interface SearchWorkspaceResult {
  id: string;
  name: string;
  description: string | null;
  worktreePath: string | null;
  status: string;
}

export interface SearchTaskResult {
  id: string;
  title: string;
  identifier: string | null;
  objective: string | null;
  description: string | null;
  status: string;
  boardId: string | null;
  boardName: string | null;
}

export interface SearchResponse {
  query: string;
  agents: SearchAgentResult[];
  workspaces: SearchWorkspaceResult[];
  tasks: SearchTaskResult[];
}

export function createSearchService(db: Db) {
  async function searchAll(input: {
    query: string;
    limit?: number;
  }): Promise<SearchResponse> {
    const query = input.query.trim();
    const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);

    if (query.length === 0) {
      return {
        query,
        agents: [],
        workspaces: [],
        tasks: [],
      };
    }

    const pattern = `%${query}%`;

    const [agentRows, workspaceRows, taskRows] = await Promise.all([
      db
        .select({
          id: agents.id,
          name: agents.name,
          icon: agents.icon,
          status: agents.status,
        })
        .from(agents)
        .where(
          or(
            ilike(agents.name, pattern),
            ilike(agents.role, pattern),
            ilike(agents.title, pattern),
            ilike(agents.capabilities, pattern),
          ),
        )
        .orderBy(desc(agents.updatedAt))
        .limit(limit),
      db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          description: workspaces.description,
          worktreePath: workspaces.worktreePath,
          status: workspaces.status,
        })
        .from(workspaces)
        .where(
          or(
            ilike(workspaces.name, pattern),
            ilike(workspaces.description, pattern),
            ilike(workspaces.worktreePath, pattern),
          ),
        )
        .orderBy(desc(workspaces.updatedAt))
        .limit(limit),
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          identifier: tasks.identifier,
          objective: tasks.objective,
          description: tasks.description,
          status: tasks.status,
          boardId: tasks.boardId,
          boardName: taskboards.name,
        })
        .from(tasks)
        .leftJoin(taskboards, eq(tasks.boardId, taskboards.id))
        .where(
          or(
            ilike(tasks.title, pattern),
            ilike(tasks.identifier, pattern),
            ilike(tasks.objective, pattern),
            ilike(tasks.description, pattern),
            ilike(taskboards.name, pattern),
          ),
        )
        .orderBy(desc(tasks.updatedAt))
        .limit(limit),
    ]);

    return {
      query,
      agents: agentRows,
      workspaces: workspaceRows,
      tasks: taskRows,
    };
  }

  return {
    searchAll,
  };
}
