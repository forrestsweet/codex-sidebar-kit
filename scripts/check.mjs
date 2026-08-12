import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sidebarConfig from "../sidebar.config.mjs";
import { buildInjectionSource } from "../runtime/build-injection.mjs";
import { publicConfig } from "../server/config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "server/index.mjs",
  "server/config.mjs",
  "scripts/codex.mjs",
  "scripts/inject.mjs",
  "scripts/sidebarctl.mjs",
  "runtime/build-injection.mjs",
  "web/app.js",
  "web/bridge.js",
];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || `Syntax check failed: ${file}`);
}

const config = publicConfig(sidebarConfig);
assert.equal(config.menus.length, 3);
assert.deepEqual(config.menus.map((menu) => menu.id), ["tasks", "links", "docs"]);
const injection = await buildInjectionSource({ config, baseUrl: "http://127.0.0.1:43119" });
assert.match(injection, /Agent Tasks/);
assert.match(injection, /native\.prepareTask/);

const port = await freePort();
const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-sidebar-kit-check-"));
const serverEnvironment = {
  ...process.env,
  SIDEBAR_KIT_PORT: String(port),
  SIDEBAR_KIT_DATA_DIR: dataDirectory,
};
const startServer = () => spawn(process.execPath, [path.join(ROOT, "server/index.mjs")], {
  cwd: ROOT,
  env: serverEnvironment,
  stdio: ["ignore", "pipe", "pipe"],
});
const server = startServer();
let restartedServer = null;
try {
  await waitForUrl(`http://127.0.0.1:${port}/health`);
  const liveConfig = await fetch(`http://127.0.0.1:${port}/api/config`).then((response) => response.json());
  assert.equal(liveConfig.menus.length, 3);
  const before = await fetch(`http://127.0.0.1:${port}/api/tasks/KIT-101`).then((response) => response.json());
  const moved = await fetch(`http://127.0.0.1:${port}/api/tasks/KIT-101/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "in_progress", threadId: "check-thread" }),
  }).then((response) => response.json());
  assert.equal(moved.task.status, "in_progress");
  assert.equal(moved.task.threadId, "check-thread");
  assert.equal(moved.task.version, before.task.version + 1);
  server.kill("SIGTERM");
  if (server.exitCode === null) await once(server, "exit");
  restartedServer = startServer();
  await waitForUrl(`http://127.0.0.1:${port}/health`);
  const persisted = await fetch(`http://127.0.0.1:${port}/api/tasks/KIT-101`).then((response) => response.json());
  assert.equal(persisted.task.status, "in_progress");
  assert.equal(persisted.task.threadId, "check-thread");
  console.log("Direct path verified: config → 3 menus → task API → status/thread sync → restart persistence");
} finally {
  if (server.exitCode === null) server.kill("SIGTERM");
  if (restartedServer?.exitCode === null) restartedServer.kill("SIGTERM");
  await rm(dataDirectory, { recursive: true, force: true });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      socket.close(() => resolve(address.port));
    });
  });
}

async function waitForUrl(url) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
