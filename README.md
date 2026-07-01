<p align="center">
  <img src="./docs/assets/logo-name.svg" alt="OwnLab" width="220" />
</p>

<p align="center">
  <strong>An open-source AI science workbench for labs, researchers, and agentic research teams.</strong>
</p>

<p align="center">
  <a href="./README_CN.md">简体中文</a>
</p>

<p align="center">
  <img src="./apps/www/public/app-light.png" alt="OwnLab app preview" width="860" />
</p>

OwnLab is an open-source, desktop-first AI workbench for scientific and technical work. It brings workspaces, specialist agents, reusable skills, tasks, files, code, and reproducible artifacts into one local-first environment.

## What OwnLab Is For

- ✅ If you want an open-source alternative to a [Claude Science-style AI workbench](https://www.anthropic.com/news/claude-science-ai-workbench),
- ✅ If you want agents that can read papers, inspect files, write code, run tools, and produce auditable research artifacts,
- ✅ If you want to turn lab protocols, analysis pipelines, literature review workflows, and domain knowledge into reusable skills,
- ✅ If you want to coordinate specialist agents across research, engineering, data analysis, writing, review, and operations,
- ✅ If you want a local-first workspace where sensitive datasets and project context can stay on your own machine or infrastructure,
- ✅ If you want to build an automated lab, an automated engineering team, or an automated company, you should use OwnLab.

## Features

|                                                                                     |                                                                                  |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Workspaces** Bring files, conversations, tools, channels, and artifacts together. | **Agents** Build specialist runtimes with skills, memory, tools, and agency. |
| **Teams** Organize agents into research groups with leaders, reviewers, and workers. | **Tasks** Delegate scheduled, long-running, or automatic work to agents and teams. |

## Product Preview

| Workspace | Agents |
| --- | --- |
| ![Workspace](./docs/assets/workspace.png) | ![Agents](./docs/assets/agent.png) |

| Teams | Tasks |
| --- | --- |
| ![Teams](./docs/assets/team.png) | ![Tasks](./docs/assets/task.png) |

## Why OwnLab

Modern research is fragmented across papers, notebooks, databases, terminals, scripts, cloud compute, team chats, and manuscript tools. OwnLab is designed to make that work feel like one continuous research environment:

- Run multi-step research workflows with agents that can plan, execute, review, and iterate.
- Produce artifacts with enough context to understand how they were made.
- Use skills to package protocols, analysis methods, domain playbooks, and lab-specific workflows.
- Keep the desktop app as the primary experience while still exposing a web app, API server, and CLI for development.


## Quickstart

Requirements:

- Node.js `20+`
- pnpm `9.15+`

Install dependencies:

```bash
git clone https://github.com/OwnLabAI/ownlab.git
cd ownlab
pnpm install
```

Run OwnLab Desktop in development:

```bash
pnpm dev:desktop
```

This is the recommended way to use OwnLab locally. The desktop app hosts the full product experience and manages the local runtime for you.

If you are working on the web and server separately, you can still start the browser-based dev stack:

```bash
pnpm dev
```

That starts:

- Web UI: `http://localhost:3000`
- API server: `http://localhost:3100`

Quick health checks:

```bash
curl http://localhost:3100/health
curl http://localhost:3100/api/agents
curl http://localhost:3100/api/workspace
```

CLI (from repo root, dev / no build):

```bash
pnpm ownlab --help
pnpm ownlab health
```

After `pnpm --filter ./apps/cli build`, you can run the bundled binary with `pnpm ownlab:run -- health` or `pnpm --filter ./apps/cli exec node dist/index.js` from `apps/cli`.

By default, OwnLab uses an embedded PostgreSQL instance in development when `DATABASE_URL` is not set.

To use an external database instead:

```bash
export DATABASE_URL="postgres://ownlab:ownlab@localhost:5432/ownlab"
pnpm dev
```

## API Surface

The API is mounted under `/api` with routes such as:

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

```bash
GET /health
```

## Repo Map

```text
ownlab/
├── apps/
│   ├── server/        # Express API and orchestration services
│   ├── app/           # Next.js app runtime used by OwnLab Desktop
│   ├── desktop/       # Electron desktop shell (recommended user experience)
│   └── cli/           # `ownlab` CLI (Commander + esbuild)
├── packages/
│   ├── db/            # Drizzle schema, migrations, DB runtime
│   ├── shared/        # Shared types, constants, validation helpers
│   ├── adapter-utils/ # Shared adapter helpers
│   └── adapters/      # Agent adapter packages
├── docs/              # Architecture, deployment, and supporting docs
├── ods/               # Product slices, examples, and design notes
├── package.json
└── pnpm-workspace.yaml
```

## Development

Common commands:

```bash
pnpm dev:desktop
pnpm dev
pnpm dev:server
pnpm dev:app
pnpm build:desktop
pnpm dist:desktop
pnpm build
pnpm typecheck
pnpm test:run
pnpm db:generate
pnpm db:migrate
pnpm ownlab --help
```

## Roadmap

- ⚪ Support more agent runtimes
- ⚪ More flexible team configuration
- ⚪ Support auto mode in tasks, such as auto-research
- ⚪ Automatically create tasks
- ⚪ Better docs
