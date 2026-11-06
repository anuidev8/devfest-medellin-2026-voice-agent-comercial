import type * as THREE_NS from "three";
import type { OrbState } from "../VoiceOrb";
import type { Gesture } from "./config";

type THREE = typeof THREE_NS;
type Vec3 = readonly number[];
type Range = readonly number[];

export type Landmarks = {
  chestPivot: Vec3;
  neckPivot: Vec3;
  headPivot: Vec3;
  jawPivot: Vec3;
  chestBlend: Range;
  neckBlend: Range;
  headBlend: Range;
  jawBelowY: Range;
  jawAboveY: Range;
  jawFrontZ: Range;
  jawHalfWidth: Range;
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Turns an unrigged bust into a SkinnedMesh with root → chest → neck → head → jaw bones.
 * Weights blend by height (and face depth for the jaw), so motion bends smoothly at the neck.
 */
export function buildProceduralRig(three: THREE, mesh: THREE_NS.Mesh, lm: Landmarks) {
  const geometry = mesh.geometry;
  const pos = geometry.getAttribute("position");
  const n = pos.count;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  // bone order: 0 root, 1 chest, 2 neck, 3 head, 4 jaw
  const w = new Float32Array(5);

  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    w.fill(0);
    w[0] = 1;
    const push = (bone: number, amount: number) => {
      for (let b = 0; b < 5; b++) w[b]! *= 1 - amount;
      w[bone]! += amount;
    };
    push(1, smooth(lm.chestBlend[0]!, lm.chestBlend[1]!, y));
    push(2, smooth(lm.neckBlend[0]!, lm.neckBlend[1]!, y));
    push(3, smooth(lm.headBlend[0]!, lm.headBlend[1]!, y));
    const jaw =
      smooth(lm.jawBelowY[0]!, lm.jawBelowY[1]!, y) *
      smooth(lm.jawAboveY[0]!, lm.jawAboveY[1]!, y) *
      smooth(lm.jawFrontZ[0]!, lm.jawFrontZ[1]!, z) *
      smooth(lm.jawHalfWidth[0]!, lm.jawHalfWidth[1]!, Math.abs(x));
    const toJaw = w[3]! * jaw;
    w[3]! -= toJaw;
    w[4]! += toJaw;

    // keep the 4 strongest
    const order = [0, 1, 2, 3, 4].sort((a, b) => w[b]! - w[a]!).slice(0, 4);
    const sum = order.reduce((s, b) => s + w[b]!, 0) || 1;
    order.forEach((b, k) => {
      skinIndex[i * 4 + k] = b;
      skinWeight[i * 4 + k] = w[b]! / sum;
    });
  }
  geometry.setAttribute("skinIndex", new three.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new three.Float32BufferAttribute(skinWeight, 4));

  const at = (p: Vec3) => new three.Vector3(p[0], p[1], p[2]);
  const root = new three.Bone();
  const chest = new three.Bone();
  const neck = new three.Bone();
  const head = new three.Bone();
  const jaw = new three.Bone();
  root.position.set(0, 0, 0);
  chest.position.copy(at(lm.chestPivot));
  neck.position.copy(at(lm.neckPivot).sub(at(lm.chestPivot)));
  head.position.copy(at(lm.headPivot).sub(at(lm.neckPivot)));
  jaw.position.copy(at(lm.jawPivot).sub(at(lm.headPivot)));
  root.add(chest);
  chest.add(neck);
  neck.add(head);
  head.add(jaw);

  const skinned = new three.SkinnedMesh(geometry, mesh.material);
  skinned.name = mesh.name;
  skinned.position.copy(mesh.position);
  skinned.quaternion.copy(mesh.quaternion);
  skinned.scale.copy(mesh.scale);
  skinned.frustumCulled = false;
  skinned.add(root);
  const parent = mesh.parent!;
  parent.add(skinned);
  parent.remove(mesh);
  parent.updateMatrixWorld(true);
  skinned.bind(new three.Skeleton([root, chest, neck, head, jaw]));

  return { skinned, bones: { root, chest, neck, head, jaw } };
}

export type Bones = ReturnType<typeof buildProceduralRig>["bones"];

const GESTURE_SECONDS: Record<Gesture, number> = {
  greet: 1.8,
  leanIn: 1.1,
  openUp: 1.4,
  present: 1.8,
  throw: 1.0,
  celebrate: 1.8,
};

export type PerformInput = {
  t: number;
  dt: number;
  state: OrbState;
  gesture: Gesture;
  /** Seconds since the act (and its gesture) started. */
  actTime: number;
  /** Sustained per-act posture. */
  act: "intro" | "context" | "community" | "proposal" | "send" | "booked";
  /** 0..1 voice level while speaking. */
  mouth: number;
  still: boolean;
};

/** Creates the acting controller: computes target pose each frame and eases the bones toward it. */
export function createPerformer(bones: Bones) {
  const cur = { chestX: 0, neckX: 0, headX: 0, headY: 0, headZ: 0, jaw: 0, lift: 0 };
  const baseRootY = bones.root.position.y;

  return {
    gestureSeconds: (g: Gesture) => GESTURE_SECONDS[g],
    update(p: PerformInput) {
      const t = p.still ? 0 : p.t;
      const tg = { chestX: 0, neckX: 0, headX: 0, headY: 0, headZ: 0, jaw: 0, lift: 0 };

      // Alive: breathing and a slow, small gaze drift.
      tg.chestX += 0.012 * Math.sin(t * 1.1);
      tg.headY += 0.07 * Math.sin(t * 0.27);
      tg.headX += 0.02 * Math.sin(t * 0.41);

      // Voice state
      if (p.state === "listening") {
        tg.chestX += 0.045;
        tg.neckX += 0.04;
        tg.headZ += 0.07;
        tg.headX += 0.08 * Math.pow(Math.max(0, Math.sin(t * 2.4)), 3); // nods
      } else if (p.state === "thinking") {
        tg.headZ -= 0.11;
        tg.headX -= 0.09;
        tg.headY -= 0.16;
      } else if (p.state === "speaking") {
        tg.headX += p.mouth * 0.05;
        tg.headY += 0.035 * Math.sin(t * 1.7);
        tg.jaw = p.mouth * 0.13;
      }

      // Sustained posture per act
      if (p.act === "context") tg.chestX += 0.035;
      if (p.act === "proposal" || p.act === "send") tg.headY += 0.14; // looks toward the results column
      if (p.act === "community") tg.headX -= 0.08;
      if (p.act === "booked") tg.headZ += 0.05;

      // One-shot gesture
      const dur = GESTURE_SECONDS[p.gesture];
      const k = p.still ? 1 : Math.min(1, p.actTime / dur);
      const env = Math.sin(Math.PI * k);
      switch (p.gesture) {
        case "greet":
          tg.headY += -0.28 * (1 - smooth(0, 0.6, k)); // turns in to face you
          tg.headX += 0.13 * Math.max(0, Math.sin(Math.PI * smooth(0.45, 0.85, k))); // nod hello
          break;
        case "leanIn":
          tg.chestX += 0.05 * env;
          tg.neckX += 0.04 * env;
          break;
        case "openUp":
          tg.chestX -= 0.07 * env;
          tg.headX -= 0.12 * env;
          break;
        case "present":
          tg.headY += 0.2 * env;
          tg.headX += 0.08 * env;
          break;
        case "throw":
          tg.headY += 0.3 * env;
          tg.headZ -= 0.08 * env;
          tg.chestX -= 0.04 * env;
          break;
        case "celebrate":
          tg.lift += 0.03 * Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k);
          tg.headZ += 0.09 * env;
          tg.headX -= 0.05 * env;
          break;
      }

      const ease = p.still ? 1 : 1 - Math.exp(-p.dt * 7);
      for (const key of Object.keys(cur) as (keyof typeof cur)[]) cur[key] += (tg[key] - cur[key]) * (key === "jaw" ? Math.min(1, ease * 2) : ease);

      bones.chest.rotation.x = cur.chestX;
      bones.neck.rotation.x = cur.neckX;
      bones.head.rotation.set(cur.headX, cur.headY, cur.headZ);
      bones.jaw.rotation.x = cur.jaw;
      bones.root.position.y = baseRootY + cur.lift;
    },
  };
}
