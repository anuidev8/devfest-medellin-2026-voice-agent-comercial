#!/usr/bin/env node
// Show the design pages: serves the design/ folder on localhost, writes a hub page, opens the browser.
// Returns immediately (the server keeps running in the background), so agents don't block on it.
//
//   node serve.mjs design            # serve + open the hub (http://localhost:4600/)
//   node serve.mjs design preview    # open a specific page (preview.html)
//   node serve.mjs design --no-open  # just print the URL
//   node serve.mjs --stop            # stop the background server
//
// Re-running is safe: if a server for the same folder is already up, it is reused.

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const PID_FILE = path.join(os.tmpdir(), "ai-design-framework-serve.json");
const BASE_PORT = 4600;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".mp4": "video/mp4",
};

const PAGES = [
  ["moodboard.html", "Mood board", "Top references, palette, type, feel"],
  ["proposal.html", "Proposal", "Colors, type, motion meanings, interactions"],
  ["preview.html", "Preview", "Working HTML prototype — try it before any app code"],
];

async function readJson(p) {
  try { return JSON.parse(await fsp.readFile(p, "utf8")); } catch { return null; }
}

async function hub(root) {
  const proposal = await readJson(path.join(root, "proposal.json"));
  const ratings = await readJson(path.join(root, "ratings.json"));
  const title = proposal?.direction?.name || "Design";
  const cards = [];
  for (const [file, name, desc] of PAGES) {
    const exists = fs.existsSync(path.join(root, file));
    let status = exists ? "ready" : "not yet";
    if (file === "proposal.html" && exists) status = proposal?.approved ? "approved" : "waiting for approval";
    cards.push(`<a class="card ${exists ? "" : "off"}" ${exists ? `href="${file}"` : ""}><b>${name}</b><span>${desc}</span><em>${status}</em></a>`);
  }
  const top = (ratings?.selected || []).map((f) => `<img src="pins/${encodeURI(f)}" alt="">`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Design hub</title><style>
:root{--bg:#f7f6f3;--s:#fff;--t:#1a1a1a;--m:#6b6b6b;--l:#e6e3dd}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--s:#1c1c1c;--t:#f1f1f1;--m:#a0a0a0;--l:#2c2c2c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--t);font:16px/1.5 system-ui,sans-serif}
main{max-width:960px;margin:0 auto;padding:48px 16px}h1{font-size:clamp(2rem,5vw,3rem);margin:0 0 4px;letter-spacing:-.02em}
p{color:var(--m);margin:0 0 32px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.card{display:flex;flex-direction:column;gap:6px;padding:20px;border-radius:14px;background:var(--s);border:1px solid var(--l);color:inherit;text-decoration:none}
.card:hover,.card:focus-visible{border-color:var(--t)}.card span{color:var(--m);font-size:.92rem}.card em{font-style:normal;font-size:.8rem;color:var(--m)}
.off{opacity:.45}.pins{display:flex;gap:8px;margin-top:32px;overflow-x:auto}.pins img{height:120px;border-radius:10px}
</style></head><body><main><h1>${title}</h1><p>Design hub — every artifact from the ai-design-framework run.</p>
<div class="grid">${cards.join("")}</div>${top ? `<div class="pins">${top}</div>` : ""}</main></body></html>`;
}

function serve(root, port) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/__ai_design_root") { res.end(root); return; }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" });
      res.end(await hub(root));
      return;
    }
    const file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      const data = await fsp.readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  server.listen(port, "127.0.0.1");
}

async function rootAt(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/__ai_design_root`, { signal: AbortSignal.timeout(500) });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = http.createServer().once("error", () => resolve(false)).once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try { spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true }).unref(); } catch {}
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--foreground")) {
    serve(path.resolve(args[args.indexOf("--foreground") + 1]), Number(args[args.indexOf("--port") + 1]));
    return;
  }

  if (args.includes("--stop")) {
    const info = await readJson(PID_FILE);
    if (info?.pid) { try { process.kill(info.pid); console.log(`stopped server on port ${info.port}`); } catch { console.log("no server running"); } }
    await fsp.rm(PID_FILE, { force: true });
    return;
  }

  const positional = args.filter((a) => !a.startsWith("--"));
  const root = path.resolve(positional[0] || "design");
  const page = positional[1] ? (positional[1].endsWith(".html") ? positional[1] : `${positional[1]}.html`) : "";
  if (!fs.existsSync(root)) { console.error(`folder not found: ${root}`); process.exit(1); }

  let port = null;
  for (let p = BASE_PORT; p < BASE_PORT + 20; p++) {
    const existing = await rootAt(p);
    if (existing === root) { port = p; break; }
    if (existing === null && (await portFree(p))) {
      const child = spawn(process.execPath, [SELF, "--foreground", root, "--port", String(p)], { stdio: "ignore", detached: true });
      child.unref();
      await fsp.writeFile(PID_FILE, JSON.stringify({ pid: child.pid, port: p, root }));
      for (let i = 0; i < 20 && (await rootAt(p)) !== root; i++) await new Promise((r) => setTimeout(r, 100));
      port = p;
      break;
    }
  }
  if (!port) { console.error("no free port between 4600 and 4619"); process.exit(1); }

  const url = `http://localhost:${port}/${page}`;
  console.log(`Design hub: http://localhost:${port}/`);
  if (page) console.log(`Opened:     ${url}`);
  if (!args.includes("--no-open")) openBrowser(url);
}

main().catch((e) => { console.error(e); process.exit(1); });
