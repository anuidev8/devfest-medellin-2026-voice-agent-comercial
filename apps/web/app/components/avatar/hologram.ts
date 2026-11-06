import type * as THREE_NS from "three";

type THREE = typeof THREE_NS;

/** Uniforms shared by every hologram surface of the avatar. */
export function createHologramUniforms(three: THREE, o: { rim: string; base: string; minY: number; maxY: number; clothY: number }) {
  return {
    uTime: { value: 0 },
    uRim: { value: new three.Color(o.rim) },
    uOpacity: { value: 1 },
    /** 0 → 1: the body materializes from the floor up. */
    uReveal: { value: 0 },
    uMinY: { value: o.minY },
    uMaxY: { value: o.maxY },
    uClothY: { value: o.clothY },
    /** Target outfit color and how far the change has swept up the chest (0 → 1). */
    uOutfit: { value: new three.Color(o.base) },
    uOutfitSweep: { value: 0 },
    /** Particle cells per model unit (set on resize so each speck is ~4 px, matching the intro dust). */
    uDensity: { value: 34 },
  };
}

export type HologramUniforms = ReturnType<typeof createHologramUniforms>;

/**
 * SETI-style hologram finish on a standard material (so skinning keeps working):
 * fresnel edge, soft scanlines, bottom-up reveal with a bright scan edge, and an
 * outfit color that sweeps up the clothing region.
 */
export function hologramMaterial(three: THREE, uniforms: HologramUniforms, base: string) {
  const m = new three.MeshStandardMaterial({
    color: new three.Color(base),
    roughness: 0.55,
    metalness: 0.1,
    emissive: new three.Color(base).multiplyScalar(0.22),
    transparent: true,
    blending: three.AdditiveBlending,
    depthWrite: false,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vLocalY;\nvarying vec3 vLocalPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocalY = position.y;\nvLocalPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying float vLocalY;
        varying vec3 vLocalPos;
        uniform float uTime, uOpacity, uReveal, uMinY, uMaxY, uClothY, uOutfitSweep, uDensity;
        uniform vec3 uRim, uOutfit;`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        float ry = (vLocalY - uMinY) / max(uMaxY - uMinY, 1e-3);
        if (ry > uReveal * 1.08) discard;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float clothN = (vLocalY - uMinY) / max(uClothY - uMinY, 1e-3);
        float inCloth = 1.0 - smoothstep(0.9, 1.0, clothN);
        float swept = clamp((uOutfitSweep * 1.15 - clothN) * 8.0, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uOutfit, inCloth * swept);`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);
        float scan = 0.92 + 0.08 * sin(gl_FragCoord.y * 1.1 - uTime * 3.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uRim, fres * 0.8) * scan;
        // SETI-style granular hologram: sparse specks fixed to the surface that twinkle.
        vec3 cell = floor(vLocalPos * 70.0);
        float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float speck = step(0.955, h) * (0.45 + 0.55 * sin(uTime * 2.2 + h * 60.0));
        gl_FragColor.rgb += uRim * max(speck, 0.0) * 0.55;
        // Soft lift toward the top of the head, like light from the pedestal below fading upward.
        gl_FragColor.rgb *= 0.92 + 0.12 * ry;
        // Particle hologram — the same look as the intro's dust woman: sparse white/blue specks that
        // twinkle, a few bigger bright ones, nothing solid between. The specks live in the model's own
        // space (3D cells), so they ride the procedural rig: she still turns, nods and lip-syncs.
        vec3 q = vLocalPos * uDensity;
        vec3 pc = floor(q);
        float ph = fract(sin(dot(pc, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vec3 jit = vec3(
          fract(sin(dot(pc, vec3(39.3468, 11.1351, 83.1555))) * 43758.5453),
          fract(sin(dot(pc, vec3(73.156, 52.235, 9.151))) * 43758.5453),
          fract(sin(dot(pc, vec3(27.42, 61.71, 44.13))) * 43758.5453)) - 0.5;
        float big = step(0.965, ph);
        float keep = step(0.3, ph);
        float prad = mix(0.42, 0.62, big);
        float pd = length(fract(q) - 0.5 - jit * 0.34);
        float speckM = keep * (1.0 - smoothstep(prad * 0.5, prad, pd));
        // Finer dust layer (twice as dense, dimmer), like the intro's small points between the bright ones.
        vec3 q2 = vLocalPos * uDensity * 2.0 + 17.0;
        vec3 pc2 = floor(q2);
        float ph2 = fract(sin(dot(pc2, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vec3 jit2 = vec3(fract(ph2 * 13.7), fract(ph2 * 29.3), fract(ph2 * 47.1)) - 0.5;
        float dustM = step(0.45, ph2) * (1.0 - smoothstep(0.22, 0.42, length(fract(q2) - 0.5 - jit2 * 0.4)));
        speckM = max(speckM, dustM * 0.55);
        float tw = 0.55 + 0.45 * sin(uTime * 2.5 + ph * 30.0);
        vec3 speckCol = mix(vec3(0.36, 0.58, 1.0), vec3(0.85, 0.94, 1.0), fract(ph * 7.31));
        speckCol = mix(speckCol, uOutfit * 1.5 + 0.25, inCloth * swept * 0.45);
        float edge = (1.0 - smoothstep(0.0, 0.025, abs(ry - uReveal * 1.08))) * (1.0 - step(0.999, uReveal));
        // Grazing angles glow like the intro's silhouette, where its points pile up.
        float pa = speckM * (0.75 + 0.45 * tw) * (1.0 + big * 0.9) * (0.85 + 0.6 * fres) + fres * fres * 0.28 + edge;
        if (pa < 0.01) discard;
        gl_FragColor = vec4(mix(mix(speckCol, vec3(0.75, 0.88, 1.0), fres * 0.5), uRim, edge), clamp(pa, 0.0, 1.0) * uOpacity);`,
      );
  };
  return m;
}
