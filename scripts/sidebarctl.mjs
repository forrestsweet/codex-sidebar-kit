#!/usr/bin/env node

const baseUrl = process.env.SIDEBAR_KIT_URL || "http://127.0.0.1:43119";
const [resource, action, ...args] = process.argv.slice(2);

try {
  let result;
  if (resource !== "task") throw new Error(usage());
  if (action === "list" && args.length === 0) result = await request("GET", "/api/tasks");
  else if (action === "get" && args.length === 1) result = await request("GET", `/api/tasks/${encodeURIComponent(args[0])}`);
  else if (action === "move" && args.length === 2) {
    result = await request("POST", `/api/tasks/${encodeURIComponent(args[0])}/status`, {
      status: args[1],
      threadId: process.env.CODEX_THREAD_ID || undefined,
    });
  } else if (action === "comment" && args.length >= 2) {
    result = await request("POST", `/api/tasks/${encodeURIComponent(args[0])}/comments`, {
      text: args.slice(1).join(" "),
      threadId: process.env.CODEX_THREAD_ID || undefined,
    });
  } else {
    throw new Error(usage());
  }
  process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
  process.exitCode = 1;
}

async function request(method, pathname, body) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5_000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function usage() {
  return [
    "Usage:",
    "  sidebarctl task list",
    "  sidebarctl task get TASK_ID",
    "  sidebarctl task move TASK_ID todo|in_progress|in_review|done",
    "  sidebarctl task comment TASK_ID TEXT",
  ].join("\n");
}
