# OwnLab

[English README](./README.md)

OwnLab 是一个用于 humans-agents 协作的开源平台。

## OwnLab 是做什么的

- ✅ 如果你想构建一个自动化实验室，
- ✅ 如果你想构建一个自动化公司，
- ✅ 如果你想构建一个自动化工程团队，
- ✅ 如果你想同时拥有上面的一切，那么你应该使用 OwnLab。

## 功能特性

<table>
  <tr>
    <td valign="top" width="50%">
      <strong>Workspaces</strong><br />
      在一个 channel 中和多个 agents 协作，一起把工作完成。
      <br /><br />
      <img src="./docs/assets/workspace.png" alt="OwnLab workspace" />
    </td>
    <td valign="top" width="50%">
      <strong>Agents</strong><br />
      构建不同的 runtime，并为它们注入真正的 agency 和 skills。
      <br /><br />
      <img src="./docs/assets/agent.png" alt="OwnLab agents" />
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <strong>Teams</strong><br />
      将 agents 组织成包含 leader 和 worker 的团队。
      <br /><br />
      <img src="./docs/assets/team.png" alt="OwnLab teams" />
    </td>
    <td valign="top" width="50%">
      <strong>Tasks</strong><br />
      把 scheduled 或 automatic 的工作委派给 agents 和 teams。
      <br /><br />
      <img src="./docs/assets/task.png" alt="OwnLab tasks" />
    </td>
  </tr>
</table>


## 快速开始

环境要求：

- Node.js `20+`
- pnpm `9.15+`

安装并启动完整开发环境：

```bash
git clone https://github.com/OwnLabAI/ownlab.git
cd ownlab
pnpm install
pnpm dev
```

启动后地址：

- Web UI: `http://localhost:3000`
- API 服务: `http://localhost:3100`

快速健康检查：

```bash
curl http://localhost:3100/health
curl http://localhost:3100/api/agents
curl http://localhost:3100/api/workspaces
```

CLI（在仓库根目录，开发时无需先 build）：

```bash
pnpm ownlab --help
pnpm ownlab health
```

执行 `pnpm --filter ./apps/cli build` 后，可用 `pnpm ownlab:run -- health`，或进入 `apps/cli` 运行 `node dist/index.js`。

默认情况下，如果没有设置 `DATABASE_URL`，OwnLab 在开发环境中会使用内嵌 PostgreSQL。

如果你想改用外部数据库：

```bash
export DATABASE_URL="postgres://ownlab:ownlab@localhost:5432/ownlab"
pnpm dev
```

## API 概览

API 挂载在 `/api` 下，主要包括：

- `/api/agents`
- `/api/teams`
- `/api/workspaces`
- `/api/channels`
- `/api/taskboards`
- `/api/tasks`
- `/api/channel-chat`
- `/api/heartbeat`
- `/api/skills`
- `/api/search`

健康检查接口：

```bash
GET /health
```

## 仓库结构

```text
ownlab/
├── apps/
│   ├── server/        # Express API 与 orchestration services
│   ├── web/           # 面向 labs、workspaces、tasks、agents 的 Next.js UI
│   └── cli/           # `ownlab` CLI（Commander + esbuild）
├── packages/
│   ├── db/            # Drizzle schema、migrations、DB runtime
│   ├── shared/        # Shared types、constants、validation helpers
│   ├── adapter-utils/ # Shared adapter helpers
│   └── adapters/      # Agent adapter packages
├── docs/              # 架构、部署与补充文档
├── ods/               # 产品切片、示例与设计记录
├── package.json
└── pnpm-workspace.yaml
```

## 开发命令

常用命令：

```bash
pnpm dev
pnpm dev:server
pnpm dev:app
pnpm build
pnpm typecheck
pnpm test:run
pnpm db:generate
pnpm db:migrate
pnpm ownlab --help
```

## 路线图

- ⚪ 支持更多的Agents
- ⚪ 更灵活的 team 配置
- ⚪ 在 tasks 中支持 auto mode，例如 auto-research
- ⚪ 自动创建 tasks
- ⚪ 更好的文档
