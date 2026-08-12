const CHANNEL = "codex-sidebar-kit/v1";
const pending = new Map();
const contextListeners = new Set();

function embedded() {
  return window.parent !== window;
}

function request(method, params = {}) {
  if (!embedded()) {
    return Promise.reject(new Error("Open this page inside Codex Desktop to use the native bridge."));
  }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error("Codex Desktop did not respond."));
    }, 10_000);
    pending.set(id, { resolve, reject, timer });
    window.parent.postMessage({ channel: CHANNEL, type: "request", id, method, params }, "*");
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (!message || message.channel !== CHANNEL) return;
  if (message.type === "response" && pending.has(message.id)) {
    const record = pending.get(message.id);
    pending.delete(message.id);
    window.clearTimeout(record.timer);
    if (message.error) record.reject(new Error(message.error));
    else record.resolve(message.result);
  }
  if (message.type === "context") {
    for (const listener of contextListeners) listener(message.context);
  }
});

export const codex = {
  embedded,
  context: {
    get: () => request("context.get"),
    subscribe(listener) {
      contextListeners.add(listener);
      return () => contextListeners.delete(listener);
    },
  },
  native: {
    prepareTask: ({ workspace, prompt }) => request("native.prepareTask", { workspace, prompt }),
    openThread: (threadId) => request("native.openThread", { threadId }),
  },
};
