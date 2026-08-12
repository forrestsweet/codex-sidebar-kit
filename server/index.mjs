import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sidebarConfig from "../sidebar.config.mjs";
import { publicConfig } from "./config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = path.join(ROOT, "web");
const DATA_ROOT = process.env.SIDEBAR_KIT_DATA_DIR
  ? path.resolve(process.env.SIDEBAR_KIT_DATA_DIR)
  : path.join(ROOT, ".data");
const STATE_FILE = path.join(DATA_ROOT, "demo-tasks.json");
const HOST = process.env.SIDEBAR_KIT_HOST || "127.0.0.1";
const PORT = Number(process.env.SIDEBAR_KIT_PORT || 43119);
const config = publicConfig(sidebarConfig);
const clients = new Set();

const DEFAULT_TASKS = [
  {
    id: "KIT-101",
    title: "Polish the launch README",
    description: "Make the first screen explain the value in under ten seconds.",
    status: "todo",
    priority: "High",
    version: 1,
    threadId: null,
    comments: [],
  },
  {
    id: "KIT-102",
    title: "Add a fourth menu",
    description: "Use sidebar.config.mjs and verify the entry appears after refresh.",
    status: "todo",
    priority: "Medium",
    version: 1,
    threadId: null,
    comments: [],
  },
  {
    id: "KIT-103",
    title: "Record the 30-second demo",
    description: "Show menu switching, native task handoff, and status sync.",
    status: "in_review",
    priority: "Medium",
    version: 1,
    threadId: null,
    comments: ["Demo script drafted."],
  },
];
let tasks = await loadTasks();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function json(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function publish(type, payload) {
  const event = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) client.write(event);
}

function taskById(id) {
  return tasks.find((task) => task.id === id) || null;
}

async function loadTasks() {
  try {
    const value = JSON.parse(await readFile(STATE_FILE, "utf8"));
    if (!Array.isArray(value) || value.some((task) => (
      !task
      || typeof task.id !== "string"
      || typeof task.title !== "string"
      || !["todo", "in_progress", "in_review", "done"].includes(task.status)
      || !Number.isSafeInteger(task.version)
      || !Array.isArray(task.comments)
    ))) throw new Error("Invalid demo task state");
    return value;
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`Ignoring saved demo state: ${error.message}`);
    return structuredClone(DEFAULT_TASKS);
  }
}

async function persistTasks() {
  await mkdir(DATA_ROOT, { recursive: true });
  const temporary = `${STATE_FILE}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, STATE_FILE);
}

async function serveStatic(response, filePath) {
  const normalized = path.resolve(filePath);
  if (!normalized.startsWith(`${WEB_ROOT}${path.sep}`)) {
    json(response, 404, { error: "Not found" });
    return;
  }
  try {
    const metadata = await stat(normalized);
    if (!metadata.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(normalized)] || "application/octet-stream",
      "content-length": metadata.size,
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    });
    createReadStream(normalized).pipe(response);
  } catch {
    json(response, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { status: "ok", product: "codex-sidebar-kit" });
    }
    if (request.method === "GET" && url.pathname === "/api/config") {
      return json(response, 200, config);
    }
    if (request.method === "GET" && url.pathname === "/api/tasks") {
      return json(response, 200, { tasks });
    }
    if (request.method === "GET" && url.pathname === "/api/events") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
        "access-control-allow-origin": "*",
      });
      response.write("event: ready\ndata: {}\n\n");
      clients.add(response);
      request.once("close", () => clients.delete(response));
      return;
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)(?:\/(status|comments))?$/);
    if (taskMatch) {
      const task = taskById(decodeURIComponent(taskMatch[1]));
      if (!task) return json(response, 404, { error: "Task not found" });
      if (request.method === "GET" && !taskMatch[2]) return json(response, 200, { task });

      const body = await readJson(request);
      if (request.method === "POST" && taskMatch[2] === "status") {
        if (!["todo", "in_progress", "in_review", "done"].includes(body.status)) {
          return json(response, 400, { error: "Invalid status" });
        }
        task.status = body.status;
        task.version += 1;
        if (typeof body.threadId === "string" && body.threadId.trim()) task.threadId = body.threadId.trim();
        await persistTasks();
        publish("task.updated", { task });
        return json(response, 200, { task });
      }
      if (request.method === "POST" && taskMatch[2] === "comments") {
        if (typeof body.text !== "string" || !body.text.trim()) {
          return json(response, 400, { error: "Comment text is required" });
        }
        task.comments.push(body.text.trim());
        task.version += 1;
        if (typeof body.threadId === "string" && body.threadId.trim()) task.threadId = body.threadId.trim();
        await persistTasks();
        publish("task.updated", { task });
        return json(response, 201, { task });
      }
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/app/"))) {
      return serveStatic(response, path.join(WEB_ROOT, "index.html"));
    }
    if (request.method === "GET") {
      return serveStatic(response, path.join(WEB_ROOT, url.pathname.replace(/^\/+/, "")));
    }
    json(response, 404, { error: "Not found" });
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Codex Sidebar Kit: http://${HOST}:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
