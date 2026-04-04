<p>
  <img src="./apps/web/public/logo-name.svg" alt="OwnLab" width="180" />
</p>

[简体中文](./README_CN.md)

OwnLab is an open-source platform for humans-agents collaboration.

## What OwnLab Is For

- ✅ If you want to build an automated lab,
- ✅ If you want to build an automated company,
- ✅ If you want to build an automated engineering team,
- ✅ If you want all of the above at the same time, you should use OwnLab.

## Features

<table>
  <tr>
    <td valign="top" width="50%">
      <strong>Workspaces</strong><br />
      Talk with multiple agents in one channel and get work done together.
      <br /><br />
      <img src="./docs/assets/workspace.png" alt="OwnLab workspace" />
    </td>
    <td valign="top" width="50%">
      <strong>Agents</strong><br />
      Build different runtimes and inject them with real agency and skills.
      <br /><br />
      <img src="./docs/assets/agent.png" alt="OwnLab agents" />
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <strong>Teams</strong><br />
      Organize agents into teams with leaders and workers.
      <br /><br />
      <img src="./docs/assets/team.png" alt="OwnLab teams" />
    </td>
    <td valign="top" width="50%">
      <strong>Tasks</strong><br />
      Delegate scheduled or automatic work to agents and teams.
      <br /><br />
      <img src="./docs/assets/task.png" alt="OwnLab tasks" />
    </td>
  </tr>
</table>


## Quickstart

Requirements:

- Node.js `20+`
- pnpm `9.15+`

Install and start the full stack:

```bash
git clone https://github.com/OwnLabAI/ownlab.git
cd ownlab
pnpm install
pnpm dev
```

This starts:

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
│   ├── web/           # Next.js UI for labs, workspaces, tasks, and agents
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
pnpm dev
pnpm dev:server
pnpm dev:web
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
