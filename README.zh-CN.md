<h1 align="center">Codex Sidebar Kit</h1>

<p align="center"><strong>为 Codex Desktop 增加自定义侧栏应用，并把工作交给原生 Codex 智能体。</strong></p>

<p align="center">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

<p align="center">
  <a href="https://github.com/forrestsweet/codex-sidebar-kit/actions/workflows/check.yml"><img alt="Check" src="https://github.com/forrestsweet/codex-sidebar-kit/actions/workflows/check.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-111111.svg"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS-111111.svg">
  <img alt="Status" src="https://img.shields.io/badge/status-early%20preview-dfff67.svg">
</p>

![Codex Sidebar Kit 展示三个自定义侧栏菜单、Codex 原生区域与内嵌智能体任务看板](docs/assets/codex-sidebar-kit-hero.png)

<p align="center"><sub>多菜单 · 原生输入框任务交接 · Skill 状态回写</sub></p>

Codex Sidebar Kit 是一个配置驱动的非官方开源模板，用来把本地 Web 应用放进 Codex Desktop 侧栏。你可以把常用链接、仪表盘、项目工具和智能体工作流放在一步可达的位置，无需修改或重新分发 Codex 应用包。

## 快速开始

需要 **macOS**、**Node.js 22+**，并已安装 Codex Desktop 或 ChatGPT Desktop。

```bash
git clone https://github.com/forrestsweet/codex-sidebar-kit.git
cd codex-sidebar-kit
npm install
npm run codex
```

命令会启动示例应用、使用独立 profile 打开一个新的 Codex 窗口，并注入配置中的三个菜单。使用该窗口期间请保持终端进程运行。

> 本项目与 OpenAI 无隶属或合作关系。侧栏注入和原生输入框连接依赖 Codex Desktop 未公开的内部结构，未来的 Codex 更新可能需要兼容性适配。

## 你将获得什么

| 能力 | 用途 |
| --- | --- |
| 多个侧栏应用 | 用一个配置声明各自独立的名称、图标、路由和权限。 |
| 原生 Codex 任务交接 | 选择工作目录，把任务预填到原生 Codex 输入框中，由用户确认发送。 |
| Skill 状态回写 | 让原生智能体把任务状态、评论和对话归属同步回你的应用。 |
| 本地优先运行 | UI 与任务数据运行在本机回环地址；不修改 `app.asar`，也不在后台运行隐藏的 `codex exec` 智能体。 |

仓库自带 **Agent Tasks**、**Quick Links** 和 **Project Guide** 三个示例。自定义菜单位于 Codex 原生快捷入口下方、置顶对话和项目上方。

## 配置你的菜单

编辑 [`sidebar.config.mjs`](sidebar.config.mjs)：

```js
export default {
  appId: "my-workspace",
  name: "My Workspace",
  sectionLabel: "My Tools",
  menus: [
    {
      id: "tasks",
      label: "Agent Tasks",
      icon: "check-square",
      path: "/app/tasks",
      capabilities: ["context", "native-task", "open-thread"],
      skill: "skills/sidebar-tasks",
    },
    {
      id: "links",
      label: "Quick Links",
      icon: "link",
      path: "/app/links",
      capabilities: ["context"],
    },
  ],
};
```

内置图标包括 `check-square`、`link`、`book-open` 和 `panel-left`。每个菜单只能使用自己显式声明的能力。

## 把工作交给原生 Codex

内嵌页面可以读取当前 Codex 上下文、准备原生任务，或重新打开已归属的对话：

```js
import { codex } from "/bridge.js";

const context = await codex.context.get();

await codex.native.prepareTask({
  workspace: "/absolute/path/to/project",
  prompt: "[$my-skill] 处理任务 APP-123，并同步状态。",
});

await codex.native.openThread("native-codex-thread-id");
```

`prepareTask()` 会切换活动工作目录、关闭内嵌面板，并把任务预填到 **Codex 原生输入框**。用户始终保留控制权，最终从 Codex 中确认发送。

运行 `npm run codex` 时，配置中的 Skill 会链接到 `~/.agents/skills`。示例 Skill 为原生智能体提供一条可重复执行的路线：

```text
读取任务 → 标记进行中 → 执行并验证
         → 回写结果 → 交还用户审核
```

内置的 `sidebarctl` 会把更新写入本地任务 API，并附带 `CODEX_THREAD_ID`，因此侧栏应用可以重新打开对应的原生对话。工作流层使用的是 [OpenAI Skills 官方文档](https://developers.openai.com/plugins/concepts/skills) 描述的机制。

## 工作原理

```text
sidebar.config.mjs
        │
        ▼
CDP 注入器 ── 创建 N 个 Codex 侧栏菜单
        │
        ▼
隔离的 Web 路由 ── bridge.js ── Codex 原生输入框
        │                              │
        └──── 本地任务 API ◀── sidebarctl + Skill
```

启动器使用独立 Codex profile，并且只在 `127.0.0.1` 暴露 Chrome DevTools Protocol。内嵌路由运行在沙箱 iframe 中，每个菜单都有独立的能力检查。

## 开发与验证

不打开 Codex，直接预览 Web 应用：

```bash
npm run dev
```

然后访问 <http://127.0.0.1:43119/app/tasks>。

验证当前直接路径：

```bash
npm run check
```

该命令检查配置解析、菜单生成、注入源码生成、本地 API 启动、任务更新、对话归属和重启后的数据持久化。

核心目录：

```text
runtime/    注入式侧栏运行时
scripts/    启动器、注入器、CLI 和直接路径检查
server/     本地示例 API 与静态服务
web/        三菜单示例应用
skills/     原生智能体工作流模板
```

## 兼容性与贡献

这是一个依赖非官方兼容层的早期预览项目。如果 Codex 更新导致菜单、内嵌页面或输入框预填失效，请提交[兼容性报告](https://github.com/forrestsweet/codex-sidebar-kit/issues/new?template=compatibility.yml)，并附上准确的 Codex 版本与脱敏后的复现步骤。

欢迎 Pull Request。修改兼容性选择器或原生桥接行为之前，请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。后续版本与兼容工作统一通过 [GitHub Issues](https://github.com/forrestsweet/codex-sidebar-kit/issues) 跟踪。

## 许可证

[Apache-2.0](LICENSE)。这是一个独立实现，不包含 OpenAI 资产、修改后的应用包或其他项目的注入器源码。

如果这个模板为你节省了时间，欢迎点一个 Star，让更多 Codex 开发者发现它。
