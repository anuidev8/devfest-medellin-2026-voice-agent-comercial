#!/usr/bin/env node
// Add the dominant colors of each image to <dir>/sources.json.
// Usage: node extract-palette.mjs design/pins [--colors 6]
// Decoding: uses `sharp` if installed; otherwise macOS `sips` (built in). If neither works,
// the pin gets "palette": null and the agent picks colors by looking at the image.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const SIZE = 64;

async function pixelsWithSharp(file) {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(file)
    .resize(SIZE, SIZE, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < data.length; i += info.channels) px.push([data[i], data[i + 1], data[i + 2]]);
  return px;
}

// sips → 24/32-bit BMP, then parse the BMP ourselves.
async function pixelsWithSips(file) {
  const tmp = path.join(os.tmpdir(), `palette-${process.pid}-${Date.now()}.bmp`);
  await run("sips", ["-s", "format", "bmp", "-Z", String(SIZE), file, "--out", tmp]);
  const b = await fs.readFile(tmp);
  await fs.rm(tmp, { force: true });
  const offset = b.readUInt32LE(10);
  const w = b.readInt32LE(18);
  const hRaw = b.readInt32LE(22);
  const h = Math.abs(hRaw);
  const bpp = b.readUInt16LE(28);
  if (bpp !== 24 && bpp !== 32) throw new Error(`unsupported BMP ${bpp}bpp`);
  const bytes = bpp / 8;
  const row = Math.ceil((w * bytes) / 4) * 4;
  const px = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = offset + y * row + x * bytes;
      px.push([b[i + 2], b[i + 1], b[i]]);
    }
  }
  return px;
}

async function pixels(file) {
  try {
    return await pixelsWithSharp(file);
  } catch {
    if (process.platform === "darwin") return pixelsWithSips(file);
    throw new Error("install sharp (npm i -D sharp) to extract palettes on this OS");
  }
}

// Deterministic k-means with k-means++-style farthest-point seeding.
function kmeans(px, k) {
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const centers = [px[Math.floor(px.length / 2)]];
  while (centers.length < k) {
    let best = null;
    let bestD = -1;
    for (const p of px) {
      const d = Math.min(...centers.map((c) => dist(p, c)));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    centers.push(best);
  }
  let assign = new Array(px.length).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    assign = px.map((p) => {
      let bi = 0;
      let bd = Infinity;
      centers.forEach((c, i) => {
        const d = dist(p, c);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      return bi;
    });
    for (let i = 0; i < k; i++) {
      const members = px.filter((_, j) => assign[j] === i);
      if (members.length) {
        centers[i] = [0, 1, 2].map((ch) => members.reduce((s, m) => s + m[ch], 0) / members.length);
      }
    }
  }
  const counts = new Array(k).fill(0);
  assign.forEach((a) => counts[a]++);
  return centers
    .map((c, i) => ({ rgb: c.map(Math.round), share: counts[i] / px.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}

const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--")) || "design/pins";
  const ci = args.indexOf("--colors");
  const k = ci >= 0 ? Number(args[ci + 1]) : 6;
  const sourcesPath = path.join(dir, "sources.json");
  const sources = JSON.parse(await fs.readFile(sourcesPath, "utf8"));

  for (const pin of sources.pins) {
    try {
      const px = await pixels(path.join(dir, pin.file));
      pin.palette = kmeans(px, k).map((c) => ({ hex: hex(c.rgb), share: Math.round(c.share * 100) / 100 }));
      console.log(`✓ ${pin.file}  ${pin.palette.map((c) => c.hex).join(" ")}`);
    } catch (e) {
      pin.palette = null;
      console.log(`✗ ${pin.file}  — ${e.message || e}`);
    }
  }
  await fs.writeFile(sourcesPath, JSON.stringify(sources, null, 2) + "\n");
  console.log(`palettes written → ${sourcesPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
