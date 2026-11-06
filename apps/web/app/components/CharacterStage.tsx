"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { ACT_LABEL, useAct, type Act } from "./act";
import { AVATAR_BUILD_EVENT, REPLAY_INTRO_EVENT } from "./IntroSequence";
import { VoiceOrb, type OrbState } from "./VoiceOrb";
import type { VoiceLevels } from "./VoiceWave";

const SetiHologram = dynamic(() => import("./avatar/SetiHologram").then((m) => m.SetiHologram), { ssr: false });

const noop = () => () => {};
const introPending = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-intro") === "1";

/**
 * The agent's body, framed by the arch portal: the SETI hologram woman in blue.
 *
 * There is exactly one avatar. It lives in a fixed layer that, during the intro, sits big in the
 * centre (above the intro) and assembles from wind particles; at the handoff the same canvas glides
 * down into the arch and then tracks it. Nothing is swapped or faded, so nothing flashes.
 * The flat orb shows while the model loads and stays as the fallback if WebGL is unavailable.
 */
export function CharacterStage({
  state,
  onClick,
  label,
  levelsRef,
  act: actOverride,
}: {
  state: OrbState;
  /** Test mode can force an act; otherwise it follows the agent's tool calls. */
  act?: Act;
  onClick?: () => void;
  label?: string;
  levelsRef?: MutableRefObject<VoiceLevels>;
}) {
  const derivedAct = useAct();
  const act = actOverride ?? derivedAct;
  const [avatar, setAvatar] = useState<"loading" | "ready" | "failed">("loading");
  const [build, setBuild] = useState(() => !introPending());
  const archRef = useRef<HTMLDivElement | null>(null);
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  // Expose the voice state page-wide so the moving print border can swell while the agent talks.
  useEffect(() => {
    document.documentElement.setAttribute("data-voice", state);
    return () => document.documentElement.removeAttribute("data-voice");
  }, [state]);

  // The intro tells us when to assemble; a replay hides her again until then.
  useEffect(() => {
    const onBuild = () => setBuild(true);
    const onReplay = () => setBuild(false);
    window.addEventListener(AVATAR_BUILD_EVENT, onBuild);
    window.addEventListener(REPLAY_INTRO_EVENT, onReplay);
    return () => {
      window.removeEventListener(AVATAR_BUILD_EVENT, onBuild);
      window.removeEventListener(REPLAY_INTRO_EVENT, onReplay);
    };
  }, []);

  const body = (
    <div ref={archRef} className="arch relative aspect-[0.82] w-[min(300px,62vw,38dvh)] md:w-[min(340px,30vw,44dvh)]">
      {avatar !== "ready" && (
        <div className="absolute inset-0 grid place-items-center">
          <VoiceOrb state={state} size={130} />
        </div>
      )}
      {avatar !== "failed" && (
        <div className={`arch-avatar absolute inset-0 transition-opacity duration-[900ms] ${avatar === "ready" ? "opacity-100" : "opacity-0"}`}>
          {/* Hologram projector: light cone behind her, glowing disc + pulsing rings under her. */}
          <div className="holo-beam" aria-hidden="true" />
          <div className="holo-base" aria-hidden="true">
            <span className="holo-ring" />
            <span className="holo-ring holo-ring-2" />
          </div>
        </div>
      )}
      <span className="pill absolute -top-4 left-1/2 h-7 -translate-x-1/2 bg-bg text-[11px] ring-1 ring-line">{ACT_LABEL[act]}</span>
    </div>
  );

  const layer =
    mounted && avatar !== "failed"
      ? createPortal(
          <AvatarLayer archRef={archRef}>
            <SetiHologram
              build={build}
              talking={state === "speaking"}
              levelsRef={levelsRef}
              onReady={() => setAvatar("ready")}
              onError={() => setAvatar("failed")}
            />
          </AvatarLayer>,
          document.body,
        )
      : null;

  if (!onClick)
    return (
      <>
        {body}
        {layer}
      </>
    );
  return (
    <>
      <button type="button" onClick={onClick} className="rounded-t-full" aria-label={label}>
        {body}
      </button>
      {layer}
    </>
  );
}

/**
 * Fixed layer holding the one avatar canvas. Its size is the intro's big frame (so the canvas stays
 * crisp); in the app it is translated + scaled onto the arch with a transform, re-measured every frame
 * so it follows layout changes. The intro → arch move is the only animated transition.
 */
function AvatarLayer({ archRef, children }: { archRef: MutableRefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const h = Math.min(vh * 0.66, (vw * 0.95) / 0.82);
      const w = h * 0.82;
      const left = (vw - w) / 2;
      const top = vh * 0.57 - h / 2;
      const mode = document.documentElement.getAttribute("data-intro") ?? "";
      let transform = "none";
      const arch = archRef.current;
      if (mode !== "1" && arch) {
        const r = arch.getBoundingClientRect();
        // A touch bigger than the arch and lowered so her bust stands on the projector disc.
        const s = (r.height / h) * 1.12;
        const dx = r.left + r.width / 2 - (left + w / 2);
        const dy = r.top + r.height * 0.6 - (top + h / 2);
        transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
      }
      const key = `${left}|${top}|${w}|${h}|${transform}|${mode}`;
      if (key === last) return;
      last = key;
      Object.assign(el.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`, transform });
      el.dataset.mode = mode || "app";
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [archRef]);

  return (
    <div ref={ref} className="avatar-layer" aria-hidden="true">
      {children}
    </div>
  );
}
