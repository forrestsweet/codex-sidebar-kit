#!/usr/bin/env node

import sidebarConfig from "../sidebar.config.mjs";
import { buildInjectionSource } from "../runtime/build-injection.mjs";
import { publicConfig } from "../server/config.mjs";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = publicConfig(sidebarConfig);
  const baseUrl = process.env.SIDEBAR_KIT_URL || "http://127.0.0.1:43119";
  const source = await buildInjectionSource({ config, baseUrl });
  const target = await waitForTarget(options.port, 25_000);
  const cdp = new CdpConnection(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.setBypassCSP", { enabled: true });
  await cdp.send("Runtime.addBinding", { name: "__codexSidebarKitHost" });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source });
  await cdp.send("Runtime.evaluate", { expression: source, awaitPromise: true });

  cdp.on("Runtime.bindingCalled", (event) => {
    if (event.name !== "__codexSidebarKitHost") return;
    void handleHostRequest(cdp, event.payload).catch((error) => {
      console.error(`Native bridge failed: ${error.message}`);
    });
  });

  console.log(`Injected ${config.menus.length} menus into ${target.title || target.url}`);
  console.log("Keep this process running while you use the sidebar.");
  await new Promise((resolve) => {
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, resolve);
    cdp.on("close", resolve);
  });
  cdp.close();
}

function parseArgs(argv) {
  let port = 9229;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--port") port = Number(argv[++index]);
    else throw new Error(`Unknown option: ${argv[index]}`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("--port must be a valid port");
  return { port };
}

async function waitForTarget(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1_000) });
      const targets = await response.json();
      const target = targets.find((candidate) => (
        candidate.type === "page"
        && typeof candidate.webSocketDebuggerUrl === "string"
        && !candidate.url.startsWith("devtools://")
        && !candidate.url.includes("initialRoute=%2Favatar-overlay")
        && !candidate.url.includes("initialRoute=%2Fglobal-dictation")
      ));
      if (target) return target;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No Codex renderer found on port ${port}${lastError ? `: ${lastError.message}` : ""}`);
}

async function handleHostRequest(cdp, payload) {
  let request;
  try {
    request = JSON.parse(payload);
  } catch {
    return;
  }
  if (!request || typeof request.id !== "string") return;
  try {
    if (request.action === "prefill") {
      const prompt = typeof request.prompt === "string" ? request.prompt.trim() : "";
      if (!prompt || prompt.length > 8_000) throw new Error("Invalid native task prompt");
      await prefillComposer(cdp, prompt);
      await sendHostResponse(cdp, request.id, { prefilled: true });
      return;
    }
    if (request.action === "load-frame") {
      await loadFrameDocument(cdp, request);
      await sendHostResponse(cdp, request.id, { loaded: true });
    }
  } catch (error) {
    await sendHostResponse(cdp, request.id, null, error instanceof Error ? error.message : String(error));
  }
}

async function loadFrameDocument(cdp, request) {
  if (!/^codex-sidebar-kit-[a-z][a-z0-9-]{1,47}$/.test(request.frameName || "")) {
    throw new Error("Invalid sidebar frame name");
  }
  if (!/^[a-z][a-z0-9-]{1,47}$/.test(request.menuId || "")) {
    throw new Error("Invalid sidebar menu id");
  }
  const pageUrl = new URL(request.pageUrl);
  const allowedOrigin = new URL(process.env.SIDEBAR_KIT_URL || "http://127.0.0.1:43119").origin;
  if (pageUrl.origin !== allowedOrigin || !pageUrl.pathname.startsWith("/app/")) {
    throw new Error("Sidebar frame URL is outside the configured local app");
  }
  const response = await fetch(pageUrl, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Sidebar app returned HTTP ${response.status}`);
  const html = await response.text();
  const boot = `<base href=${JSON.stringify(pageUrl.href)}><script>globalThis.__CODEX_SIDEBAR_MENU_ID__=${JSON.stringify(request.menuId)};<\/script>`;
  const documentHtml = html.includes("<head>")
    ? html.replace("<head>", `<head>${boot}`)
    : `${boot}${html}`;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const { frameTree } = await cdp.send("Page.getFrameTree");
    const frame = findFrameByName(frameTree, request.frameName);
    if (frame) {
      await cdp.send("Page.setDocumentContent", { frameId: frame.id, html: documentHtml });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for the sidebar iframe");
}

function findFrameByName(tree, name) {
  if (tree?.frame?.name === name) return tree.frame;
  for (const child of tree?.childFrames || []) {
    const match = findFrameByName(child, name);
    if (match) return match;
  }
  return null;
}

async function prefillComposer(cdp, prompt) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const prepared = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const editor = Array.from(document.querySelectorAll('[data-codex-composer="true"][contenteditable="true"]'))
          .find((candidate) => candidate.getClientRects().length > 0);
        if (!editor) return { ready: false };
        editor.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
        return { ready: true, text: editor.textContent || "" };
      })()`,
      returnByValue: true,
    });
    if (!prepared.result.value?.ready) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      continue;
    }
    if (prepared.result.value.text.includes(prompt)) return;
    await cdp.send("Input.insertText", { text: prompt });
    await new Promise((resolve) => setTimeout(resolve, 120));
    const verified = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const editor = Array.from(document.querySelectorAll('[data-codex-composer="true"][contenteditable="true"]'))
          .find((candidate) => candidate.getClientRects().length > 0);
        return Boolean(editor && (editor.textContent || "").includes(${JSON.stringify(prompt)}));
      })()`,
      returnByValue: true,
    });
    if (verified.result.value === true) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("Timed out waiting for the native Codex composer");
}

async function sendHostResponse(cdp, id, result, error) {
  const message = JSON.stringify({
    channel: "codex-sidebar-kit/v1",
    type: "host-response",
    id,
    result,
    error,
  }).replaceAll("<", "\\u003c");
  await cdp.send("Runtime.evaluate", {
    expression: `window.postMessage(${message}, window.location.origin)`,
  });
}

class CdpConnection {
  constructor(url) {
    this.url = url;
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("Could not connect to Codex CDP")), { once: true });
      this.socket.addEventListener("message", (event) => this.#receive(event.data));
      this.socket.addEventListener("close", () => {
        for (const { reject: rejectPending } of this.pending.values()) rejectPending(new Error("Codex CDP closed"));
        this.pending.clear();
        this.#emit("close", {});
      });
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(name, listener) {
    const listeners = this.listeners.get(name) || new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  close() {
    this.socket?.close();
  }

  #receive(raw) {
    const message = JSON.parse(typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8"));
    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "CDP request failed"));
      else pending.resolve(message.result || {});
      return;
    }
    if (message.method) this.#emit(message.method, message.params || {});
  }

  #emit(name, payload) {
    for (const listener of this.listeners.get(name) || []) listener(payload);
  }
}

await main();
