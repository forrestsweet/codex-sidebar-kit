import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUNTIME_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "injected.js");
const PAYLOAD_TOKEN = "__SIDEBAR_KIT_PAYLOAD__";

export async function buildInjectionSource({ config, baseUrl }) {
  const source = await readFile(RUNTIME_FILE, "utf8");
  if (!source.includes(PAYLOAD_TOKEN)) throw new Error("Injected runtime payload marker is missing");
  const payload = {
    appId: config.appId,
    sectionLabel: config.sectionLabel,
    menus: config.menus,
    baseUrl: new URL(baseUrl).origin,
  };
  return source.replace(PAYLOAD_TOKEN, JSON.stringify(payload).replaceAll("<", "\\u003c"));
}
