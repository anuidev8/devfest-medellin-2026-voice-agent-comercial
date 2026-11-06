"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type WaveMode = "idle" | "listening" | "thinking" | "speaking";
export type VoiceLevels = { agent: number; user: number };

type VoiceWaveProps = {
  levelsRef: MutableRefObject<VoiceLevels>;
  mode: WaveMode;
  className?: string;
  /** Bar color; white inside the blue voice pill. */
  color?: string;
};

const BARS = 9;

/** Flat waveform bars for the blue voice capsule (Gemini Live style). Reads levels without re-rendering React. */
export function VoiceWave({ levelsRef, mode, className, color = "#ffffff" }: VoiceWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    const heights = new Array(BARS).fill(0.15);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (now: number) => {
      const t = reduceMotion ? 0 : now / 1000;
      const { agent, user } = levelsRef.current;
      const m = modeRef.current;
      const level = m === "speaking" ? Math.min(agent * 2.2, 1) : m === "listening" ? Math.min(user * 2.6, 1) : 0;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      const barW = 3;
      const gap = 4;
      const total = BARS * barW + (BARS - 1) * gap;
      const x0 = (width - total) / 2;
      const maxH = height * 0.62;

      for (let i = 0; i < BARS; i += 1) {
        const center = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        let target: number;
        if (m === "thinking") target = 0.18 + 0.5 * Math.max(0, Math.sin(t * 6 - i * 0.7));
        else if (m === "idle") target = 0.12 + 0.05 * Math.sin(t * 1.4 + i);
        else target = 0.14 + level * (0.45 + 0.55 * center) * (0.6 + 0.4 * Math.abs(Math.sin(t * 9 + i * 1.3)));
        heights[i] += (target - heights[i]) * 0.25;
        const h = Math.max(4, heights[i] * maxH);
        const x = x0 + i * (barW + gap);
        const y = (height - h) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, barW / 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [levelsRef, color]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
