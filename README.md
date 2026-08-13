<h1 align="center">Codex Sidebar Kit</h1>

<p align="center"><strong>Add custom sidebar apps to Codex Desktop—and hand work to native Codex agents.</strong></p>

<p align="center">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/forrestsweet/codex-sidebar-kit/actions/workflows/check.yml"><img alt="Check" src="https://github.com/forrestsweet/codex-sidebar-kit/actions/workflows/check.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-111111.svg"></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS-111111.svg">
  <img alt="Status" src="https://img.shields.io/badge/status-early%20preview-dfff67.svg">
</p>

![Codex Sidebar Kit showing three custom sidebar menus, native Codex sections, and an embedded agent task board](docs/assets/codex-sidebar-kit-hero.png)

<p align="center"><sub>Multiple menus · Native composer handoff · Skill-powered status sync</sub></p>

Codex Sidebar Kit is an unofficial, configuration-driven starter for putting local Web apps inside the Codex Desktop sidebar. Use it to keep links, dashboards, project tools, and agent workflows one click away—without modifying or redistributing the Codex app bundle.

## Quick start

You need **macOS**, **Node.js 22+**, and Codex Desktop or ChatGPT Desktop installed.

```bash
git clone https://github.com/forrestsweet/codex-sidebar-kit.git
cd codex-sidebar-kit
npm install
npm run codex
```

This starts the example app, opens a separate Codex window with an isolated profile, and injects the three configured menus. Keep the terminal process running while using that window.

> Codex Sidebar Kit is not affiliated with or endorsed by OpenAI. Sidebar injection and native-composer handoff rely on undocumented Codex Desktop internals, so a future Codex release may require a compatibility update.

## What you get

| Capability | What it enables |
| --- | --- |
| Multiple sidebar apps | Create menus with independent labels, icons, routes, and permissions from one config. |
| Native Codex handoff | Select a workspace and prepare a task in the native Codex composer for the user to send. |
| Skill-powered sync | Let the native agent update task status, comments, and conversation attribution in your app. |
| Local-first runtime | Serve your UI and task data on loopback; no patched `app.asar` or hidden `codex exec` agent. |

The included example contains **Agent Tasks**, **Quick Links**, and **Project Guide**. Custom menus appear below Codex's native shortcuts and above its pinned conversations and projects.

## Configure your menus

Edit [`sidebar.config.mjs`](sidebar.config.mjs):

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

Built-in icons are `check-square`, `link`, `book-open`, and `panel-left`. Each menu receives only the capabilities it declares.

## Hand work to native Codex

An embedded page can read its Codex context, prepare a native task, or reopen an attributed conversation:

```js
import { codex } from "/bridge.js";

const context = await codex.context.get();

await codex.native.prepareTask({
  workspace: "/absolute/path/to/project",
  prompt: "[$my-skill] Process task APP-123 and keep its status in sync.",
});

await codex.native.openThread("native-codex-thread-id");
```

`prepareTask()` switches the active workspace, closes the embedded panel, and prefills the **native Codex composer**. The user remains in control and sends the task from Codex.

Configured Skills are linked into `~/.agents/skills` when `npm run codex` starts. The example Skill gives the native agent a repeatable loop:

```text
read task → mark in progress → do and verify work
          → post result → return task for review
```

The bundled `sidebarctl` writes updates to the local task API and attaches `CODEX_THREAD_ID`, allowing the sidebar app to reopen the native conversation. See [OpenAI's Skills documentation](https://developers.openai.com/plugins/concepts/skills) for the documented workflow layer.

## How it works

```text
sidebar.config.mjs
        │
        ▼
CDP injector ── creates N Codex sidebar menus
        │
        ▼
sandboxed Web routes ── bridge.js ── native Codex composer
        │                                  │
        └──── local task API ◀── sidebarctl + Skill
```

The launcher uses a separate Codex profile and exposes Chrome DevTools Protocol only on `127.0.0.1`. Embedded routes run in sandboxed iframes with per-menu capability checks.

## Develop and verify

Preview the Web app without Codex:

```bash
npm run dev
```

Then open <http://127.0.0.1:43119/app/tasks>.

Verify the current direct path:

```bash
npm run check
```

This checks config parsing, generated menu definitions, injection source generation, local API startup, task updates, thread attribution, and restart persistence.

Key directories:

```text
runtime/    injected sidebar runtime
scripts/    launcher, injector, CLI, and direct-path check
server/     local example API and static host
web/        three-menu example app
skills/     native agent workflow template
```

## Compatibility and contributing

This is an early preview built on an explicitly unofficial compatibility layer. If a Codex update breaks menus, embedded pages, or composer prefill, open a [compatibility report](https://github.com/forrestsweet/codex-sidebar-kit/issues/new?template=compatibility.yml) with the exact Codex version and sanitized reproduction steps.

Pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing compatibility selectors or native bridge behavior. Planned releases and compatibility work are tracked in [GitHub Issues](https://github.com/forrestsweet/codex-sidebar-kit/issues).

## License

[Apache-2.0](LICENSE). This is an independent implementation and does not include OpenAI assets, modified application bundles, or another project's injector source.

If this gives you a useful starting point, consider starring the repository—it helps other Codex builders discover it.
