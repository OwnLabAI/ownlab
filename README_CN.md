<p align="center">
  <img src="./docs/assets/logo-name.svg" alt="OwnLab" width="220" />
</p>

<p align="center">
  <strong>面向实验室、研究者与 agentic research teams 的开源 AI science workbench。</strong>
</p>

<p align="center">
  <a href="./README.md">English README</a>
</p>

<p align="center">
  <img src="./apps/www/public/app-light.png" alt="OwnLab app preview" width="860" />
</p>

OwnLab 是一个开源、desktop-first 的 AI workbench，面向科学研究与技术工作。它把 workspaces、specialist agents、可复用 skills、tasks、files、code 和可复现 artifacts 放进同一个 local-first 环境里。

## OwnLab 是做什么的

- ✅ 如果你想要一个面向科学与技术团队的开源 AI workbench，
- ✅ 如果你希望 agents 能阅读论文、检查文件、编写代码、运行工具，并产出可审计的 research artifacts，
- ✅ 如果你希望把实验协议、分析流程、文献综述工作流和领域知识沉淀成可复用 skills，
- ✅ 如果你希望协调 specialist agents 完成研究、工程、数据分析、写作、review 和运营工作，
- ✅ 如果你希望敏感数据集和项目上下文留在自己的机器或基础设施中，
- ✅ 如果你想构建一个自动化实验室、自动化工程团队或自动化公司，那么你应该使用 OwnLab。

## 功能特性

|                                                                 |                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| **Workspaces** 把文件、对话、工具、channels 和 artifacts 放在一起。 | **Agents** 构建带有 skills、memory、tools 和 agency 的 specialist runtimes。 |
| **Teams** 将 agents 组织成包含 leaders、reviewers 和 workers 的研究团队。 | **Tasks** 将 scheduled、long-running 或 automatic 工作委派给 agents 和 teams。 |

## 产品预览

| Workspace | Agents |
| --- | --- |
| ![Workspace](./docs/assets/workspace.png) | ![Agents](./docs/assets/agent.png) |

| Teams | Tasks |
| --- | --- |
| ![Teams](./docs/assets/team.png) | ![Tasks](./docs/assets/task.png) |

## 为什么是 OwnLab

现代研究工作被分散在论文、notebooks、数据库、terminal、scripts、cloud compute、团队聊天和 manuscript tools 之间。OwnLab 的目标是让这些工作回到一个连续的研究环境中：

- 用 agents 运行多步骤研究工作流，让它们能够 plan、execute、review 和 iterate。
- 产出带有充分上下文的 artifacts，方便理解它们是如何生成的。
- 用 skills 封装实验协议、分析方法、领域 playbooks 和实验室专属工作流。
- 以 Desktop app 作为主要体验，同时保留 Web app、API server 和 CLI 方便开发与集成。

## 快速开始

环境要求：

- Node.js `20+`
- pnpm `9.15+`

先安装依赖：

```bash
git clone https://github.com/OwnLabAI/ownlab.git
cd ownlab
pnpm install
```

选择你想使用 OwnLab 的方式。

### Desktop App

如果你想要 local-first 的桌面体验，使用 Desktop。Desktop 应用会启动并管理自己的本地 app/server runtime，和浏览器里的 Web 栈隔离。

```bash
pnpm dev:desktop
```

如果你明确想让 Desktop 连接到已经启动的 Web app 和 API server，可以使用：

```bash
pnpm dev:desktop:reuse
```

### Web App + API Server

如果你想使用浏览器里的产品体验，或准备做自托管部署，使用 Web app + API server。

```bash
pnpm dev:web
```

启动后地址：

- Web UI: `http://localhost:3000`
- API 服务: `http://localhost:3100`

快速健康检查：

```bash
curl http://localhost:3100/health
curl http://localhost:3100/api/agents
curl http://localhost:3100/api/workspace
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
pnpm dev:web
```

## API 概览

API 挂载在 `/api` 下，主要包括：

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

健康检查接口：

```bash
GET /health
```

## 仓库结构

```text
ownlab/
├── apps/
│   ├── server/        # Express API 与 orchestration services
│   ├── app/           # OwnLab Desktop 使用的 Next.js app runtime
│   ├── desktop/       # Electron desktop shell（推荐的用户使用方式）
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
pnpm dev:desktop
pnpm dev:desktop:reuse
pnpm dev:web
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

## 路线图

- ⚪ 支持更多的Agents
- ⚪ 更灵活的 team 配置
- ⚪ 在 tasks 中支持 auto mode，例如 auto-research
- ⚪ 自动创建 tasks
- ⚪ 更好的文档
