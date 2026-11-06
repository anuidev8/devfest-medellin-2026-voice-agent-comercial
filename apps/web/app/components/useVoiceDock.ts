"use client";

import { useEffect, useState } from "react";
import type { Transition } from "motion/react";

/** Same clamp as `--voice-col` in globals.css: clamp(340px, 30vw, 500px). */
const voiceColFor = (w: number) => Math.min(500, Math.max(340, w * 0.3));

/** Soft, slightly springy glide for the avatar moving centre → left column. */
export const DOCK_SPRING: Transition = { type: "spring", stiffness: 70, damping: 18, mass: 1.1 };

/**
 * Avatar docking state. The page sets `html[data-rail="1"]` when the board opens
 * (voice started / results landed). On desktop the avatar column shrinks from full
 * width (avatar centred, big) to the left voice column; on mobile it stays put.
 * Returns the animated width target for framer-motion.
 */
export function useVoiceDock() {
  const [rail, setRail] = useState(false);
  const [vw, setVw] = useState(0);

  useEffect(() => {
    const html = document.documentElement;
    const read = () => setRail(html.getAttribute("data-rail") === "1");
    read();
    const mo = new MutationObserver(read);
    mo.observe(html, { attributes: true, attributeFilter: ["data-rail"] });
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const docked = rail && vw >= 1024;
  return { docked, width: docked ? voiceColFor(vw) : ("100%" as const) };
}
