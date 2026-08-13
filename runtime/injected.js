(() => {
  const options = __SIDEBAR_KIT_PAYLOAD__;
  const CHANNEL = "codex-sidebar-kit/v1";
  const HOST_BINDING = "__codexSidebarKitHost";
  const SENTINEL = "__codexSidebarKitRuntimeV1";
  const OWNED = "data-codex-sidebar-kit";
  const STYLE_ID = "codex-sidebar-kit-styles";
  const SECTION_ID = `codex-sidebar-kit-${options.appId}`;
  const PANEL_ID = `${SECTION_ID}-panel`;
  if (globalThis[SENTINEL]?.destroy) globalThis[SENTINEL].destroy();

  let activeMenuId = null;
  let destroyed = false;
  let section = null;
  let panel = null;
  let observer = null;
  let scheduled = false;
  const frames = new Map();
  const pendingFrameLoads = new Map();
  const pendingHostRequests = new Map();

  const icons = {
    "check-square": '<path d="M9 11.5l2 2 4.5-5"/><rect x="3.5" y="3.5" width="17" height="17" rx="4"/>',
    link: '<path d="M9.5 14.5l5-5"/><path d="M7.2 17.8l-1 .9a3.6 3.6 0 01-5.1-5.1l3.2-3.2a3.6 3.6 0 015.1 0" transform="translate(3 0)"/><path d="M16.8 6.2l1-.9a3.6 3.6 0 015.1 5.1l-3.2 3.2a3.6 3.6 0 01-5.1 0" transform="translate(-3 0)"/>',
    "book-open": '<path d="M4 5.5c3.2-.7 5.9.1 8 2.2v11c-2.1-2.1-4.8-2.9-8-2.2z"/><path d="M20 5.5c-3.2-.7-5.9.1-8 2.2v11c2.1-2.1 4.8-2.9 8-2.2z"/>',
    "panel-left": '<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M9 4v16"/>',
  };

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.setAttribute(OWNED, "true");
    style.textContent = `
      #${SECTION_ID} { margin: 10px 8px 4px; padding-top: 9px; border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
      #${SECTION_ID} .csk-heading { padding: 5px 9px 7px; color: color-mix(in srgb, currentColor 55%, transparent); font: 650 10px/1.2 ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
      #${SECTION_ID} .csk-menu { width: 100%; height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 9px; border: 0; border-radius: 7px; color: inherit; background: transparent; cursor: pointer; font: 500 13px/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif; text-align: left; }
      #${SECTION_ID} .csk-menu:hover { background: color-mix(in srgb, currentColor 7%, transparent); }
      #${SECTION_ID} .csk-menu[aria-current="page"] { background: color-mix(in srgb, currentColor 10%, transparent); font-weight: 650; }
      #${SECTION_ID} .csk-menu svg { width: 17px; height: 17px; flex: 0 0 17px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
      #${PANEL_ID} { position: fixed; z-index: 40; inset: 0 0 0 260px; overflow: hidden; background: Canvas; }
      #${PANEL_ID}[hidden] { display: none !important; }
      #${PANEL_ID} iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: Canvas; }
      #${PANEL_ID} iframe[hidden] { display: none !important; }
    `;
    document.head.append(style);
  }

  function sidebarScroll() {
    return document.querySelector("[data-app-action-sidebar-scroll]")
      || document.querySelector('aside nav[role="navigation"]')
      || document.querySelector("aside");
  }

  function sidebarSectionAnchor(mount) {
    const nativeSection = mount.querySelector(
      '[data-app-action-sidebar-section-heading="Pinned"], [data-app-action-sidebar-section-heading="Projects"]',
    );
    let anchor = nativeSection;
    while (anchor && anchor.parentElement !== mount) anchor = anchor.parentElement;
    return anchor?.parentElement === mount ? anchor : null;
  }

  function icon(name) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons["panel-left"]}</svg>`;
  }

  function createSection() {
    const node = document.createElement("section");
    node.id = SECTION_ID;
    node.setAttribute(OWNED, "true");
    node.innerHTML = `<div class="csk-heading">${escapeHtml(options.sectionLabel)}</div>`;
    for (const menu of options.menus) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "csk-menu";
      button.dataset.menuId = menu.id;
      button.title = menu.description || menu.label;
      button.innerHTML = `${icon(menu.icon)}<span>${escapeHtml(menu.label)}</span>`;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(menu.id);
      });
      node.append(button);
    }
    return node;
  }

  function escapeHtml(value) {
    const span = document.createElement("span");
    span.textContent = String(value);
    return span.innerHTML;
  }

  function ensureSection() {
    const mount = sidebarScroll();
    if (!mount) return;
    if (!section) section = createSection();
    const anchor = sidebarSectionAnchor(mount);
    if (section.parentElement !== mount || section.nextElementSibling !== anchor) {
      mount.insertBefore(section, anchor);
    }
    syncSelection();
  }

  function ensurePanel() {
    if (panel?.isConnected) return panel;
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute(OWNED, "true");
    document.body.append(panel);
    updatePanelBounds();
    return panel;
  }

  function updatePanelBounds() {
    if (!panel) return;
    const sidebar = document.querySelector("aside") || sidebarScroll();
    const right = sidebar?.getBoundingClientRect().right;
    panel.style.left = `${Number.isFinite(right) && right > 0 ? right : 260}px`;
  }

  function frameFor(menu) {
    if (frames.has(menu.id)) return frames.get(menu.id);
    const frame = document.createElement("iframe");
    frame.name = `codex-sidebar-kit-${menu.id}`;
    frame.title = menu.label;
    frame.hidden = true;
    frame.sandbox = "allow-scripts allow-forms allow-downloads allow-popups";
    ensurePanel().append(frame);
    frames.set(menu.id, frame);
    void loadFrameDocument(frame, menu);
    return frame;
  }

  async function loadFrameDocument(frame, menu) {
    const pageUrl = new URL(menu.path, options.baseUrl).href;
    const id = crypto.randomUUID();
    if (typeof globalThis[HOST_BINDING] !== "function") {
      frame.srcdoc = `<p style="font:14px sans-serif;padding:24px">The Codex Sidebar Kit injector is not connected.</p>`;
      return;
    }
    pendingFrameLoads.set(id, { frame, menu });
    globalThis[HOST_BINDING](JSON.stringify({
      id,
      action: "load-frame",
      frameName: frame.name,
      menuId: menu.id,
      pageUrl,
    }));
  }

  function openMenu(menuId) {
    const menu = options.menus.find((candidate) => candidate.id === menuId);
    if (!menu) return;
    activeMenuId = menu.id;
    const activeFrame = frameFor(menu);
    for (const [id, candidate] of frames) candidate.hidden = id !== menu.id;
    ensurePanel().hidden = false;
    updatePanelBounds();
    syncSelection();
    activeFrame.contentWindow?.postMessage({ channel: CHANNEL, type: "context", context: readContext() }, "*");
  }

  function closeMenu() {
    activeMenuId = null;
    if (panel) panel.hidden = true;
    syncSelection();
  }

  function syncSelection() {
    section?.querySelectorAll(".csk-menu").forEach((button) => {
      if (button.dataset.menuId === activeMenuId) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function activeThreadId() {
    const row = document.querySelector('[data-app-action-sidebar-thread-id][aria-current="page"]')
      || document.querySelector('[data-app-action-sidebar-thread-active="true"]');
    return row?.getAttribute("data-app-action-sidebar-thread-id") || null;
  }

  function activeProjectId() {
    const row = document.querySelector('[data-app-action-sidebar-project-row][aria-current="page"]')
      || document.querySelector('[data-app-action-sidebar-project-active="true"]');
    return row?.getAttribute("data-app-action-sidebar-project-id") || null;
  }

  function readContext() {
    const locationUrl = new URL(window.location.href);
    return {
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      language: document.documentElement.lang || navigator.language,
      projectId: activeProjectId(),
      threadId: activeThreadId(),
      workspacePath: locationUrl.searchParams.get("path"),
      activeMenuId,
    };
  }

  function reply(target, id, result, error) {
    target?.postMessage({ channel: CHANNEL, type: "response", id, result, error }, "*");
  }

  function menuForSource(source) {
    for (const menu of options.menus) {
      if (frames.get(menu.id)?.contentWindow === source) return menu;
    }
    return null;
  }

  function hasCapability(menu, capability) {
    return Array.isArray(menu?.capabilities) && menu.capabilities.includes(capability);
  }

  async function prepareNativeTask(message, source, menu) {
    if (!hasCapability(menu, "native-task")) throw new Error("This menu cannot create native Codex tasks.");
    const workspace = typeof message.params?.workspace === "string" ? message.params.workspace.trim() : "";
    const prompt = typeof message.params?.prompt === "string" ? message.params.prompt.trim() : "";
    if (!workspace || !workspace.startsWith("/")) throw new Error("An absolute workspace path is required.");
    if (!prompt || prompt.length > 8_000) throw new Error("Prompt must contain 1 to 8,000 characters.");
    const bridge = window.electronBridge;
    if (!bridge || typeof bridge.sendMessageFromView !== "function") {
      throw new Error("This Codex version does not expose the native desktop bridge.");
    }
    pendingHostRequests.set(message.id, source);
    await bridge.sendMessageFromView({ type: "electron-set-active-workspace-root", root: workspace });
    closeMenu();
    window.postMessage({
      type: "navigate-to-route",
      path: "/",
      state: { focusComposerNonce: Date.now() },
    }, window.location.origin);
    await new Promise((resolve) => window.setTimeout(resolve, 160));
    if (typeof globalThis[HOST_BINDING] !== "function") {
      pendingHostRequests.delete(message.id);
      throw new Error("The Codex Sidebar Kit injector is not connected.");
    }
    globalThis[HOST_BINDING](JSON.stringify({ id: message.id, action: "prefill", prompt }));
  }

  async function openNativeThread(message, menu) {
    if (!hasCapability(menu, "open-thread")) throw new Error("This menu cannot open Codex conversations.");
    const threadId = typeof message.params?.threadId === "string" ? message.params.threadId.trim() : "";
    if (!threadId || threadId.length > 256) throw new Error("A valid thread id is required.");
    closeMenu();
    window.postMessage({
      type: "navigate-to-route",
      path: `/local/${encodeURIComponent(threadId)}`,
    }, window.location.origin);
    return { opened: true };
  }

  async function onFrameMessage(event) {
    const message = event.data;
    if (!message || message.channel !== CHANNEL || message.type !== "request") return;
    const menu = menuForSource(event.source);
    if (!menu) return;
    try {
      if (message.method === "context.get") {
        if (!hasCapability(menu, "context")) throw new Error("This menu cannot read Codex context.");
        return reply(event.source, message.id, readContext());
      }
      if (message.method === "native.prepareTask") {
        await prepareNativeTask(message, event.source, menu);
        return;
      }
      if (message.method === "native.openThread") {
        return reply(event.source, message.id, await openNativeThread(message, menu));
      }
      throw new Error(`Unknown bridge method: ${message.method}`);
    } catch (error) {
      pendingHostRequests.delete(message.id);
      reply(event.source, message.id, null, error instanceof Error ? error.message : String(error));
    }
  }

  function onHostMessage(event) {
    const message = event.data;
    if (!message || message.channel !== CHANNEL || message.type !== "host-response") return;
    if (pendingFrameLoads.has(message.id)) {
      const { frame, menu } = pendingFrameLoads.get(message.id);
      pendingFrameLoads.delete(message.id);
      if (message.error) {
        frame.srcdoc = `<p style="font:14px sans-serif;padding:24px">Could not load ${escapeHtml(menu.label)}: ${escapeHtml(message.error)}</p>`;
      }
      return;
    }
    const target = pendingHostRequests.get(message.id);
    pendingHostRequests.delete(message.id);
    reply(target, message.id, message.result, message.error);
  }

  function repair() {
    if (destroyed || !document.body) return;
    installStyles();
    ensureSection();
    if (panel?.isConnected) updatePanelBounds();
  }

  function scheduleRepair() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      repair();
    });
  }

  function destroy() {
    destroyed = true;
    observer?.disconnect();
    window.removeEventListener("message", onFrameMessage);
    window.removeEventListener("message", onHostMessage);
    window.removeEventListener("resize", updatePanelBounds);
    section?.remove();
    panel?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  document.addEventListener("click", (event) => {
    if (!activeMenuId) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(`[${OWNED}]`)) return;
    if (target.closest("aside a, aside button")) closeMenu();
  }, true);
  window.addEventListener("message", onFrameMessage);
  window.addEventListener("message", onHostMessage);
  window.addEventListener("resize", updatePanelBounds);
  observer = new MutationObserver(scheduleRepair);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  globalThis[SENTINEL] = { destroy, openMenu, closeMenu };
  repair();
})();
