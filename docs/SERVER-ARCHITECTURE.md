# Server Architecture

This document defines the preferred server-side code organization for `apps/server`.

The goal is to keep the OwnLab API easy to extend as new product areas are added, while keeping request flow and business rules easy to trace.

## Goals

- Organize server code around product domains instead of technical layers.
- Keep request handling, business logic, and infrastructure responsibilities distinct.
- Make it obvious where new code should live.
- Reduce growth pressure on flat `routes/` and `services/` directories.
- Preserve a modular-monolith structure that can evolve without premature microservice complexity.

## Current Direction

The server is organized primarily by domain under `apps/server/src`:

```txt
apps/server/src/
  agency/
  agents/
  channels/
  heartbeat/
  tasks/
  workspaces/
  adapters/
  routes/
  app.ts
  index.ts
  home-paths.ts
```

The top-level domain folders represent product capabilities:

- `agency/`: agency profile materialization and template loading
- `agents/`: agent CRUD and adapter-facing agent operations
- `channels/`: channel APIs, channel chat orchestration, message persistence behavior
- `heartbeat/`: task invocation runs and execution lifecycle
- `tasks/`: tasks and taskboard APIs
- `workspaces/`: workspace APIs and filesystem-backed workspace utilities

The remaining top-level folders are infrastructure or cross-cutting code:

- `adapters/`: adapter registry and local process integration
- `routes/`: temporary location for routes not yet assigned to a domain, such as `skills`

## Why Domain-First Organization

OwnLab has clear core entities: labs, workspaces, channels, agents, tasks, and heartbeat runs.

Because these are stable product concepts, the codebase scales better when each concept owns its local HTTP handlers and business logic. This is preferable to a flat structure like:

```txt
src/routes/*.ts
src/services/*.ts
```

Flat technical folders are easy at the beginning, but they become harder to navigate as the system grows:

- related code gets split across distant directories
- service files become broad and uneven in scope
- route files often start to absorb business logic
- it becomes unclear where validation, persistence logic, and orchestration belong

Domain folders make change surfaces smaller and easier to reason about.

## Domain Folder Conventions

Each domain folder should keep related files together. Use only the files that the domain actually needs.

Typical structure:

```txt
src/<domain>/
  routes.ts
  service.ts
  repo.ts
  validation.ts
  types.ts
```

Not every domain needs every file on day one. Start small and add files only when there is clear pressure.

Current examples:

- `channels/routes.ts`: REST endpoints for channels and membership
- `channels/message-routes.ts`: channel-first message and response endpoints
- `channels/service.ts`: channel CRUD and membership-oriented behavior
- `channels/message-service.ts`: message persistence and hydration
- `channels/routing-service.ts`: participant selection and channel resolution
- `channels/delivery-service.ts`: agent delivery execution and response write-back
- `channels/chat-service.ts`: compatibility orchestration for legacy channel-chat flows
- `workspaces/routes.ts`: workspace APIs
- `workspaces/file-tree.ts`: workspace filesystem utilities

## Responsibility Boundaries

Use the following rules when deciding where code belongs.

### `routes.ts`

Routes should handle HTTP concerns only:

- define URL paths
- read params, query, and request bodies
- validate required inputs
- map business errors to HTTP status codes
- return JSON responses

Routes should not accumulate complex business rules or large database query blocks.

### `service.ts`

Services should hold domain behavior:

- business rules
- orchestration across multiple reads/writes
- domain invariants
- coordination with adapters or other domains

Examples:

- ensuring a default workspace channel exists
- invoking a task heartbeat run
- deciding which agent should answer in channel chat

### Channel Logic

Channels are a special case in OwnLab because every dialog surface is backed by a `Channel`.

The architecture rule is:

```txt
channel -> messages -> routing -> delivery -> agent runtime
```

This means:

- `channels/service.ts` owns channel CRUD, scope helpers, and membership basics
- `channels/message-service.ts` owns storing and hydrating messages
- `channels/routing-service.ts` decides which agents are candidates to respond
- `channels/delivery-service.ts` runs those deliveries and writes agent messages back
- `channels/chat-service.ts` is only an orchestrator or compatibility layer

The important boundary is that message creation and agent execution are no longer the same concern.

For any new humans-agents discussion surface, prefer channel-first APIs such as:

- `POST /api/channels/:channelId/messages`
- `POST /api/channels/:channelId/messages/respond`
- `POST /api/channels/:channelId/messages/respond/stream`

Legacy top-level chat endpoints may remain temporarily for compatibility, but new code should treat channels as the source of truth.

### `repo.ts`

Add a `repo.ts` file when persistence logic becomes large or repeated.

Repositories should contain:

- database query composition
- table joins and filtering details
- persistence helpers used by one domain

Do not introduce repositories too early. Add them when service files start mixing rules and heavy query logic.

### `validation.ts`

Validation files should define reusable input validation for:

- request bodies
- query params
- route params
- domain-specific parsing helpers

Use shared validators and types from `@ownlab/shared` where possible.

### `types.ts`

Use `types.ts` for domain-local types that do not belong in `@ownlab/shared`.

If a type is part of a cross-layer contract between server, web, and shared packages, move it into `packages/shared`.

## Dependency Direction

Keep dependencies flowing in a predictable direction:

```txt
route -> service -> repo/infrastructure
```

Preferred rules:

- routes may import services and validation helpers
- services may import repositories, shared utilities, adapters, and domain helpers
- repositories should not import route code
- infrastructure should not depend on route handlers

Avoid circular dependencies between domains. If two domains need the same behavior, extract a small shared helper or move the ownership decision to the more appropriate domain.

## Cross-Domain Collaboration

Some flows naturally span multiple domains. That is expected in a modular monolith.

Examples in OwnLab:

- `heartbeat` may use `channels` to post execution summaries
- `channels` may use `agency` data to enrich prompts
- `agents` may depend on `adapters` to list models or test environments

This is acceptable when:

- the ownership of the flow is clear
- the dependency is one-way
- the imported behavior is stable and intentional

If the same cross-domain pattern appears repeatedly, introduce a clearer abstraction instead of letting implicit coupling spread.

## Placement Rules For New Code

When adding a new feature, decide placement with these questions:

1. Which product concept owns this behavior?
2. Is this request/response handling, domain logic, or infrastructure support?
3. Does the code belong to a single domain, or is it a reusable cross-cutting utility?

Use these defaults:

- new agent behavior goes in `src/agents`
- new channel and message behavior goes in `src/channels`
- new task and taskboard behavior goes in `src/tasks`
- new workspace and worktree behavior goes in `src/workspaces`
- new agency profile behavior goes in `src/agency`
- adapter integration code goes in `src/adapters`

If a feature does not clearly belong anywhere yet, do not hide it in a global utility folder. Pause and decide ownership first.

## Transitional Areas

`src/routes/skills.ts` is still outside a domain folder. This is acceptable temporarily.

When a capability becomes more substantial, move it into its own domain folder instead of expanding the temporary top-level route area.

Good future candidates may include:

- `skills/`
- `labs/`
- `taskboards/` if board behavior grows beyond the current `tasks` grouping

## Refactoring Guidelines

When restructuring server code:

- preserve API paths unless the product contract is intentionally changing
- prefer moving files before rewriting behavior
- update imports and app wiring first
- verify with typecheck before doing deeper cleanup
- avoid mixing architecture changes with unrelated product changes

Recommended sequence:

1. Move routes and services into the target domain folder.
2. Update `app.ts` imports.
3. Fix internal imports.
4. Run typecheck.
5. Extract `repo.ts` or `validation.ts` only where needed.

## Definition Of A Good Server Module

A server module is in good shape when:

- its files are easy to discover from the owning domain name
- request flow is easy to trace from route to business logic
- business rules are not buried in route handlers
- persistence details are not scattered across unrelated files
- new contributors can guess where new code should go without asking

## Summary

OwnLab should continue as a domain-organized modular monolith.

The main rule is simple:

- organize by business domain first
- split by technical responsibility inside the domain only when necessary

This keeps the architecture clear today and gives the codebase room to grow without returning to flat, overloaded top-level folders.
