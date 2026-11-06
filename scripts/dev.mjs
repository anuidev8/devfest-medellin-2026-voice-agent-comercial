#!/usr/bin/env node
/**
 * One command to run the whole stack locally:
 *
 *   npm run dev            → agent (ADK + AG-UI :8000) + web (Next.js :3000) + LiveKit voice worker
 *   npm run dev -- --no-livekit   → skip the Python voice worker
 *
 * Each process keeps its own logs, prefixed and colored. Ctrl+C stops all of them.
 * If one process crashes, the others keep running (so you can read the error and fix it).
 * No extra dependencies: plain Node child_process.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

const color = { agent: "\x1b[35m", web: "\x1b[36m", livekit: "\x1b[33m", sys: "\x1b[90m" };
const reset = "\x1b[0m";
const log = (name, line) => process.stdout.write(`${color[name] ?? ""}[${name.padEnd(7)}]${reset} ${line}\n`);

function envFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*([^#\n]*)/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );
}

// --- Pre-flight checks (warn, never block) ---------------------------------
const missing = [
  ["packages/agent/.env", "packages/agent/.env.example"],
  ["apps/web/.env.local", "apps/web/.env.example"],
  ["packages/livekit/.env", "packages/livekit/.env.example"],
].filter(([f]) => !existsSync(join(root, f)));
for (const [f, ex] of missing) log("sys", `⚠ missing ${f}  →  run: npm run setup   (or cp ${ex} ${f})`);
if (!existsSync(join(root, "node_modules"))) {
  log("sys", "✖ node_modules missing → run: npm run setup");
  process.exit(1);
}

// --- Decide whether the LiveKit worker can run -----------------------------
const venvPy = join(root, "packages/livekit/.venv/bin/python");
const lkEnv = { ...envFile(join(root, "apps/web/.env.local")), ...envFile(join(root, "packages/livekit/.env")) };
const lkConfigured = Boolean(lkEnv.LIVEKIT_API_KEY && lkEnv.LIVEKIT_API_SECRET);
let runLivekit = !args.has("--no-livekit");
if (runLivekit && !existsSync(venvPy)) {
  log("sys", "⚠ packages/livekit/.venv not found → skipping voice worker (run: npm run setup)");
  runLivekit = false;
}
if (runLivekit && !lkConfigured) {
  log("sys", "⚠ LIVEKIT_API_KEY/SECRET empty → skipping voice worker (chat + Web Speech voice still work)");
  runLivekit = false;
}

// --- Start processes -------------------------------------------------------
const procs = [
  { name: "agent", cmd: "npm", args: ["run", "dev", "-w", "@commercial/agent"], cwd: root },
  { name: "web", cmd: "npm", args: ["run", "dev", "-w", "web"], cwd: root },
  ...(runLivekit
    ? [{ name: "livekit", cmd: venvPy, args: ["agent.py", "dev"], cwd: join(root, "packages/livekit") }]
    : []),
];

const children = [];
for (const p of procs) {
  const child = spawn(p.cmd, p.args, {
    cwd: p.cwd,
    env: { ...process.env, FORCE_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const pipe = (stream) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) log(p.name, line);
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code, signal) => log("sys", `${p.name} exited (${signal ?? code})`));
  children.push(child);
}

log("sys", "──────────────────────────────────────────────────────────");
log("sys", "web      → http://localhost:3000   (audience: /audience)");
log("sys", "agent    → http://localhost:8000/health   (AG-UI: /ag-ui)");
log("sys", runLivekit ? "livekit  → worker registered on LiveKit Cloud (dev mode)" : "livekit  → not started");
log("sys", "Ctrl+C to stop everything");
log("sys", "──────────────────────────────────────────────────────────");

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  log("sys", "stopping…");
  for (const c of children) if (c.exitCode === null) c.kill("SIGINT");
  setTimeout(() => {
    for (const c of children) if (c.exitCode === null) c.kill("SIGKILL");
    process.exit(0);
  }, 5000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
