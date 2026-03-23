# OwnLab BoxLite Sandbox Plan

Status: Draft  
Date: 2026-03-23

## Goal

Move OwnLab from "workspace as cwd" to "workspace as enforced execution boundary" by introducing a sandbox backend, with BoxLite as the target long-term runtime for workspace-bound agents.

## Why This Plan Exists

Today, local adapters such as `codex_local` run on the host machine. Even when OwnLab points the agent at a workspace directory, that only changes the working directory. It does not stop the process from reading or modifying other host paths that the current OS user can access.

That is acceptable only as a temporary host-mode workflow. It is not strong workspace isolation.

## Current State

- Workspace chat runs and task runs resolve a workspace `cwd`.
- Workspace file APIs already enforce `outside workspace root` path checks.
- Local adapter execution does not have an OS-enforced filesystem boundary.
- `git worktree` is useful for execution copies, but it is not a security boundary.

## Desired End State

For workspace-bound agents:

- the agent can only see the mounted workspace and explicitly granted support paths
- agent home, tool home, temp space, and skills are isolated per agent or per run
- host paths outside allowed mounts are invisible
- network is disabled by default and enabled intentionally
- the same abstraction works across `codex_local`, `claude_local`, `cursor`, `gemini_local`, and future adapters

## Proposed Architecture

Introduce a unified sandbox layer between adapters and process execution.

### 1. New runtime abstraction

Add a shared execution interface in `packages/adapter-utils`, for example:

- `ExecutionIsolationPolicy`
- `runIsolatedProcess()`
- `SandboxBackend`

Suggested policy shape:

- `mode`: `host` | `boxlite`
- `workspaceRoot`
- `cwd`
- `writableRoots`
- `readOnlyRoots`
- `agentHome`
- `toolHome`
- `tempDir`
- `networkPolicy`
- `resourceLimits`
- `envPolicy`

### 2. Adapter responsibility split

Adapters should only define:

- command
- args
- env additions
- session metadata
- adapter-specific preparation

Adapters should no longer directly decide host execution privileges.

### 3. BoxLite backend

Implement a BoxLite-backed sandbox runner that:

- creates or reuses a Box per workspace or per agent policy
- mounts the workspace into `/workspace`
- mounts isolated agent state into `/agent-home`
- mounts isolated tool state into adapter-specific homes such as `/codex-home`
- mounts skills read-only
- starts the adapter command with `cwd=/workspace`

### 4. Security defaults

For workspace-bound agents:

- network off by default
- explicit allowlist or per-agent opt-in for outbound access
- CPU, memory, and process-count limits enabled
- environment sanitization enabled

## Rollout Phases

## Phase 0: Host-mode hardening

Purpose: reduce risk before BoxLite lands.

- keep workspace-bound runs pinned to resolved workspace roots
- disable unsafe bypass defaults
- make `host mode` explicit in UI and logs
- add audit fields that show execution mode and effective workspace

## Phase 1: Sandbox abstraction

Files likely involved:

- `packages/adapter-utils/src/types.ts`
- `packages/adapter-utils/src/server-utils.ts`
- `apps/server/src/agents/runtime-context.ts`
- adapter execute entrypoints under `packages/adapters/*/src/server/execute.ts`

Deliverables:

- new isolation policy types
- `runIsolatedProcess()` API
- `host` backend preserving current behavior

## Phase 2: BoxLite proof of concept

Target adapter:

- `codex_local`

Deliverables:

- BoxLite runner module
- workspace mount mapping
- isolated `CODEX_HOME`
- isolated `AGENT_HOME`
- basic stdout/stderr streaming
- timeout and kill handling

Success criteria:

- agent can operate on files inside workspace
- agent cannot inspect sibling workspace or user home paths
- sessions and skills still function

## Phase 3: Generalize to other adapters

Adapters to migrate after Codex:

- `claude_local`
- `cursor`
- `gemini_local`
- `opencode_local`

Deliverables:

- adapter-specific home mapping
- sandbox-compatible environment tests
- common sandbox telemetry

## Phase 4: Product and policy controls

Add operator-facing settings:

- execution mode: `host` or `sandboxed`
- network policy
- resource profile
- workspace isolation policy

Potential persistence additions:

- agent or workspace runtime policy fields
- execution mode on run records
- sandbox metadata on session records

## Open Design Questions

1. Reuse model

- one Box per run
- one Box per agent
- one Box per workspace

Recommendation:

- start with one Box per run for the clearest boundary
- evaluate reuse later for performance

2. Auth material

- decide how CLI auth is injected into the box
- avoid binding the full host home directory

Recommendation:

- isolate adapter homes and copy only the minimal auth/config files required

3. Workspace strategy interaction

- `git worktree` should remain available
- BoxLite should mount the realized execution workspace, not replace execution workspace logic

Recommendation:

- keep `execution workspace` and `sandbox` as separate layers
- order: realize worktree first, then sandbox that worktree

## Validation Checklist

- `pwd` reports the mounted workspace
- reading workspace files succeeds
- writing workspace files succeeds
- reading `~/.ssh`, sibling repos, or parent folders fails
- symlink escape attempts fail
- timeout and cancellation work
- session resume still respects workspace identity
- skills remain usable inside the sandbox

## Recommended Implementation Order

1. keep current host-mode fix shipped
2. add sandbox abstractions with a host backend
3. integrate BoxLite for `codex_local`
4. add tests that prove cross-workspace isolation
5. migrate remaining local adapters

## Non-Goals For First BoxLite Milestone

- full UI policy editor
- perfect hot reuse of long-lived boxes
- migrating every adapter in one PR
- replacing worktree logic
