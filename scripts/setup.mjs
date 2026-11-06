#!/usr/bin/env node
/**
 * First-time setup (safe to re-run):
 *   1. Copies .env.example → .env / .env.local where missing (never overwrites)
 *   2. npm install (all workspaces)
 *   3. Python venv + pip install for packages/livekit (skipped if python3.10+ not found)
 *
 *   npm run setup
 */
import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: "inherit" });
const step = (s) => console.log(`\n\x1b[36m▸ ${s}\x1b[0m`);

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(`✖ Node ${process.versions.node} found, need >= 22 (nvm install 24)`);
  process.exit(1);
}

step("Env files");
for (const [example, target] of [
  ["packages/agent/.env.example", "packages/agent/.env"],
  ["apps/web/.env.example", "apps/web/.env.local"],
  ["packages/livekit/.env.example", "packages/livekit/.env"],
]) {
  if (existsSync(join(root, target))) console.log(`  ✓ ${target} exists (kept)`);
  else {
    copyFileSync(join(root, example), join(root, target));
    console.log(`  + ${target} created from ${example} → fill in your keys`);
  }
}

step("npm install");
run("npm install");

step("Python voice worker (packages/livekit)");
const lk = join(root, "packages/livekit");
const venvPy = join(lk, ".venv/bin/python");
if (!existsSync(venvPy)) {
  const python = ["python3.12", "python3.13", "python3.11", "python3.10", "python3"].find(
    (p) => spawnSync(p, ["-c", "import sys; assert sys.version_info >= (3, 10)"]).status === 0,
  );
  if (!python) {
    console.log("  ⚠ Python >= 3.10 not found — skipping. Install it (brew install python@3.12) and re-run.");
  } else {
    run(`${python} -m venv .venv`, lk);
  }
}
if (existsSync(venvPy)) {
  run(`${venvPy} -m pip install -q --upgrade pip`, lk);
  run(`${venvPy} -m pip install -q -r requirements.txt`, lk);
  // Downloads turn-detector / VAD model files used by livekit-agents (ok to fail offline).
  spawnSync(venvPy, ["-m", "livekit.agents", "download-files"], { cwd: lk, stdio: "inherit" });
  console.log("  ✓ venv ready");
}

console.log(`
\x1b[32m✓ Setup done.\x1b[0m Next:
  1. Fill keys → docs/guides/google-adk/01-google-adk.md, docs/guides/livekit/02-livekit.md
  2. npm run dev        (everything)   ·   npm run dev -- --no-livekit   (chat only)
  3. open http://localhost:3000
`);
