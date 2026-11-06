#!/usr/bin/env node
// Inject a JSON file into an HTML page template.
// Usage: node render.mjs <template.html> <data.json> <out.html>
// The template contains `/*__DATA__*/null` inside a <script>; it is replaced with the JSON.
// When the data references pins, sources.json next to it (or in ./pins) is merged in as `pins`.

import fs from "node:fs/promises";
import path from "node:path";

async function readJson(p) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const [tpl, dataPath, out] = process.argv.slice(2);
  if (!tpl || !dataPath || !out) {
    console.log("Usage: node render.mjs <template.html> <data.json> <out.html>");
    process.exit(1);
  }
  const template = await fs.readFile(tpl, "utf8");
  const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const dir = path.dirname(dataPath);

  // Merge context the templates can use.
  const sources = (await readJson(path.join(dir, "pins", "sources.json"))) || (await readJson(path.join(dir, "sources.json")));
  const ratings = await readJson(path.join(dir, "ratings.json"));
  const moodboard = path.basename(dataPath) === "moodboard.json" ? null : await readJson(path.join(dir, "moodboard.json"));
  const outDir = path.dirname(path.resolve(out));
  const pinsDir = path.relative(outDir, path.resolve(dir, "pins")) || ".";

  const payload = { ...data, _context: { sources, ratings, moodboard, pinsDir: pinsDir.split(path.sep).join("/") } };
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  if (!template.includes("/*__DATA__*/null")) throw new Error("template is missing /*__DATA__*/null");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(out, template.replace("/*__DATA__*/null", json));
  console.log(`rendered → ${path.resolve(out)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
