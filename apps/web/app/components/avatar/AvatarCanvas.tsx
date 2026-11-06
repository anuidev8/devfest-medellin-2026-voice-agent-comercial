"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type * as THREE_NS from "three";
import type { Act } from "../act";
import type { OrbState } from "../VoiceOrb";
import type { VoiceLevels } from "../VoiceWave";
import { AVATAR } from "./config";
import { createDissolve } from "./dissolve";
import { createHologramUniforms, hologramMaterial } from "./hologram";
import { buildProceduralRig, createPerformer } from "./procedural";

type Props = {
  act: Act;
  state: OrbState;
  levelsRef?: MutableRefObject<VoiceLevels>;
  onReady?: () => void;
  onError?: () => void;
};

const cssColor = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
};

/**
 * The agent's body: the SETI hologram woman in Signal blue. She materializes from the floor,
 * acts each step of the call (procedural rig), changes outfit for the proposal, dissolves into
 * the community orbit, throws the plan as particles, and lip-syncs to the agent's voice.
 */
export function AvatarCanvas({ act, state, levelsRef, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const actRef = useRef(act);
  const stateRef = useRef(state);
  const actStartRef = useRef(0);
  const cbRef = useRef({ onReady, onError });
  const onActRef = useRef<((a: Act) => void) | null>(null);
  const onStateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cbRef.current = { onReady, onError };
  }, [onReady, onError]);

  useEffect(() => {
    actRef.current = act;
    actStartRef.current = performance.now();
    onActRef.current?.(act);
  }, [act]);

  useEffect(() => {
    stateRef.current = state;
    onStateRef.current?.();
  }, [state]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;

      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch (err) {
        console.warn("[avatar] WebGL unavailable, showing fallback:", err);
        cbRef.current.onError?.();
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(AVATAR.frame.fov, 1, 0.01, 100);
      scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x0b1230, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(3, 6, 5);
      scene.add(key);

      let gltf: Awaited<ReturnType<InstanceType<typeof GLTFLoader>["loadAsync"]>>;
      try {
        gltf = await new GLTFLoader().loadAsync(AVATAR.url);
      } catch (err) {
        console.warn("[avatar] model failed to load, showing fallback:", err);
        renderer.dispose();
        renderer.domElement.remove();
        cbRef.current.onError?.();
        return;
      }
      if (disposed) {
        renderer.dispose();
        return;
      }

      const model = gltf.scene;
      scene.add(model);
      model.updateMatrixWorld(true);

      // Body = the largest mesh; its local bounds drive reveal, outfit and dissolve.
      let body: THREE_NS.Mesh | null = null;
      model.traverse((o) => {
        const m = o as THREE_NS.Mesh;
        if (m.isMesh && (!body || m.geometry.getAttribute("position").count > body.geometry.getAttribute("position").count)) body = m;
      });
      if (!body) {
        cbRef.current.onError?.();
        return;
      }
      const bodyMesh = body as THREE_NS.Mesh;
      bodyMesh.geometry.computeBoundingBox();
      const local = bodyMesh.geometry.boundingBox!;
      const lm = AVATAR.rig.landmarks;

      const signal = cssColor("--signal", AVATAR.outfits.jacket);
      const uniforms = createHologramUniforms(THREE, {
        rim: cssColor("--signal-soft", "#9bb8ff"),
        base: signal,
        minY: local.min.y,
        maxY: local.max.y,
        clothY: AVATAR.rig.kind === "procedural" ? lm.clothY : local.min.y,
      });
      model.traverse((o) => {
        const m = o as THREE_NS.Mesh;
        if (m.isMesh) m.material = hologramMaterial(THREE, uniforms, signal);
      });

      // Rig: procedural bones for the SETI bust, or the model's own clips.
      const useClips = AVATAR.rig.kind === "clips" && gltf.animations.length > 0;
      let performer: ReturnType<typeof createPerformer> | null = null;
      let mixer: THREE_NS.AnimationMixer | null = null;
      let rigMesh: THREE_NS.Mesh = bodyMesh;
      if (useClips) {
        mixer = new THREE.AnimationMixer(model);
      } else if (!(bodyMesh as THREE_NS.SkinnedMesh).isSkinnedMesh) {
        const rig = buildProceduralRig(THREE, bodyMesh, lm);
        rigMesh = rig.skinned;
        performer = createPerformer(rig.bones);
      }

      // Community dissolve + "send" burst, in the body's local space.
      const dissolve = createDissolve(THREE, rigMesh.geometry, {
        count: 5200,
        center: [...lm.orbitCenter],
        radius: (local.max.y - local.min.y) / 2,
        colorA: signal,
        colorB: cssColor("--signal-soft", "#9bb8ff"),
      });
      rigMesh.add(dissolve.points);

      // Frame from measured bounds so any model fits the arch.
      const box = new THREE.Box3().setFromObject(model, true);
      const size = box.getSize(new THREE.Vector3());
      const focusY = box.min.y + size.y * AVATAR.frame.focus;
      const dist = (size.y * AVATAR.frame.span) / 2 / Math.tan(THREE.MathUtils.degToRad(AVATAR.frame.fov / 2));
      const cz = box.getCenter(new THREE.Vector3()).z;
      camera.position.set(0, focusY + size.y * 0.03, cz + dist);
      camera.lookAt(0, focusY, cz);

      // Clip path (future rigged model)
      let current: THREE_NS.AnimationAction | null = null;
      const clipByName = new Map(gltf.animations.map((c) => [c.name, c]));
      const playLoop = (name?: string) => {
        const clip = name ? clipByName.get(name) : undefined;
        if (!mixer || !clip) return;
        const next = mixer.clipAction(clip);
        if (next === current) return;
        next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(AVATAR.crossFade).play();
        current?.fadeOut(AVATAR.crossFade);
        current = next;
      };
      const loopName = () => {
        const c: { loop: string; listening?: string } = AVATAR.clips[actRef.current];
        return stateRef.current === "listening" && c.listening ? c.listening : c.loop;
      };
      const enterClipAct = () => {
        if (!mixer) return;
        const c: { once?: string; loop: string } = AVATAR.clips[actRef.current];
        const once = c.once ? clipByName.get(c.once) : undefined;
        if (!once || still) return playLoop(loopName());
        const next = mixer.clipAction(once);
        next.reset().setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
        next.fadeIn(AVATAR.crossFade).play();
        current?.fadeOut(AVATAR.crossFade);
        current = next;
      };
      mixer?.addEventListener("finished", (e) => {
        if (e.action === current) playLoop(loopName());
      });
      enterClipAct();
      onActRef.current = () => enterClipAct();
      onStateRef.current = () => {
        if (!current || current.loop !== THREE.LoopOnce || !current.isRunning()) playLoop(loopName());
      };

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // Point size scale: pixels per world unit at distance 1.
        // ~3.4 CSS px per speck cell: the model fills h / span of the canvas height.
        uniforms.uDensity.value = h / AVATAR.frame.span / (local.max.y - local.min.y) / 3.4;
        dissolve.uniforms.uPx.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(AVATAR.frame.fov / 2))) / 60;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const rimBase = new THREE.Color(cssColor("--signal-soft", "#9bb8ff"));
      const rimGood = new THREE.Color(cssColor("--good", "#3ccf8e"));
      const outfitColor = { jacket: new THREE.Color(AVATAR.outfits.jacket), blazer: new THREE.Color(AVATAR.outfits.blazer) };
      let outfitShown: "jacket" | "blazer" = AVATAR.acts[actRef.current].outfit;
      uniforms.uOutfit.value.copy(outfitColor[outfitShown]);
      uniforms.uOutfitSweep.value = outfitShown === "jacket" ? 0 : 1;
      actStartRef.current = performance.now();

      const baseY = model.position.y;
      const floatAmp = size.y * 0.014;

      const clock = new THREE.Clock();
      let raf = 0;
      let mouth = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick); // rAF already pauses in background tabs.
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        const a = actRef.current;
        const perf = AVATAR.acts[a];
        const actTime = (performance.now() - actStartRef.current) / 1000;

        uniforms.uTime.value = t;
        dissolve.uniforms.uTime.value = still ? 0 : t;
        // Hologram float above the projector base.
        model.position.y = still ? baseY : baseY + Math.sin(t * 1.1) * floatAmp;
        // Materialize from the floor on first load.
        uniforms.uReveal.value = still ? 1 : Math.min(1, uniforms.uReveal.value + dt / 1.8);

        // Outfit: wipe the old color down, then sweep the new one up the chest.
        if (perf.outfit !== outfitShown) {
          uniforms.uOutfitSweep.value = still ? 0 : Math.max(0, uniforms.uOutfitSweep.value - dt / 0.35);
          if (uniforms.uOutfitSweep.value === 0) {
            outfitShown = perf.outfit;
            uniforms.uOutfit.value.copy(outfitColor[outfitShown]);
          }
        } else if (outfitShown === "blazer") {
          uniforms.uOutfitSweep.value = still ? 1 : Math.min(1, uniforms.uOutfitSweep.value + dt / 0.9);
        }

        // Community dissolve and "send" burst.
        const wantMix = "dissolve" in perf && perf.dissolve ? 1 : 0;
        const mixU = dissolve.uniforms.uMix;
        mixU.value = still ? wantMix : mixU.value + (wantMix - mixU.value) * Math.min(1, dt * 1.6);
        uniforms.uOpacity.value = 1 - mixU.value * 0.9;
        dissolve.uniforms.uBurst.value = a === "send" && !still ? Math.min(1, actTime / 1.1) : 0;

        // Rim turns green while celebrating the booking.
        const glow = a === "booked" && !still ? Math.max(0, 1 - actTime / 2.2) : 0;
        uniforms.uRim.value.copy(rimBase).lerp(rimGood, glow);

        // Mouth from the agent's voice level.
        const level = stateRef.current === "speaking" ? Math.min((levelsRef?.current.agent ?? 0.3) * 2.2, 1) : 0;
        mouth += (level - mouth) * 0.35;

        if (performer) {
          performer.update({ t, dt, state: stateRef.current, gesture: perf.gesture, actTime, act: a, mouth, still });
        } else if (mixer) {
          mixer.update(still ? 0 : dt);
        }
        renderer.render(scene, camera);
      };
      tick();
      cbRef.current.onReady?.();

      if (process.env.NODE_ENV !== "production") {
        // Dev-only: step the performance by hand (headless browsers don't run rAF).
        (window as unknown as { __avatarStep?: (seconds: number) => void }).__avatarStep = (seconds: number) => {
          for (let s = 0; s < seconds; s += 1 / 30) {
            clock.elapsedTime += 1 / 30;
            actStartRef.current -= 1000 / 30;
            const save = clock.getDelta;
            clock.getDelta = () => 1 / 30;
            tick();
            cancelAnimationFrame(raf);
            clock.getDelta = save;
          }
        };
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        mixer?.stopAllAction();
        onActRef.current = null;
        onStateRef.current = null;
        dissolve.dispose();
        scene.traverse((o) => {
          const m = o as THREE_NS.Mesh;
          m.geometry?.dispose?.();
          const mat = m.material as THREE_NS.Material | THREE_NS.Material[] | undefined;
          (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [levelsRef]);

  return <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />;
}
