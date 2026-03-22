---
Author: "@long"
Updated: 2026-03-22
Status: Draft
---
# ODS-Workspace-5: add goal, tasks in tool panel

## Introduction


## Requirements
我会自顶向下地描述用户的交互逻辑，需要你自底向上地进行构建，从数据库，数据库的交互，API，前端UI，后端server中的routes，services等多个部分。

### R1：Add Goal
在 workspace 的 tool panel 中新增一个 `Goal` 模块。`Goal` 是当前 workspace 的 alignment layer，用来描述这个 workspace 当前在做什么、成功标准是什么，以及关键假设和决策。

第一版只做一个简单的 goal，不做 goal tree，不做复杂的 goals 页面。整体技术方案参考 paperclip：
1. 数据层将 goal 存为 workspace 下的一份 markdown 内容，并保留最小的结构化字段。
2. API 和 server 提供读取与更新当前 workspace goal 的能力。
3. 前端提供统一的 markdown 编辑和渲染方案。
4. 编辑器采用 `MDXEditor`，展示层采用独立的 markdown body 渲染组件。
5. goal 要直接嵌入 workspace tool panel，而不是单独做一个独立页面。

目标是先建立一套稳定的 markdown 技术方案和 workspace goal 模块，后续 task 的 description、plan、notes 等长文本能力可以复用这套方案。

### R2: Add Task
在 workspace 的 tool panel 中新增一个 `Tasks` 模块。`Tasks` 是当前 workspace 的 commitment / execution layer，用来承载这个 workspace 当前有哪些明确任务、这些任务的状态，以及点开后查看具体内容和执行信息。

第一版不做 workspace 内 taskboard，不做 kanban。整体交互采用 `tool panel list + viewboard detail` 的结构：
1. 在 workspace tool panel 中新增一个 `Tasks` tab。
2. `Tasks` tab 默认展示当前 workspace 下的 task list，使用紧凑 list 排列，而不是 board。
3. 每个 task list item 至少展示：`title`、`status`、`assignee`、`updatedAt / lastRunAt` 等轻量摘要。
4. 点击某个 task 后，在右侧 `viewboard` 打开该 task 的 detail，而不是在左侧展开详情。
5. `viewboard` 中的 task detail 用来承载完整内容和操作，第一版至少支持：
   - title
   - objective / notes
   - status / priority / mode
   - assignee
   - run result / recent history
6. `Tasks` tab 顶部提供一个轻量的 `New Task` 入口，允许直接在当前 workspace 下创建 task。
7. 当 workspace 下没有 task 时，左侧 `Tasks` tab 要提供明确的 empty state，并引导用户创建第一个 task。

定位原则：
- workspace 内的 `Tasks` 是当前 workspace 的本地执行视图，不是全局管理页。
- 全局 tasks page 继续保留，用于跨 workspace 的 control plane / management。
- workspace 的 tool panel 负责浏览和选择 task，viewboard 负责查看和操作当前选中的 task。


## Details
1. 参考项目：ods/exmaples/openslaq；ods/exmaples/paperclip;
2. 我们处于开发阶段，目的是寻求最佳的代码架构和技术方案，所以无需向前兼容，No backward compatibility
3. 不能引用任何ods中的文件，这些文件只是我们构建代码的模版。
