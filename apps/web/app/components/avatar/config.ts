/**
 * Everything model-specific lives here.
 *
 * Current model: the SETI hologram woman (red-hologram-avatar.glb from seti-agente-comercial),
 * spec-fixed, simplified and quantized to /public/avatar/seti-hologram.glb (8.2 MB → 1.8 MB).
 * She ships without a skeleton, so `rig.kind = "procedural"`: AvatarCanvas builds
 * chest / neck / head / jaw bones in code from the landmarks below and performs each act.
 *
 * Later, a fully rigged model (with hands and real clips) can replace her: set
 * `rig.kind = "clips"`, point `url` at the new GLB and name its clips in `clips`.
 */
import type { Act } from "../act";

export type Gesture = "greet" | "leanIn" | "openUp" | "present" | "throw" | "celebrate";
export type Outfit = "jacket" | "blazer";

export type ActPerformance = {
  /** One-shot body gesture played when the act starts. */
  gesture: Gesture;
  /** Clothing look (chest region color), swept in from below on change. */
  outfit: Outfit;
  /** Body dissolves into the community orbit. */
  dissolve?: boolean;
};

/** For a future rigged model: clip names per act (the list a 3D artist should deliver). */
export type ClipSet = { once?: string; loop: string; listening?: string };

export const AVATAR = {
  url: "/avatar/seti-hologram.glb",
  /** Camera framing, relative to the model's height: `focus` = look-at point (0 bottom → 1 top), `span` = share of the height in view. */
  frame: { fov: 30, focus: 0.56, span: 1.18 },
  rig: {
    kind: "procedural" as "procedural" | "clips",
    /** Landmarks in the model's own units, measured on seti-hologram.glb (height −1 → +1, face toward +z). */
    landmarks: {
      chestPivot: [0, -0.95, -0.15],
      neckPivot: [0, -0.42, -0.12],
      headPivot: [0, -0.16, -0.08],
      jawPivot: [0, 0.1, -0.05],
      /** Weight blends (y ranges) between bones. */
      chestBlend: [-1.0, -0.5],
      neckBlend: [-0.55, -0.3],
      headBlend: [-0.3, -0.12],
      /** Jaw: below the lips, above the under-chin, front of the face. */
      jawBelowY: [0.0, -0.05],
      jawAboveY: [-0.27, -0.19],
      jawFrontZ: [0.12, 0.26],
      /** |x| falloff so the cheeks stay put. */
      jawHalfWidth: [0.2, 0.11],
      /** Clothing reaches up to here (collarbones). */
      clothY: -0.38,
      /** Center of the community orbit. */
      orbitCenter: [0, 0.25, 0],
    },
  },
  outfits: {
    jacket: "#2f6bff",
    blazer: "#17246a",
  } satisfies Record<Outfit, string>,
  acts: {
    intro: { gesture: "greet", outfit: "jacket" },
    context: { gesture: "leanIn", outfit: "jacket" },
    community: { gesture: "openUp", outfit: "jacket", dissolve: true },
    proposal: { gesture: "present", outfit: "blazer" },
    send: { gesture: "throw", outfit: "blazer" },
    booked: { gesture: "celebrate", outfit: "blazer" },
  } satisfies Record<Act, ActPerformance>,
  /** Used only when rig.kind = "clips". Names follow the mood board's clip list. */
  clips: {
    intro: { once: "wave_hello", loop: "idle_breathe" },
    context: { loop: "idle_breathe", listening: "lean_listen" },
    community: { once: "arms_open", loop: "idle_breathe" },
    proposal: { once: "present_card", loop: "idle_breathe" },
    send: { once: "throw_plane", loop: "idle_breathe" },
    booked: { once: "celebrate", loop: "idle_breathe" },
  } satisfies Record<Act, ClipSet>,
  crossFade: 0.45,
} as const;
