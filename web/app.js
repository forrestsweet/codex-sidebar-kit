import { codex } from "/bridge.js";

const app = document.querySelector("#app");
const menuId = globalThis.__CODEX_SIDEBAR_MENU_ID__
  || window.location.pathname.split("/").filter(Boolean).at(-1)
  || "tasks";
let config;
let hostContext = null;
const memoryStorage = new Map();

function storedValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryStorage.get(key) || null;
  }
}

function storeValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryStorage.set(key, value);
  }
}

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function shell(content, menu) {
  return `
    <main class="shell">
      <header class="topbar">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">S</span>
          <div>
            <strong>${escapeHtml(menu.label)}</strong>
            <span>${escapeHtml(menu.description)}</span>
          </div>
        </div>
        <div class="topbar-actions">
          <span class="native-pill"><i></i>${codex.embedded() ? "Connected to Codex" : "Browser preview"}</span>
          <a class="star-button" href="${escapeHtml(config.repositoryUrl)}" target="_blank" rel="noreferrer">★ Star on GitHub</a>
        </div>
      </header>
      ${content}
    </main>`;
}

function statusLabel(status) {
  return {
    todo: "Ready",
    in_progress: "Codex is working",
    in_review: "Needs review",
    done: "Done",
  }[status] || status;
}

async function tasksView(menu) {
  const { tasks } = await fetch("/api/tasks").then((response) => response.json());
  const columns = ["todo", "in_progress", "in_review"];
  const board = columns.map((status) => `
    <section class="task-column">
      <div class="column-heading">
        <span>${statusLabel(status)}</span>
        <b>${tasks.filter((task) => task.status === status).length}</b>
      </div>
      <div class="task-stack">
        ${tasks.filter((task) => task.status === status).map((task) => `
          <article class="task-card" data-task-id="${escapeHtml(task.id)}">
            <div class="task-meta"><span>${escapeHtml(task.id)}</span><em>${escapeHtml(task.priority)}</em></div>
            <h3>${escapeHtml(task.title)}</h3>
            <p>${escapeHtml(task.description)}</p>
            ${task.comments.at(-1) ? `<blockquote>${escapeHtml(task.comments.at(-1))}</blockquote>` : ""}
            <div class="task-actions">
              ${task.status === "todo" ? `<button class="run-task" data-task-id="${escapeHtml(task.id)}">Open in native Codex <span>→</span></button>` : ""}
              ${task.threadId ? `<button class="open-thread secondary" data-thread-id="${escapeHtml(task.threadId)}">Open conversation</button>` : ""}
            </div>
          </article>`).join("") || `<div class="empty-column">Nothing here yet</div>`}
      </div>
    </section>`).join("");

  app.innerHTML = shell(`
    <section class="hero compact-hero">
      <div>
        <span class="eyebrow">NATIVE AGENT HANDOFF</span>
        <h1>Your workflow stays here.<br />The work happens in Codex.</h1>
      </div>
      <div class="workspace-field">
        <label for="workspace">Workspace path</label>
        <input id="workspace" value="${escapeHtml(storedValue("sidebar-kit-workspace") || hostContext?.workspacePath || "")}" placeholder="/absolute/path/to/project" />
      </div>
    </section>
    <section class="board">${board}</section>
  `, menu);

  document.querySelector("#workspace")?.addEventListener("change", (event) => {
    storeValue("sidebar-kit-workspace", event.target.value.trim());
  });
  document.querySelectorAll(".run-task").forEach((button) => button.addEventListener("click", async () => {
    const task = tasks.find((candidate) => candidate.id === button.dataset.taskId);
    const workspace = document.querySelector("#workspace")?.value.trim();
    if (!workspace) {
      button.textContent = "Add a workspace path first";
      return;
    }
    storeValue("sidebar-kit-workspace", workspace);
    button.disabled = true;
    button.textContent = "Opening native Codex…";
    try {
      await codex.native.prepareTask({
        workspace,
        prompt: `[$sidebar-tasks] Process sidebar task ${task.id}. Read the task first, keep its status in sync, and return it for review when the work is verified.`,
      });
    } catch (error) {
      button.disabled = false;
      button.textContent = error.message;
    }
  }));
  document.querySelectorAll(".open-thread").forEach((button) => button.addEventListener("click", () => {
    void codex.native.openThread(button.dataset.threadId);
  }));
}

function linksView(menu) {
  const links = [
    ["GitHub", "Review pull requests and issues", "https://github.com"],
    ["OpenAI Docs", "Codex, Skills, and Automation guidance", "https://developers.openai.com"],
    ["Local App", "Your internal dashboard or tool", "http://127.0.0.1:3000"],
  ];
  app.innerHTML = shell(`
    <section class="hero">
      <span class="eyebrow">ONE SIDEBAR · MANY TOOLS</span>
      <h1>Keep your working set<br />inside Codex.</h1>
      <p>Each menu can load a route from this app or an independently hosted local tool.</p>
    </section>
    <section class="link-grid">
      ${links.map(([name, description, url], index) => `
        <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer" class="link-card">
          <span class="link-number">0${index + 1}</span>
          <div><h2>${escapeHtml(name)}</h2><p>${escapeHtml(description)}</p></div>
          <b>↗</b>
        </a>`).join("")}
    </section>
  `, menu);
}

function docsView(menu) {
  app.innerHTML = shell(`
    <section class="hero docs-hero">
      <span class="eyebrow">STARTER ARCHITECTURE</span>
      <h1>One config turns into<br />multiple Codex menus.</h1>
      <p>Keep UI, native handoff, and agent instructions separate so every layer stays replaceable.</p>
    </section>
    <section class="architecture">
      <article><span>01</span><h2>Menu config</h2><p>Declare labels, routes, icons, and capabilities in one file.</p><code>sidebar.config.mjs</code></article>
      <article><span>02</span><h2>Native bridge</h2><p>Prepare work in the Codex App instead of running a hidden CLI agent.</p><code>native.prepareTask()</code></article>
      <article><span>03</span><h2>Skill sync</h2><p>The native agent reads and updates your app through a small local CLI.</p><code>sidebarctl task move</code></article>
    </section>
  `, menu);
}

async function render() {
  config = await fetch("/api/config").then((response) => response.json());
  const menu = config.menus.find((candidate) => candidate.id === menuId) || config.menus[0];
  if (codex.embedded()) {
    try {
      hostContext = await codex.context.get();
    } catch {}
  }
  if (menu.id === "tasks") return tasksView(menu);
  if (menu.id === "links") return linksView(menu);
  return docsView(menu);
}

const events = new EventSource("/api/events");
events.addEventListener("task.updated", () => {
  if (menuId === "tasks") void render();
});

render().catch((error) => {
  app.innerHTML = `<pre class="fatal-error">${escapeHtml(error.stack || error.message)}</pre>`;
});
