import type * as THREE_NS from "three";

type THREE = typeof THREE_NS;

/**
 * The body "becomes the community": points sampled from the avatar's own surface fly out
 * onto three tilted orbit rings (uMix 0 → 1), and a small share can be thrown toward the
 * top-right for the "send" act (uBurst 0 → 1). Lives in the mesh's local space.
 */
export function createDissolve(
  three: THREE,
  geometry: THREE_NS.BufferGeometry,
  o: { count: number; center: number[]; radius: number; colorA: string; colorB: string },
) {
  const pos = geometry.getAttribute("position");
  const n = Math.min(o.count, pos.count);
  const step = pos.count / n;
  const start = new Float32Array(n * 3);
  const target = new Float32Array(n * 3);
  const delay = new Float32Array(n);
  const seed = new Float32Array(n);
  const RINGS = [0.55, 0.8, 1.05];

  for (let i = 0; i < n; i++) {
    const v = Math.floor(i * step);
    start[i * 3] = pos.getX(v);
    start[i * 3 + 1] = pos.getY(v);
    start[i * 3 + 2] = pos.getZ(v);
    const ring = i % 3;
    const a = Math.random() * Math.PI * 2;
    const r = RINGS[ring]! * o.radius * (1 + (Math.random() - 0.5) * 0.04);
    // Ring in its own plane; tilt + spin are applied in the shader so it keeps orbiting.
    target[i * 3] = Math.cos(a) * r;
    target[i * 3 + 1] = (Math.random() - 0.5) * 0.02 * o.radius;
    target[i * 3 + 2] = Math.sin(a) * r;
    delay[i] = Math.random() * 0.4;
    seed[i] = ring / 3 + Math.random() / 3;
  }

  const geo = new three.BufferGeometry();
  geo.setAttribute("position", new three.BufferAttribute(start, 3));
  geo.setAttribute("aTarget", new three.BufferAttribute(target, 3));
  geo.setAttribute("aDelay", new three.BufferAttribute(delay, 1));
  geo.setAttribute("aSeed", new three.BufferAttribute(seed, 1));

  const uniforms = {
    uMix: { value: 0 },
    uBurst: { value: 0 },
    uTime: { value: 0 },
    uPx: { value: 300 },
    uCenter: { value: new three.Vector3(...(o.center as [number, number, number])) },
    uScale: { value: o.radius },
    uColA: { value: new three.Color(o.colorA) },
    uColB: { value: new three.Color(o.colorB) },
  };

  const material = new three.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec3 aTarget;
      attribute float aDelay;
      attribute float aSeed;
      uniform float uMix, uBurst, uTime, uPx, uScale;
      uniform vec3 uCenter;
      varying float vAlpha;
      varying float vSeed;
      vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
      vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
      void main() {
        float ring = floor(aSeed * 3.0);
        float dir = mod(ring, 2.0) < 0.5 ? 1.0 : -1.0;
        vec3 tgt = rotX(rotY(aTarget, uTime * (0.35 - ring * 0.08) * dir), 0.38 + ring * 0.06) + uCenter;
        float m = clamp(uMix * 1.4 - aDelay, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);
        vec3 p = mix(position, tgt, m);
        float node = step(0.985, fract(aSeed * 31.7));
        float thrown = step(fract(aSeed * 7.13), 0.22);
        float b = clamp(uBurst * 1.3 - aDelay, 0.0, 1.0);
        p += thrown * vec3(1.5, 1.15, 0.6) * uScale * b * b;
        vAlpha = max(m * (0.75 + 0.25 * node), thrown * min(1.0, b * (1.0 - b) * 5.0));
        vSeed = aSeed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.85 + node * 2.4 + thrown * b * 1.6) * uPx / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColA, uColB;
      varying float vAlpha;
      varying float vSeed;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        if (r > 0.5 || vAlpha < 0.01) discard;
        float a = vAlpha * (1.0 - smoothstep(0.35, 0.5, r));
        gl_FragColor = vec4(mix(uColA, uColB, vSeed), a);
      }`,
  });

  const points = new three.Points(geo, material);
  points.frustumCulled = false;
  return { points, uniforms, dispose: () => (geo.dispose(), material.dispose()) };
}
