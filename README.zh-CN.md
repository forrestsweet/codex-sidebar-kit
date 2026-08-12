# Codex Sidebar Kit

<p align="center">
  <a href="./README.md">English</a> · <strong>简体中文</strong>
</p>

**在 Codex Desktop 中增加多个自定义菜单，并把工作交给原生 Codex 智能体。**

[![License](https://img.shields.io/badge/license-Apache--2.0-111111.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS-111111.svg)
![Status](https://img.shields.io/badge/status-early%20preview-dfff67.svg)

Codex Sidebar Kit 是一个配置驱动的非官方开源模板。开发者可以把自己的本地 Web 应用嵌入 Codex 侧栏，从页面中准备原生 Codex 任务，再通过 Skill 和本地 CLI 把执行结果同步回应用。

> 本项目与 OpenAI 无隶属或合作关系。侧栏注入和原生输入框连接依赖 Codex Desktop 未公开的内部结构，Codex 更新后可能需要适配。

## 它解决什么问题

```text
你的 Web 应用
  → Codex 自定义侧栏菜单
  → Codex 原生任务和原生智能体
  → Skill 约束工作路线
  → CLI/API 回写应用状态
```

它不会在后台偷偷运行 `codex exec`。任务提示词会进入 Codex App 的原生输入框，由用户确认发送，执行过程留在 Codex App 中。

## 当前能力

- 一个配置文件生成多个侧栏菜单。
- 每个菜单拥有独立路由、图标和能力权限。
- 隔离 iframe 懒加载并在菜单切换时保留状态。
- Web Bridge 可以读取当前项目和原生对话上下文。
- 从 Web 页面切换工作目录并预填原生 Codex 任务。
- 启动时自动安装配置中的 Skill。
- 原生 Agent 通过 `sidebarctl` 回写任务状态、评论和 `CODEX_THREAD_ID`。
- 示例状态持久化到 `.data/demo-tasks.json`。

签名 `.dmg`、`npm create` 脚手架和原生 Automation 适配器仍在路线图中，目前不宣称已经完成。

## 快速体验

需要 macOS、Node.js 22+，并已安装 Codex Desktop 或 ChatGPT Desktop。

浏览器预览：

```bash
npm run dev
```

打开 <http://127.0.0.1:43119/app/tasks>。

注入独立 Codex 窗口：

```bash
npm run codex
```

命令会启动本地示例、使用独立 profile 打开 Codex，并注入配置中的所有菜单。已有 Codex 窗口可以继续保留。使用期间不要关闭运行命令的终端。

## 配置多个菜单

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

## 页面调用 Codex 原生能力

```js
import { codex } from "/bridge.js";

const context = await codex.context.get();

await codex.native.prepareTask({
  workspace: "/absolute/path/to/project",
  prompt: "[$my-skill] 处理任务 APP-123，并同步状态。",
});
```

每个菜单都必须显式声明能力。纯链接页面不会自动获得创建原生任务的权限。

## 已验证的直接路径

```text
配置三个菜单
→ 注入当前 Codex renderer
→ 打开 Agent Tasks
→ 隔离页面完整加载
→ 页面请求 native.prepareTask
→ Codex 原生 composer 出现未发送提示词
→ sidebarctl 更新状态并记录对话 ID
```

运行本地检查：

```bash
npm run check
```

## 路线图

- [ ] 签名并公证的 macOS `.dmg`
- [ ] `npm create codex-sidebar-app@latest`
- [ ] 30 秒演示 GIF 和兼容版本表
- [ ] 配置生成品牌、菜单、Skill 和发布流程
- [ ] 实验性的 Codex 原生 Automation 适配器

如果这个方向对你有用，欢迎 Star，并通过兼容性 Issue 提交你验证过的 Codex Desktop 版本。
