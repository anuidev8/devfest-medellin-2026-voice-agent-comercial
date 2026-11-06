"use client";

import { useEffect, useRef } from "react";

/**
 * Single-color Lottie micro-animations for loading / done states.
 * Authored as data here so there are no extra asset requests; swap any of them for a
 * designer-made .json later by returning it from `buildAnimation`.
 */
export type LottieKind = "idle" | "listen" | "think" | "speak" | "search" | "build" | "done";

type RGBA = [number, number, number, number];
const hex = (h: string): RGBA => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};

const st = (k: unknown) => ({ a: 0, k });
const ease = (n: number) => ({ i: { x: Array(n).fill(0.4), y: Array(n).fill(1) }, o: { x: Array(n).fill(0.6), y: Array(n).fill(0) } });
const kf = (frames: [number, number[]][]) => ({
  a: 1,
  k: frames.map(([t, s], i) => (i < frames.length - 1 ? { t, s, ...ease(s.length) } : { t, s })),
});
const tr = () => ({ ty: "tr", p: st([0, 0]), a: st([0, 0]), s: st([100, 100]), r: st(0), o: st(100), sk: st(0), sa: st(0) });
const layer = (ks: Record<string, unknown>, shapes: unknown[], ind: number) => ({
  ddd: 0,
  ind,
  ty: 4,
  nm: `l${ind}`,
  sr: 1,
  ip: 0,
  op: 600,
  st: 0,
  bm: 0,
  ao: 0,
  ks: { o: st(100), r: st(0), p: st([60, 42, 0]), a: st([0, 0, 0]), s: st([100, 100, 100]), ...ks },
  shapes,
});
const grp = (items: unknown[]) => ({ ty: "gr", it: [...items, tr()] });
const ell = (size: number, pos = [0, 0]) => ({ ty: "el", d: 1, p: st(pos), s: st([size, size]) });
const fill = (c: RGBA) => ({ ty: "fl", c: st(c), o: st(100), r: 1 });
const stroke = (c: RGBA, w: number) => ({ ty: "st", c: st(c), o: st(100), w: st(w), lc: 2, lj: 2 });
const rect = (w: number, h: number, r: number, pos: number[]) => ({ ty: "rc", d: 1, p: st(pos), s: st([w, h]), r: st(r) });
const anim = (layers: unknown[], op: number) => ({ v: "5.7.4", fr: 60, ip: 0, op, w: 120, h: 84, nm: "state", ddd: 0, assets: [], layers });

export function buildAnimation(
  kind: LottieKind,
  colors: { fg: string; accent: string; muted: string; good: string; listen: string; dim: string },
) {
  const FG = hex(colors.fg);
  const ACCENT = hex(colors.accent);
  const MUTED = hex(colors.muted);
  switch (kind) {
    case "idle": {
      // Slow breathing dot: waiting for the user to tap.
      const D = hex(colors.dim);
      return anim(
        [
          layer({ s: kf([[0, [70, 70, 100]], [90, [100, 100, 100]], [180, [70, 70, 100]]]), o: kf([[0, [30]], [90, [70]], [180, [30]]]) }, [grp([ell(34), stroke(D, 2)])], 1),
          layer({ s: kf([[0, [85, 85, 100]], [90, [110, 110, 100]], [180, [85, 85, 100]]]), o: kf([[0, [60]], [90, [100]], [180, [60]]]) }, [grp([ell(16), fill(D)])], 2),
        ],
        180,
      );
    }
    case "speak": {
      // Four sound bars, staggered.
      const bar = (x: number, d: number, ind: number) =>
        layer(
          {
            p: st([x, 42, 0]),
            s: kf([[d, [100, 30, 100]], [d + 12, [100, 100, 100]], [d + 24, [100, 45, 100]], [d + 36, [100, 85, 100]], [d + 48, [100, 30, 100]], [72, [100, 30, 100]]]),
          },
          [grp([rect(8, 40, 4, [0, 0]), fill(ACCENT)])],
          ind,
        );
      return anim([bar(39, 0, 1), bar(53, 8, 2), bar(67, 16, 3), bar(81, 4, 4)], 72);
    }
    case "listen": {
      const L = hex(colors.listen);
      return anim(
        [
          layer({ s: kf([[0, [40, 40, 100]], [90, [140, 140, 100]]]), o: kf([[0, [90]], [90, [0]]]) }, [grp([ell(36), stroke(L, 2.5)])], 1),
          layer({ s: kf([[30, [40, 40, 100]], [120, [140, 140, 100]]]), o: kf([[0, [0]], [30, [90]], [120, [0]]]) }, [grp([ell(36), stroke(L, 2.5)])], 2),
          layer({ s: kf([[0, [100, 100, 100]], [45, [115, 115, 100]], [90, [100, 100, 100]]]) }, [grp([ell(14), fill(L)])], 3),
        ],
        120,
      );
    }
    case "think": {
      const dot = (x: number, d: number, ind: number) =>
        layer(
          {
            p: st([x, 42, 0]),
            s: kf([[d, [70, 70, 100]], [d + 18, [100, 100, 100]], [d + 36, [70, 70, 100]], [72, [70, 70, 100]]]),
            o: kf([[d, [35]], [d + 18, [100]], [d + 36, [35]], [72, [35]]]),
          },
          [grp([ell(11), fill(FG)])],
          ind,
        );
      return anim([dot(42, 0, 1), dot(60, 12, 2), dot(78, 24, 3)], 72);
    }
    case "search":
      return anim(
        [
          layer({}, [grp([ell(52), stroke(MUTED, 2)])], 1),
          layer({ r: kf([[0, [0]], [150, [360]]]) }, [grp([ell(8, [26, 0]), fill(FG)]), grp([ell(6, [-26, 0]), fill(ACCENT)])], 2),
          layer({ s: kf([[0, [100, 100, 100]], [75, [120, 120, 100]], [150, [100, 100, 100]]]) }, [grp([ell(12), fill(ACCENT)])], 3),
        ],
        150,
      );
    case "build": {
      const line = (y: number, w: number, d: number, ind: number) =>
        layer(
          { p: st([30, y, 0]), s: kf([[d, [0, 100, 100]], [d + 30, [100, 100, 100]], [100, [100, 100, 100]], [120, [0, 100, 100]]]) },
          [grp([rect(w, 6, 3, [w / 2, 0]), fill(d === 0 ? FG : MUTED)])],
          ind,
        );
      return anim([line(28, 60, 0, 1), line(42, 48, 12, 2), line(56, 36, 24, 3)], 120);
    }
    case "done": {
      const check = { ty: "sh", ks: st({ i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], v: [[-9, 1], [-3, 7], [10, -7]], c: false }) };
      const trim = { ty: "tm", s: st(0), e: kf([[14, [0]], [40, [100]]]), o: st(0), m: 1 };
      return anim(
        [
          layer({ s: kf([[0, [60, 60, 100]], [16, [100, 100, 100]]]) }, [grp([ell(40), fill(hex(colors.good))])], 2),
          layer({}, [grp([check, trim, stroke([1, 1, 1, 1], 3.5)])], 1),
        ],
        60,
      );
    }
  }
}

const readVar = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
};

/** Plays one state animation. Falls back to a pulsing dot until lottie-web loads (or if it fails). */
export function LottieState({
  kind,
  size = 56,
  label,
  className = "",
  color,
  zoom = 1,
}: {
  kind: LottieKind;
  /** Crops into the centre of the artboard so the shapes read at small sizes (pills, chips). */
  zoom?: number;
  size?: number;
  label?: string;
  className?: string;
  /** Overrides every color: a hex, or a CSS variable name like "--primary-ink" (follows the theme). */
  color?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("lottie-web/build/player/lottie_light")
      .then(({ default: lottie }) => {
        if (cancelled || !ref.current) return;
        el.replaceChildren();
        const solid = color?.startsWith("--") ? readVar(color, "#05070d") : color;
        const data = buildAnimation(
          kind,
          solid
            ? { fg: solid, accent: solid, muted: solid, good: solid, listen: solid, dim: solid }
            : {
                fg: readVar("--text", "#f2f4f8"),
                accent: readVar("--signal", "#2f6bff"),
                muted: readVar("--line", "#323b55"),
                good: readVar("--good", "#3ccf8e"),
                listen: readVar("--glow", "#45d4f5"),
                dim: readVar("--dim", "#8d95a8"),
              },
        );
        const a = lottie.loadAnimation({ container: el, renderer: "svg", loop: kind !== "done", autoplay: !reduce, animationData: data });
        if (reduce) a.goToAndStop(kind === "done" ? 59 : 0, true);
        destroy = () => a.destroy();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [kind, color]);

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role={label ? "status" : undefined}>
      <span className="relative grid flex-none place-items-center overflow-hidden" style={{ width: size, height: (size * 84) / 120 }} aria-hidden="true">
        <span
          ref={ref}
          className="absolute top-1/2 left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
          style={{ width: size * zoom, height: (size * zoom * 84) / 120 }}
        >
          <span className="size-2 animate-pulse rounded-full bg-text" />
        </span>
      </span>
      {label && <span className="text-sm text-muted">{label}</span>}
    </span>
  );
}
