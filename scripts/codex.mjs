#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, lstat, mkdir, readlink, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sidebarConfig from "../sidebar.config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const debugPort = Number(process.env.SIDEBAR_KIT_CDP_PORT || 9229);
const webPort = Number(process.env.SIDEBAR_KIT_PORT || 43119);
const appPath = process.env.CODEX_APP_PATH || await findCodexApp();
const profilePath = process.env.SIDEBAR_KIT_CODEX_PROFILE
  || path.join(os.homedir(), "Library/Application Support/Codex Sidebar Kit/codex-profile");
const children = new Set();
const appUrl = `http://127.0.0.1:${webPort}`;

await installConfiguredSkills();
const appEnvironment = {
  ...process.env,
  SIDEBAR_KIT_URL: appUrl,
  SIDEBAR_KIT_CLI_PATH: path.join(ROOT, "scripts/sidebarctl.mjs"),
};

const server = start(process.execPath, [path.join(ROOT, "server/index.mjs")], {
  ...appEnvironment,
  SIDEBAR_KIT_PORT: String(webPort),
});
await waitForUrl(`http://127.0.0.1:${webPort}/health`, 8_000);

await mkdir(profilePath, { recursive: true });
const appExecutable = path.join(
  appPath,
  "Contents/MacOS",
  path.basename(appPath, ".app"),
);
console.log(`Opening ${appPath} with isolated profile ${profilePath}`);
start(appExecutable, [
  `--user-data-dir=${profilePath}`,
  "--remote-debugging-address=127.0.0.1",
  `--remote-debugging-port=${debugPort}`,
  `--remote-allow-origins=http://127.0.0.1:${debugPort}`,
], appEnvironment, "ignore");

const injector = start(process.execPath, [path.join(ROOT, "scripts/inject.mjs"), "--port", String(debugPort)], {
  ...appEnvironment,
});

const exitCode = await new Promise((resolve) => {
  injector.once("exit", (code) => resolve(code ?? 1));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => resolve(0));
});
for (const child of children) child.kill("SIGTERM");
process.exitCode = exitCode;

function start(command, args, env, stdio = "inherit") {
  const child = spawn(command, args, { cwd: ROOT, env, stdio });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

async function findCodexApp() {
  const candidates = [
    "/Applications/Codex.app",
    path.join(os.homedir(), "Applications/Codex.app"),
    "/Applications/ChatGPT.app",
    path.join(os.homedir(), "Applications/ChatGPT.app"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("Install Codex Desktop or set CODEX_APP_PATH to its .app path");
}

async function installConfiguredSkills() {
  const skillRoot = path.join(os.homedir(), ".agents/skills");
  await mkdir(skillRoot, { recursive: true });
  const skillPaths = [...new Set(
    sidebarConfig.menus
      .map((menu) => menu.skill)
      .filter((value) => typeof value === "string" && value.trim()),
  )];
  for (const relativeSkillPath of skillPaths) {
    const source = path.resolve(ROOT, relativeSkillPath);
    if (!source.startsWith(`${ROOT}${path.sep}`)) throw new Error(`Skill path escapes the repository: ${relativeSkillPath}`);
    await access(path.join(source, "SKILL.md"));
    const target = path.join(skillRoot, path.basename(source));
    try {
      const metadata = await lstat(target);
      if (metadata.isSymbolicLink()) {
        const current = path.resolve(path.dirname(target), await readlink(target));
        if (current === source) continue;
      }
      console.warn(`Skill '${path.basename(source)}' already exists at ${target}; leaving it unchanged.`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await symlink(source, target, "dir");
      console.log(`Installed Codex Skill: ${target}`);
    }
  }
}

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
