#!/usr/bin/env node
// Download reference images from Pinterest pins, pin.it short links, direct image URLs or local files.
// Usage: node fetch-pins.mjs --out design/pins <link> [link ...]
//        node fetch-pins.mjs --out design/pins --file links.txt
// Writes <out>/<NN>-<slug>.<ext> and <out>/sources.json. Node 18+, no dependencies.

import fs from "node:fs/promises";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

function parseArgs(argv) {
  const opts = { out: "design/pins", links: [], file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a === "--file") opts.file = argv[++i];
    else if (a === "-h" || a === "--help") opts.help = true;
    else opts.links.push(a);
  }
  return opts;
}

function slugify(s, max = 40) {
  return (s || "pin")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max) || "pin";
}

function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function meta(html, prop) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i"
  );
  const m = html.match(re);
  return m ? decodeEntities(m[1] ?? m[2]) : null;
}

// i.pinimg.com/236x/ab/cd/ef/x.jpg -> candidates from largest to the original size
function pinimgCandidates(url) {
  const m = url.match(/^(https:\/\/i\.pinimg\.com)\/[^/]+\/(.+)$/);
  if (!m) return [url];
  const [, host, rest] = m;
  return [...new Set([`${host}/originals/${rest}`, `${host}/1200x/${rest}`, `${host}/736x/${rest}`, url])];
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url };
}

async function download(urls, destBase) {
  let lastErr;
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { "user-agent": UA }, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") || "";
      if (!type.startsWith("image/")) throw new Error(`not an image (${type})`);
      const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg").split(";")[0];
      const buf = Buffer.from(await res.arrayBuffer());
      const file = `${destBase}.${ext}`;
      await fs.writeFile(file, buf);
      return { file, imageUrl: u, bytes: buf.length };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("no candidate image URL");
}

async function handle(link, index, outDir) {
  const n = String(index + 1).padStart(2, "0");

  // Local file
  if (!/^https?:\/\//i.test(link)) {
    const src = path.resolve(link);
    await fs.access(src);
    const ext = path.extname(src) || ".jpg";
    const name = `${n}-${slugify(path.basename(src, ext))}${ext}`;
    await fs.copyFile(src, path.join(outDir, name));
    return { id: n, file: name, sourceType: "local-file", inputUrl: link, title: path.basename(src) };
  }

  // Direct image URL
  if (IMAGE_EXT.test(link) || /i\.pinimg\.com/.test(link)) {
    const r = await download(pinimgCandidates(link), path.join(outDir, `${n}-image`));
    return { id: n, file: path.basename(r.file), sourceType: "image-url", inputUrl: link, imageUrl: r.imageUrl, title: null };
  }

  // Pinterest pin / short link / any page with og:image
  const { html, finalUrl } = await fetchText(link);
  const og = meta(html, "og:image") || meta(html, "twitter:image:src") || meta(html, "twitter:image");
  if (!og) throw new Error("no og:image found (private pin or login wall?)");
  const title = meta(html, "og:title") || meta(html, "twitter:title");
  const description = meta(html, "og:description") || meta(html, "description");
  const sourceLink = (html.match(/"link"\s*:\s*"(https?:[^"]+)"/) || [])[1]?.replace(/\\\//g, "/") || null;
  const r = await download(pinimgCandidates(og), path.join(outDir, `${n}-${slugify(title)}`));
  return {
    id: n,
    file: path.basename(r.file),
    sourceType: /pinterest\./.test(finalUrl) ? "pinterest-pin" : "web-page",
    inputUrl: link,
    pinUrl: finalUrl.split("?")[0],
    imageUrl: r.imageUrl,
    title,
    description,
    originalSource: sourceLink && !/pinterest\./.test(sourceLink) ? sourceLink : null,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.file) {
    const txt = await fs.readFile(opts.file, "utf8");
    opts.links.push(...txt.split(/\s+/).filter(Boolean));
  }
  if (opts.help || opts.links.length === 0) {
    console.log("Usage: node fetch-pins.mjs --out design/pins <pinterest-url|image-url|local-file> ...");
    process.exit(opts.help ? 0 : 1);
  }
  const outDir = path.resolve(opts.out);
  await fs.mkdir(outDir, { recursive: true });

  const pins = [];
  const failed = [];
  // Small concurrency so Pinterest doesn't rate-limit us.
  const queue = opts.links.map((l, i) => [l, i]);
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const [link, i] = queue.shift();
      try {
        const pin = await handle(link, i, outDir);
        pins.push(pin);
        console.log(`✓ ${pin.file}${pin.title ? `  — ${pin.title}` : ""}`);
      } catch (e) {
        failed.push({ inputUrl: link, error: String(e.message || e) });
        console.log(`✗ ${link}  — ${e.message || e}`);
      }
    }
  });
  await Promise.all(workers);
  pins.sort((a, b) => a.id.localeCompare(b.id));

  const sourcesPath = path.join(outDir, "sources.json");
  await fs.writeFile(
    sourcesPath,
    JSON.stringify({ fetchedAt: new Date().toISOString(), pins, failed }, null, 2) + "\n"
  );
  console.log(`\n${pins.length} downloaded, ${failed.length} failed → ${sourcesPath}`);
  if (pins.length === 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
