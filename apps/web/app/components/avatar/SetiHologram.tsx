"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { VoiceLevels } from "../VoiceWave";
import { loadPackedHoloMesh, sampleSurfaceSplats } from "./seti/packedMesh";
import { createHoloSplatMaterial, createSkinMaterial, LIGHT_TO_ALPHA_SHADER } from "./seti/shaders";

/** Speech mouth rhythm used when no live voice level is available (from SETI). */
function talkingEnvelope(t: number): number {
  const a = Math.abs(Math.sin(t * 5.4));
  const b = Math.abs(Math.sin(t * 8.2 + 0.7));
  const c = Math.abs(Math.sin(t * 3.1 + 1.4));
  const d = Math.abs(Math.sin(t * 11.5 + 0.3));
  const burst = 0.45 + 0.55 * Math.max(0, Math.sin(t * 1.4));
  return Math.min(1, (a * 0.45 + b * 0.3 + c * 0.2 + d * 0.2) * burst);
}

/**
 * The SETI hologram woman (Abril), in Signal blue: packed face mesh + skin + ~100k splats + bloom,
 * with a light→alpha pass so only the light is drawn. Ported from seti-agente-comercial's
 * RedHologramHead. Nothing renders until `build` turns true; then the splats fly in along wind
 * corridors and assemble her (the "avatar builds from spread particles" moment).
 */
export function SetiHologram({
  build,
  talking,
  levelsRef,
  onReady,
  onError,
}: {
  build: boolean;
  talking: boolean;
  levelsRef?: MutableRefObject<VoiceLevels>;
  onReady?: () => void;
  onError?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const buildRef = useRef(build);
  const talkingRef = useRef(talking);
  const cbRef = useRef({ onReady, onError });

  useEffect(() => {
    buildRef.current = build;
    talkingRef.current = talking;
    cbRef.current = { onReady, onError };
  }, [build, talking, onReady, onError]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0.08, 5.15);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (err) {
      console.warn("[avatar] WebGL unavailable:", err);
      cbRef.current.onError?.();
      return;
    }
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NoToneMapping;
    // Linear output, as in SETI: the bloom copy would otherwise lift the darks and wash the hologram out.
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const canvas = renderer.domElement;
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", pointerEvents: "none" });
    host.appendChild(canvas);

    // 8-bit target like the original (HalfFloat would over-feed the bloom).
    const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType }));
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.3);
    composer.addPass(bloom);
    const lightToAlpha = new ShaderPass(LIGHT_TO_ALPHA_SHADER);
    composer.addPass(lightToAlpha);

    const pivot = new THREE.Group();
    scene.add(pivot);

    // Ambient dust drifting around the bust.
    const DUST_COUNT = mobile ? 500 : 900;
    const dustPos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 3.2;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 2.6;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x4f8bff, size: 0.012, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.renderOrder = 2;
    scene.add(dust);

    const skinMat = createSkinMaterial();
    const holoMat = createHoloSplatMaterial(pr);
    let occluder: THREE.Mesh | null = null;
    let splatGeo: THREE.BufferGeometry | null = null;
    let headReady = false;

    const ASSEMBLE = mobile ? 2.2 : 2.8;
    let assembled = 0; // seconds since `build` turned on
    let targetYaw = 0;
    let targetPitch = 0;
    let yaw = 0;
    let pitch = 0;
    let nextLook = 0;
    let blink = 0;
    let blinkT = -1;
    let nextBlink = 3.5;
    let mouth = 0;
    let splatScale = 1;

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      const a = w / h;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = a;
      const d = a < 0.8 ? (5.0 / Math.max(a, 0.5)) * 0.9 : 5.25;
      camera.position.set(0, 0.06, d);
      camera.lookAt(0, 0, 0);
      holoMat.uniforms.uFocus.value = d - 0.95;
      holoMat.uniforms.uPR.value = renderer.getPixelRatio();
      camera.updateProjectionMatrix();
      bloom.resolution.set(w, h);
      splatScale = Math.min(1.4, Math.max(0.5, h / 900));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    (async () => {
      try {
        const mesh = await loadPackedHoloMesh();
        if (disposed) {
          mesh.geometry.dispose();
          return;
        }
        occluder = new THREE.Mesh(mesh.geometry, skinMat);
        occluder.renderOrder = 0;
        pivot.add(occluder);
        const np = mobile ? 70_000 : window.innerWidth * window.innerHeight > 600_000 ? 110_000 : 90_000;
        splatGeo = sampleSurfaceSplats(mesh, np, null);
        const points = new THREE.Points(splatGeo, holoMat);
        points.renderOrder = 1;
        pivot.add(points);
        headReady = true;
        cbRef.current.onReady?.();
      } catch (err) {
        console.warn("[avatar] hologram load failed:", err);
        cbRef.current.onError?.();
      }
    })();

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Hidden until asked to build: no GPU work while the intro's card story plays.
      if (!buildRef.current || !headReady) {
        if (assembled > 0) {
          renderer.setRenderTarget(null);
          renderer.clear();
        }
        assembled = 0;
        return;
      }
      assembled += dt;
      const boot = reduceMotion ? 1 : Math.min(1, assembled / ASSEMBLE);

      if (!reduceMotion) {
        // Slow look-around and float.
        if (t > nextLook) {
          targetYaw = (Math.random() - 0.5) * 0.28;
          targetPitch = (Math.random() - 0.5) * 0.12;
          nextLook = t + 3.2 + Math.random() * 3.5;
        }
        yaw += (targetYaw - yaw) * 0.025;
        pitch += (targetPitch - pitch) * 0.025;
        pivot.rotation.set(pitch, yaw + Math.sin(t * 0.22) * 0.025, (1 - boot) * 0.35 * Math.sin(boot * Math.PI));
        pivot.position.y = Math.sin(t * 0.55) * 0.012;
        dust.rotation.y = t * 0.03;
        dust.position.y = Math.sin(t * 0.3) * 0.03;
      }
      pivot.scale.setScalar(0.94 + 0.06 * boot);
      dustMat.opacity = 0.35 * boot;

      const speaking = talkingRef.current;
      const talkPulse = speaking ? 0.96 + 0.04 * Math.sin(t * 2.2) : 1;
      skinMat.uniforms.uTime.value = reduceMotion ? 0 : t;
      // The solid face shows only once most splats have landed.
      skinMat.uniforms.uOpacity.value = Math.min(1, Math.max(0, (boot - 0.55) / 0.45)) * talkPulse;

      if (blinkT < 0 && t > nextBlink) blinkT = 0;
      if (blinkT >= 0) {
        blinkT += dt;
        blink = Math.pow(Math.sin(Math.PI * Math.min(1, blinkT / 0.32)), 0.6);
        if (blinkT >= 0.32) {
          blink = 0;
          blinkT = -1;
          nextBlink = t + (Math.random() < 0.15 ? 0.28 : 4 + Math.random() * 5);
        }
      }
      // Mouth: the agent's live voice level when we have it, SETI's speech rhythm otherwise.
      const live = levelsRef?.current.agent;
      const target = speaking && !reduceMotion ? (live && live > 0.02 ? Math.min(1, live * 2.2) : talkingEnvelope(t)) : 0;
      mouth += (target - mouth) * Math.min(dt * 6.5, 1);
      skinMat.uniforms.uBlink.value = blink;
      skinMat.uniforms.uMouth.value = mouth;
      holoMat.uniforms.uMouth.value = mouth;
      holoMat.uniforms.uLogo.value = 0;
      holoMat.uniforms.uGather.value = 1;
      holoMat.uniforms.uDisperse.value = 0;
      holoMat.uniforms.uAssemble.value = boot;
      holoMat.uniforms.uTime.value = reduceMotion ? 0 : t;
      holoMat.uniforms.uSize.value = talkPulse * splatScale;

      composer.render();
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      composer.dispose();
      renderer.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      lightToAlpha.dispose();
      skinMat.dispose();
      holoMat.dispose();
      splatGeo?.dispose();
      occluder?.geometry.dispose();
      canvas.remove();
    };
  }, [levelsRef]);

  return <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />;
}
