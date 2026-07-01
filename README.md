[简体中文](./README_CN.md)

OwnLab is an open-source desktop-first platform for humans-agents collaboration.

## What OwnLab Is For

- ✅ If you want to build an automated lab,
- ✅ If you want to build an automated company,
- ✅ If you want to build an automated engineering team,
- ✅ If you want all of the above at the same time, you should use OwnLab.

## Features


|                                                                                     |                                                                                  |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Workspaces** Talk with multiple agents in one channel and get work done together. | **Agents** Build different runtimes and inject them with real agency and skills. |
| **Teams** Organize agents into teams with leaders and workers.                      | **Tasks** Delegate scheduled or automatic work to agents and teams.              |


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

