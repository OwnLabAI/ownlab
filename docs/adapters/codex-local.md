---
title: Codex Local
summary: OwnLab `codex_local` adapter setup and runtime model
---

The `codex_local` adapter runs OpenAI Codex CLI locally for an OwnLab agent.

In OwnLab, a Codex agent is:

- one long-lived `Agent` configuration
- one fixed human↔agent DM channel
- many conversation sessions inside that single DM channel
- one agent-scoped `CODEX_HOME`

`New Chat` creates a fresh conversation session. It does **not** create a new channel, and it does **not** create a new runtime home.

## Prerequisites

- Codex CLI installed (`codex` command available)
- Either:
  - `codex login` working for the agent runtime, or
  - `OPENAI_API_KEY` provided through adapter env or the server environment

## Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cwd` | string | Yes | Local project path where `codex exec` runs and edits files |
| `model` | string | No | Codex model to use |
| `promptTemplate` | string | No | Prompt template used for each execution |
| `env` | object | No | Extra environment variables for the Codex process |
| `timeoutSec` | number | No | Process timeout (`0` = no timeout) |
| `graceSec` | number | No | Grace period before force-kill |
| `dangerouslyBypassApprovalsAndSandbox` | boolean | No | Dev-only bypass flag |

## Runtime Model

OwnLab keeps these concerns separate:

- `Agent`
  - identity, role, agency, skills, model, project path
- `DM channel`
  - the permanent human↔agent message stream
- `Conversation session`
  - one context window inside the DM channel
- `CODEX_HOME`
  - the agent-scoped local Codex runtime directory

That means:

- sending a message runs one `codex exec`
- continuing the same conversation session reuses the saved Codex session id when available
- clicking `New Chat` starts a fresh conversation session in the same DM channel
- different agents are isolated from each other by agent-scoped runtime homes

## Agent Isolation

Each agent gets its own runtime home under OwnLab:

```text
~/.ownlab/instances/<instance>/agents/<agentId>/home/.codex
```

OwnLab seeds this home from the user’s global Codex home so authentication and base config can carry over, but it does not create a separate `CODEX_HOME` per chat session.

This keeps the isolation boundary where it belongs:

- isolated across agents
- shared within one agent
- independent from `New Chat`

## Conversation Sessions

Agent conversations use one DM channel plus multiple conversation sessions.

Each session stores:

- the logical session boundary in the DM channel
- the saved Codex session id / params
- a title and timestamps for history display

Messages are recorded against both:

- the fixed DM channel
- the active conversation session

So the UI can show clean history without creating extra channels or runtime folders.

## Skills

Skills are agent defaults, not hard-isolated per conversation.

OwnLab resolves the agent’s enabled skills and injects them into the adapter context on each execution. The Codex runtime can access the configured skill set for that agent, while conversation sessions stay lightweight.

## Environment Test

The OwnLab environment test checks:

- Codex CLI is installed and executable
- configured working directory is valid
- whether `OPENAI_API_KEY` is present as an auth signal
- a live hello probe using `codex exec --json -`

The hello probe helps catch the important failure mode where:

- the CLI exists
- the config looks fine
- but authentication is not actually usable in the OwnLab-managed runtime

## Recommended Setup

For a clean local Codex agent setup in OwnLab:

1. Create the agent.
2. Set the agent’s `Project Path` to the local repo or project directory.
3. Assign agency instructions and default skills.
4. Verify the environment test passes.
5. Use `New Chat` to start fresh conversation sessions without changing the agent runtime.
