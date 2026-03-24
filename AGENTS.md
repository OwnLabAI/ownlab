# AGENTS.md

Guidance for human and AI contributors working in the `ownlab` repository.

## 1. Purpose

OwnLab is a local-first orchestration system for AI labs.

Today, the repository provides:

- an Express API server for agents, teams, workspaces, channels, tasks, taskboards, skills, search, and heartbeat runs
- a Next.js web UI for operating the lab
- a PostgreSQL data layer built with Drizzle
- a set of local and gateway agent adapters

This file explains how to navigate the codebase and how to make changes without breaking cross-layer contracts.

## 2. Start From Code

For non-trivial work, build context from the current implementation first.

Recommended reading order:

1. `README.md`
2. `package.json`
3. `apps/server/src/app.ts`
4. `apps/server/src/index.ts`
5. `apps/web/src/app/`
6. `packages/db/src/schema/index.ts`
7. `packages/shared/src/index.ts`

Then follow the feature area you are changing:

- agents: `apps/server/src/agents/*`, `apps/web/src/features/agents/*`
- teams: `apps/server/src/teams/*`, `apps/web/src/features/teams/*`
- channels/chat: `apps/server/src/channels/*`, `apps/web/src/features/channels/*`
- tasks/taskboards: `apps/server/src/tasks/*`, `apps/web/src/features/tasks/*`
- workspace/files: `apps/server/src/workspace/*`, `apps/web/src/features/workspace/*`
- skills: `apps/server/src/skills/*`, `apps/web/src/features/skills/*`

Do not assume older docs reflect current behavior. Prefer the running code, route definitions, schema, and UI entrypoints.

## 3. Repo Map

- `apps/server/`: Express API, orchestration services, adapter registry, scheduling, runtime wiring
- `apps/web/`: Next.js 16 app and feature UI for the lab surface
- `packages/db/`: Drizzle schema, migrations, DB client, migration helpers, backups
- `packages/shared/`: shared constants, exported types, and chat/channel contracts
- `packages/adapter-utils/`: shared adapter helpers
- `packages/adapters/*`: adapter implementations for supported runtimes
- `ods/`: external references, examples, and experiments; not the source of truth for current OwnLab behavior

Naming convention:

- apps live under `apps/<name>` and use package names like `@ownlab/<name>`
- packages live under `packages/<name>` and use package names like `@ownlab/<name>`

## 4. Current Product Model

OwnLab currently revolves around these core entities:

- `Lab`: top-level ownership scope
- `Workspace`: a linked local folder with membership and channels
- `Agent`: a configured runtime instance
- `Team`: a group of agents with membership and optional workspace binding
- `Taskboard`: a board that groups tasks
- `Task`: a work item assignable to an agent or team
- `Channel`: the shared conversation model across the product
- `ChannelMessage`: persisted conversation messages and agent replies
- `HeartbeatRun`: an execution record for task-triggered work
- `Skill`: a lab-managed capability assignable to agents

Important design reality:

- OwnLab is channel-first for conversation surfaces.
- OwnLab is workspace-first for actual file-backed execution context.
- OwnLab is not just an agent list; teams, tasks, taskboards, skills, and scheduled runs are part of the current product shape.

## 5. Development Setup

OwnLab defaults to embedded PostgreSQL in development when `DATABASE_URL` is not set.

Basic dev loop:

```sh
pnpm install
pnpm dev
```

This starts:

- API server: `http://localhost:3100`
- Web UI: `http://localhost:3000`

Useful checks:

```sh
curl http://localhost:3100/health
curl http://localhost:3100/api/agents
curl http://localhost:3100/api/workspace
```

Use external PostgreSQL if needed:

```sh
export DATABASE_URL="postgres://ownlab:ownlab@localhost:5432/ownlab"
pnpm dev
```

Reset embedded development data:

```sh
rm -rf ~/.ownlab/instances/default/db
pnpm dev
```

## 6. Core Engineering Rules

1. Keep cross-layer contracts synchronized.

- If you change schema or behavior, update all affected layers:
- `packages/db`
- `packages/shared`
- `apps/server`
- `apps/web`

2. Treat code as the source of truth.

- Route names, entity names, and capabilities in docs or comments must match the implementation in `apps/server/src/app.ts` and the feature code.
- Do not introduce new terminology for existing core entities unless you are intentionally migrating the product model.

3. Preserve scope boundaries.

- Labs own the main entities.
- Workspaces should remain clear filesystem-backed units.
- Channels should remain scoped to a concrete surface such as workspace, agent DM, team, or task.

4. Keep write flows traceable.

- A state-changing flow should be understandable from UI action to API route to service layer to DB write.
- Prefer explicit service functions over hidden side effects.

5. Prefer additive evolution.

- Extend the current model where possible.
- Do not replace stable behavior or rename major concepts casually.

6. Validate and fail clearly.

- API routes should validate input and return predictable JSON error bodies.
- UI should surface failures instead of swallowing them.

## 7. API Expectations

Base path: `/api`

Current top-level API groups:

- `/api/agents`
- `/api/teams`
- `/api/workspace`
- `/api/channels`
- `/api/taskboards`
- `/api/tasks`
- `/api/channel-chat`
- `/api/heartbeat`
- `/api/skills`
- `/api/search`

Health endpoint:

- `/health`

When adding or changing endpoints:

- keep naming aligned with existing route groups
- use consistent error statuses such as `400`, `404`, `409`, `422`, `500`
- keep response shapes stable unless you also update the web client
- prefer feature-local route files plus service files over large monolithic handlers

## 8. Channel-First Rule

In OwnLab, every serious chat or discussion surface should map to a `Channel`.

Current channel scopes in the product include:

- workspace chat
- agent DMs
- team chat
- task discussion

Implications:

- do not invent a parallel chat persistence model for a new surface
- use `channels` and `channel_messages`
- use helper flows such as ensure-default, ensure-agent-dm, ensure-task, and ensure-team when appropriate
- if a conversation needs agent-specific continuity, use conversation sessions on top of the channel model rather than bypassing it

## 9. Workspace and Filesystem Rules

Workspaces are not abstract labels. They point to real local folders.

When changing workspace behavior:

- preserve absolute-path validation and workspace root safety checks
- keep file operations constrained to the configured workspace root
- think through missing-folder and invalid-path error states
- reflect filesystem capabilities consistently in both server APIs and UI behavior

If you add a new file operation, make sure the route, validation, and UI affordance all line up.

## 10. Tasks, Teams, and Execution Rules

Tasks are the main execution primitive.

Current behavior to preserve:

- tasks can belong to taskboards
- tasks can target an agent or a team
- tasks can be run directly
- some tasks can be scheduled and invoked through the heartbeat service
- heartbeat runs are the persisted execution record

Teams are first-class entities, not presentation-only groupings.

When changing task or team behavior:

- keep assignee semantics explicit
- keep scheduling and heartbeat behavior coherent
- make sure deletions and cascades are thought through across channels, runs, and membership

## 11. Database Change Workflow

When changing the data model:

1. Edit the relevant file in `packages/db/src/schema/`
2. Export new schema from `packages/db/src/schema/index.ts`
3. Update affected shared types if needed
4. Generate a migration:

```sh
pnpm --filter @ownlab/db generate
```

5. Apply migrations when using an external database:

```sh
pnpm --filter @ownlab/db migrate
```

6. Validate the repo still compiles:

```sh
pnpm typecheck
```

Notes:

- commit Drizzle migrations
- embedded PostgreSQL applies migrations automatically on server startup

## 12. Web UI Expectations

- keep navigation aligned with actual server capabilities
- prefer shared contracts from `@ownlab/shared` when available
- avoid inventing UI-only core entities when the server already models the concept
- preserve the lab surface shape: workspaces, agents, teams, tasks, skills, and channels should feel like one system
- when changing API responses, update `apps/web/src/lib/api.ts` and any affected feature components

## 13. Definition of Done

A change is done when:

1. behavior matches the current codebase model
2. schema, server, shared exports, and web client are in sync
3. relevant commands pass:

```sh
pnpm typecheck
pnpm build
```

4. tests are updated or added when behavior changes materially
5. user-facing docs such as `README.md` are updated when setup, routes, or product behavior changes
