/* Ported from seti-agente-comercial (red-hologram/packedMesh.ts). Same packed mesh, served from /avatar. */
import * as THREE from "three";

/** Vertex count baked into `red-hologram-mesh.bin` (from red-hologram-avatar.html). */
export const RED_HOLO_NV = 157_413;

export const RED_HOLO_MESH_URL = "/avatar/seti-hologram-mesh.bin";

export type PackedHoloMesh = {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  normals: Float32Array;
  lum: Float32Array;
  colors: Float32Array;
  curv: Float32Array;
  indices: Uint32Array;
};

/** Decode the packed Int16/Uint8 mesh used by the reference red hologram. */
export async function loadPackedHoloMesh(url = RED_HOLO_MESH_URL): Promise<PackedHoloMesh> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load hologram mesh (${res.status})`);
  const buf = await res.arrayBuffer();
  const NV = RED_HOLO_NV;
  const q = new Int16Array(buf, 0, NV * 3);
  const attr = new Uint8Array(buf, NV * 6, NV * 4);
  const pad = (4 - ((NV * 10) % 4)) % 4;
  const idx = new Uint32Array(buf, NV * 10 + pad);

  const pos = new Float32Array(NV * 3);
  for (let i = 0; i < pos.length; i++) pos[i] = q[i] / 32767;

  const lumF = new Float32Array(NV);
  const colF = new Float32Array(NV * 3);
  const curvF = new Float32Array(NV);
  for (let i = 0; i < NV; i++) {
    const r = attr[i * 4] / 255;
    const g = attr[i * 4 + 1] / 255;
    const b = attr[i * 4 + 2] / 255;
    colF[i * 3] = r;
    colF[i * 3 + 1] = g;
    colF[i * 3 + 2] = b;
    lumF[i] = 0.3 * r + 0.59 * g + 0.11 * b;
    curvF[i] = attr[i * 4 + 3] / 127.5 - 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("lum", new THREE.BufferAttribute(lumF, 1));
  geometry.setAttribute("col", new THREE.BufferAttribute(colF, 3));
  geometry.setAttribute("curv", new THREE.BufferAttribute(curvF, 1));
  geometry.setIndex(new THREE.BufferAttribute(idx, 1));
  geometry.computeVertexNormals();

  const normals = (geometry.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array;

  return {
    geometry,
    positions: pos,
    normals,
    lum: lumF,
    colors: colF,
    curv: curvF,
    indices: idx,
  };
}

export const SETI_LOGO_URL = "/seti-interactive/brand/logo-white.png";

/** Longer side of the grid the isologo PNG is sampled on. */
const LOGO_SAMPLE = 360;
/** Half-size of the isologo in head units, and its vertical centre. */
const LOGO_HALF = 0.9;
const LOGO_CENTER_Y = 0.08;

/**
 * Sample the opaque pixels of the official SETI isologo PNG into normalized
 * [-1, 1] points (x, y pairs, y up). Same approach as the LogoIntro opening in
 * seti-experto-digital, so the mark is the real asset and not a redraw.
 */
export function sampleLogoPixels(src = SETI_LOGO_URL): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const fit = LOGO_SAMPLE / Math.max(img.naturalWidth, img.naturalHeight, 1);
      const w = Math.max(1, Math.round(img.naturalWidth * fit));
      const h = Math.max(1, Math.round(img.naturalHeight * fit));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return reject(new Error("no 2d context"));
      g.drawImage(img, 0, 0, w, h);
      const data = g.getImageData(0, 0, w, h).data;
      const pts: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 120) {
            pts.push(((x + 0.5 - w / 2) / LOGO_SAMPLE) * 2, -((y + 0.5 - h / 2) / LOGO_SAMPLE) * 2);
          }
        }
      }
      if (!pts.length) return reject(new Error("empty logo"));
      resolve(new Float32Array(pts));
    };
    img.onerror = () => reject(new Error("logo failed to load"));
    img.src = src;
  });
}

/**
 * Spread the splats over the sampled isologo pixels as 3D targets, with a little
 * depth so the turn reads as 3D. Falls back to a procedural disc/ring when the
 * logo pixels are not available.
 */
function buildSetiIsologoTargets(
  count: number,
  rnd: () => number,
  logoPixels: Float32Array | null,
): Float32Array {
  const out = new Float32Array(count * 3);
  const cy3 = LOGO_CENTER_Y;
  const write = (i: number, x: number, y: number, z: number) => {
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  };

  if (logoPixels && logoPixels.length >= 2) {
    const n = logoPixels.length / 2;
    const cell = 2 / LOGO_SAMPLE;
    for (let i = 0; i < count; i++) {
      const pick = Math.floor(rnd() * n) * 2;
      write(
        i,
        (logoPixels[pick] + (rnd() - 0.5) * cell) * LOGO_HALF,
        cy3 + (logoPixels[pick + 1] + (rnd() - 0.5) * cell) * LOGO_HALF,
        (rnd() - 0.5) * 0.14 * LOGO_HALF,
      );
    }
    return out;
  }

  // Procedural fallback — disc + ring + arc marks (no wordmark).
  for (let i = 0; i < count; i++) {
    const roll = rnd();
    let x = 0;
    let y = 0;
    if (roll < 0.42) {
      const ang = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.58;
      x = Math.cos(ang) * r;
      y = Math.sin(ang) * r;
    } else if (roll < 0.55) {
      const ang = -0.08 + rnd() * 1.5;
      const r = 0.34 + Math.floor(rnd() * 4) * 0.055 + (rnd() - 0.5) * 0.02;
      x = Math.cos(ang) * r;
      y = Math.sin(ang) * r;
    } else {
      const ang = rnd() * Math.PI * 2;
      const r = 0.82 + (rnd() - 0.5) * 0.07;
      x = Math.cos(ang) * r;
      y = Math.sin(ang) * r;
    }
    write(i, x, cy3 + y, ((i % 5) - 2) * 0.012);
  }
  return out;
}

/**
 * Area-weighted surface samples for the splat layer — same algorithm as the
 * reference HTML (dense face, thinner body; reject some face samples so skin shows).
 */
export function sampleSurfaceSplats(
  mesh: PackedHoloMesh,
  pointCount: number,
  logoPixels: Float32Array | null = null,
): THREE.BufferGeometry {
  const { positions: pos, normals: nrm, lum: lumF, indices: idx } = mesh;
  const triCount = idx.length / 3;
  const areas = new Float32Array(triCount);
  let total = 0;
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  for (let i = 0; i < triCount; i++) {
    A.fromArray(pos, idx[i * 3] * 3);
    B.fromArray(pos, idx[i * 3 + 1] * 3);
    C.fromArray(pos, idx[i * 3 + 2] * 3);
    total += B.sub(A).cross(C.sub(A)).length() * 0.5;
    areas[i] = total;
  }

  const pP = new Float32Array(pointCount * 3);
  const pN = new Float32Array(pointCount * 3);
  const pL = new Float32Array(pointCount);
  const pR = new Float32Array(pointCount);
  // Wind corridors (ported from HologramHead): each splat flies in from one of
  // ten side corridors on boot and blows out along another on disperse.
  const pStart = new Float32Array(pointCount * 3);
  const pExit = new Float32Array(pointCount * 3);
  const pDelay = new Float32Array(pointCount);
  const pWhirl = new Float32Array(pointCount);
  const corridors = [
    [-1.35, 1.15], [1.25, 1.05], [-1.2, -1.2], [1.3, -1.0], [-1.55, 0.2],
    [1.5, -0.15], [0.15, 1.45], [-0.25, -1.4], [-1.1, 0.65], [0.85, -1.25],
  ];
  // Wider than the head so the wind streams come from all around the frame.
  const spread = 1.8;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const pLogo = buildSetiIsologoTargets(pointCount, rnd, logoPixels);
  const sm = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  for (let k = 0; k < pointCount; ) {
    const r = rnd() * total;
    let lo = 0;
    let hi = triCount - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (areas[m] < r) lo = m + 1;
      else hi = m;
    }
    let u = rnd();
    let v = rnd();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    const a = idx[lo * 3];
    const b = idx[lo * 3 + 1];
    const c = idx[lo * 3 + 2];
    for (let j = 0; j < 3; j++) {
      pP[k * 3 + j] = pos[a * 3 + j] * w + pos[b * 3 + j] * u + pos[c * 3 + j] * v;
      pN[k * 3 + j] = nrm[a * 3 + j] * w + nrm[b * 3 + j] * u + nrm[c * 3 + j] * v;
    }
    pL[k] = lumF[a] * w + lumF[b] * u + lumF[c] * v;
    pR[k] = rnd();
    const fx = pP[k * 3];
    const fy = pP[k * 3 + 1];
    const fz = pP[k * 3 + 2];
    const fm =
      sm(0.05, 0.3, fz) *
      sm(-0.16, 0.04, fy) *
      (1 - sm(0.56, 0.76, fy)) *
      (1 - sm(0.2, 0.36, Math.abs(fx)));
    if (rnd() < fm * 0.1) continue;
    {
      const radial = Math.hypot(fx, fy, fz);
      pDelay[k] = Math.min(1, radial * 0.22 + rnd() * 0.7);
      const c = corridors[k % corridors.length];
      const jitter = 0.55 + rnd() * 0.9;
      const startR = spread * (1.35 + (k % 11) * 0.08 + rnd() * 1.65);
      const slip = (rnd() - 0.5) * spread * 0.85;
      pStart[k * 3] = c[0] * startR * jitter + slip * c[1];
      pStart[k * 3 + 1] = c[1] * startR * jitter - slip * c[0] * 0.6;
      pStart[k * 3 + 2] = fz * 0.2 + (rnd() - 0.5) * spread * 0.55;
      pWhirl[k] = (0.55 + rnd() * 1.35) * (k % 2 === 0 ? 1 : -1);
      const e = corridors[(k * 3 + 2) % corridors.length];
      const exitR = spread * (6.5 + rnd() * 7.5);
      const exitJ = 0.7 + rnd() * 0.7;
      pExit[k * 3] = e[0] * exitR * exitJ + (rnd() - 0.5) * spread * 1.2;
      pExit[k * 3 + 1] = e[1] * exitR * exitJ + (rnd() - 0.5) * spread * 1.1;
      pExit[k * 3 + 2] = (rnd() - 0.5) * spread * 2.2;
    }
    k += 1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pP, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(pN, 3));
  geo.setAttribute("lum", new THREE.BufferAttribute(pL, 1));
  geo.setAttribute("rnd", new THREE.BufferAttribute(pR, 1));
  geo.setAttribute("aStart", new THREE.BufferAttribute(pStart, 3));
  geo.setAttribute("aExit", new THREE.BufferAttribute(pExit, 3));
  geo.setAttribute("aDelay", new THREE.BufferAttribute(pDelay, 1));
  geo.setAttribute("aWhirl", new THREE.BufferAttribute(pWhirl, 1));
  geo.setAttribute("aLogo", new THREE.BufferAttribute(pLogo, 3));
  // Splats travel far from the head during boot/disperse — never cull them.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
  return geo;
}
