export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export const ORB_LABEL: Record<OrbState, string> = {
  idle: "Toca para hablar",
  listening: "Escuchando",
  thinking: "Pensando",
  speaking: "Hablando",
};

/** The agent's face: one glowing orb whose motion encodes the voice state. */
export function VoiceOrb({ state, size = 200, onClick, label }: { state: OrbState; size?: number; onClick?: () => void; label?: string }) {
  const orb = <span className="orb block" data-state={state} style={{ width: size, maxWidth: "60vw" }} aria-hidden="true" />;
  if (!onClick) return orb;
  return (
    <button onClick={onClick} className="rounded-full" aria-label={label ?? ORB_LABEL[state]} aria-pressed={state === "listening"}>
      {orb}
    </button>
  );
}

export function Wave({ active }: { active: boolean }) {
  const bars = [40, 80, 55, 100, 65, 90, 45, 70, 35];
  return (
    <div className={`wave flex h-7 items-center gap-[3px] transition-opacity ${active ? "opacity-100" : "opacity-25"}`} aria-hidden="true">
      {bars.map((h, i) => (
        <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.1}s`, animationPlayState: active ? "running" : "paused" }} />
      ))}
    </div>
  );
}
