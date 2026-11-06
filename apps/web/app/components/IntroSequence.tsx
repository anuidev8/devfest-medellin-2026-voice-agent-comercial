"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE_NS from "three";
import { AVATAR } from "./avatar/config";

/**
 * Full-screen cinematic intro (once per session, skippable):
 * bloom → glossy spheres + orbit ribbons + big "Bienvenidos" (DevFest Medellín 2026) → everything spreads out while
 * dust streams in and forms the hologram woman → she shrinks into the arch and the app appears.
 * References: Connection explainer (spheres), Create Future banner (ribbons), CRM leads (converging beams).
 */
const SEEN_KEY = "cva-intro-seen";
export const REPLAY_INTRO_EVENT = "cva:replay-intro";
/** Fired when the particle woman starts landing on the arch: the app avatar materializes then. */
export const INTRO_HANDOFF_EVENT = "cva:intro-handoff";
/** Fired when the (one and only) avatar should assemble from wind particles, big in the centre. */
export const AVATAR_BUILD_EVENT = "cva:avatar-build";

/** Story timeline (ms): welcome → context → community cards → best match → second welcome → avatar forms → app. */
const T = {
  title: 400,
  context: 3600,
  community: 6200, // card stream runs ~5.5 s so people can read the cards
  focus: 11700, // proposal holds ~3 s
  rewelcome: 14700,
  spread: 18700, // second welcome holds ~4 s
  formed: 20500,
  handoff: 21900,
  landed: 23400, // the avatar has glided into the arch → her projector light grows in
  done: 25200, // blue has spread out past the edges; app pieces have risen in one by one
} as const;
type Phase = "bloom" | "title" | "context" | "community" | "focus" | "rewelcome" | "spread" | "formed" | "handoff" | "landed" | "done";

// Glossy spheres: x/y in % of the viewport, size in vmin, depth 0 (far, sharp) → 1 (near, blurred).
const SPHERES = [
  { x: 8, y: 14, s: 34, d: 1 },
  { x: 86, y: 8, s: 40, d: 1 },
  { x: 94, y: 78, s: 30, d: 0.9 },
  { x: 6, y: 86, s: 26, d: 0.85 },
  { x: 50, y: 104, s: 30, d: 0.8 },
  { x: 27, y: 26, s: 9, d: 0.3 },
  { x: 74, y: 30, s: 7, d: 0.25 },
  { x: 70, y: 74, s: 11, d: 0.35 },
  { x: 31, y: 72, s: 6, d: 0.2 },
  { x: 60, y: 18, s: 3.2, d: 0 },
  { x: 18, y: 50, s: 4, d: 0.1 },
  { x: 82, y: 52, s: 2.6, d: 0 },
  { x: 42, y: 84, s: 2.4, d: 0 },
];

export function IntroSequence() {
  const [phase, setPhase] = useState<Phase>("bloom");
  const [active, setActive] = useState(true);
  const startRef = useRef(0);
  const timers = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const finish = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setPhase("done");
    setActive(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
    document.documentElement.removeAttribute("data-intro");
  }, []);

  const run = useCallback(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timers.current.forEach((id) => window.clearTimeout(id));
    setActive(true);
    setPhase("bloom");
    startRef.current = performance.now();
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    if (reduce) {
      setPhase("title");
      at(1800, () => setPhase("handoff"));
      at(2400, finish);
      return;
    }
    at(T.title, () => setPhase("title"));
    at(T.context, () => setPhase("context"));
    at(T.community, () => setPhase("community"));
    at(T.focus, () => setPhase("focus"));
    at(T.rewelcome, () => setPhase("rewelcome"));
    at(T.spread, () => {
      window.dispatchEvent(new Event(AVATAR_BUILD_EVENT));
      setPhase("spread");
    });
    at(T.formed, () => setPhase("formed"));
    at(T.handoff, () => {
      // The avatar layer (CharacterStage) glides from the centre into the arch on this attribute.
      document.documentElement.setAttribute("data-intro", "handoff");
      window.dispatchEvent(new Event(INTRO_HANDOFF_EVENT));
      setPhase("handoff");
    });
    at(T.landed, () => {
      document.documentElement.setAttribute("data-intro", "landed");
      setPhase("landed");
    });
    at(T.done, finish);
  }, [finish]);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen) {
      // Defer so the state change is not synchronous within the effect body.
      const id = window.setTimeout(finish, 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(run, 0);
    return () => window.clearTimeout(id);
  }, [run, finish]);

  useEffect(() => {
    const replay = () => {
      try {
        sessionStorage.removeItem(SEEN_KEY);
      } catch {}
      document.documentElement.setAttribute("data-intro", "1");
      run();
    };
    window.addEventListener(REPLAY_INTRO_EVENT, replay);
    return () => window.removeEventListener(REPLAY_INTRO_EVENT, replay);
  }, [run]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  useIntroParticles(canvasRef, active, startRef);

  if (!active) return null;

  return (
    <div className="intro fixed inset-0 z-[60] overflow-hidden" data-phase={phase} role="dialog" aria-modal="true" aria-label="Introducción">
      <div className="intro-bg absolute inset-0" aria-hidden="true">
        <div className="intro-rays absolute inset-[-50%]" />
      </div>

      <svg className="intro-ribbons absolute top-1/2 left-1/2 h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2" viewBox="-100 -100 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="ribbon" x1="0" x2="1">
            <stop offset="0" stopColor="#9fd0ff" stopOpacity="0" />
            <stop offset="0.6" stopColor="#bfe3ff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[22, 30, 39, 49].map((r, i) => (
          <g key={r} className="intro-ribbon" style={{ animationDuration: `${14 + i * 5}s`, animationDirection: i % 2 ? "reverse" : "normal" }}>
            <ellipse cx="0" cy="0" rx={r} ry={r * 0.36} fill="none" stroke="url(#ribbon)" strokeWidth={0.5 + i * 0.15} strokeLinecap="round" strokeDasharray={`${r * 1.6} ${r * 4.6}`} transform="rotate(-14)" />
          </g>
        ))}
      </svg>

      {SPHERES.map((b, i) => {
        const dx = b.x - 50;
        const dy = b.y - 50;
        const len = Math.hypot(dx, dy) || 1;
        return (
          <span
            key={i}
            className="intro-sphere absolute rounded-full"
            aria-hidden="true"
            style={
              {
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: `${b.s}vmin`,
                height: `${b.s}vmin`,
                filter: b.d > 0.5 ? `blur(${(b.d - 0.5) * 18}px)` : undefined,
                "--delay": `${200 + i * 70}ms`,
                "--drift": `${4 + i * 0.7}s`,
                "--out-x": `${(dx / len) * 70}vw`,
                "--out-y": `${(dy / len) * 70}vh`,
              } as React.CSSProperties
            }
          />
        );
      })}

      <div className="intro-grid seti-texture absolute inset-0" aria-hidden="true" />

      <canvas
        ref={canvasRef}
        className="intro-canvas absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      <JourneyLayer />

      <BigTitle
        className="intro-title intro-title-1"
        kicker="DevFest Medellín 2026"
        text="Bienvenidos"
        sub="Gente de GDG Medellín, aquí en la UPB. Qué gusto saludarlos."
      />
      <BigTitle
        className="intro-title intro-title-2"
        kicker="NoShy Concierge · GDG Medellín"
        text="Hola"
        sub="Te ayudo a preparar una venta, o a resolver lo que tu empresa necesita, con el talento de la comunidad."
      />

      <button type="button" onClick={finish} className="intro-skip absolute right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] rounded-full bg-white/12 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20" autoFocus>
        Saltar intro
      </button>
    </div>
  );
}

function BigTitle({ className, kicker, text, sub }: { className: string; kicker: string; text: string; sub: string }) {
  return (
    <div className={`${className} pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-white`}>
      <div>
        <p className="intro-kicker mb-5 text-sm font-medium tracking-[0.3em] uppercase md:text-base">{kicker}</p>
        <h2 className="text-[clamp(52px,13vw,180px)] leading-[0.95] font-medium tracking-[-0.05em]" aria-label={text}>
          {text.split("").map((ch, i) => (
            <span key={i} className="intro-letter inline-block" style={{ "--i": i } as React.CSSProperties} aria-hidden="true">
              {ch === " " ? " " : ch}
            </span>
          ))}
        </h2>
        <p className="intro-sub mx-auto mt-6 max-w-[32ch] text-base text-white/80 md:text-xl">{sub}</p>
      </div>
    </div>
  );
}

/* ---------- Journey: what you sell → community resources stream in → your winning proposal ---------- */
/* Mirrors the agent's real tools: summarize_context → match_community → build_strategy_plan → book_meeting. */

export type IconName = "box" | "target" | "flag" | "user" | "trophy" | "doc" | "quote" | "spark" | "check";

function Icon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {name === "box" && <g {...p}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></g>}
      {name === "target" && <g {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></g>}
      {name === "flag" && <g {...p}><path d="M5 21V4m0 0h11l-2 4 2 4H5" /></g>}
      {name === "user" && <g {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></g>}
      {name === "trophy" && <g {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M9 20h6M12 14v6" /></g>}
      {name === "doc" && <g {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></g>}
      {name === "quote" && <g {...p}><path d="M5 18c2-1 3-3 3-6H5V7h5v5c0 4-2 6-5 6zM14 18c2-1 3-3 3-6h-3V7h5v5c0 4-2 6-5 6z" /></g>}
      {name === "spark" && <g {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></g>}
      {name === "check" && <g {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></g>}
    </svg>
  );
}

export type JSource = { icon: IconName; label: string; value: string; meta: string };

const SOURCES: JSource[] = [
  { icon: "box", label: "Tu producto", value: "Software B2B", meta: "Plan Pro · $490/mes" },
  { icon: "target", label: "Tu cliente ideal", value: "Cadenas retail", meta: "50+ tiendas" },
  { icon: "flag", label: "Tu meta", value: "Cerrar 3 cuentas", meta: "Este trimestre" },
];

export type JCard =
  | { kind: "expert"; name: string; role: string; stat: string; hue: number }
  | { kind: "case"; title: string; owner: string; metric: string }
  | { kind: "template"; title: string; uses: string }
  | { kind: "skill"; title: string; uses: string }
  | { kind: "quote"; text: string; who: string };

const KIND_META: Record<JCard["kind"], { icon: IconName; tag: string }> = {
  expert: { icon: "user", tag: "Experto" },
  case: { icon: "trophy", tag: "Caso de éxito" },
  template: { icon: "doc", tag: "Plantilla" },
  skill: { icon: "spark", tag: "Skill" },
  quote: { icon: "quote", tag: "Testimonio" },
};

// Community resources the agent can pull into a sale (demo data).
const POOL: JCard[] = [
  { kind: "expert", name: "María Gómez", role: "Ventas B2B · Retail", stat: "12 cuentas cerradas", hue: 205 },
  { kind: "case", title: "Software para 40 tiendas", owner: "Diego", metric: "+38% ventas" },
  { kind: "template", title: "Propuesta retail · ROI", uses: "Usada 214 veces" },
  { kind: "expert", name: "Andrés Ruiz", role: "Pricing & negociación", stat: "Cierre 41%", hue: 160 },
  { kind: "quote", text: "“Cerramos en 2 semanas con su caso.”", who: "Laura · Agency lead" },
  { kind: "case", title: "Piloto en cadena de farmacias", owner: "Camila", metric: "ROI 3.2x" },
  { kind: "expert", name: "Sofía Lara", role: "Demos que convierten", stat: "+60 demos/mes", hue: 280 },
  { kind: "template", title: "Guion de descubrimiento", uses: "Usada 532 veces" },
  { kind: "case", title: "Bot WhatsApp para retail", owner: "Diego", metric: "3 clientes activos" },
  { kind: "expert", name: "Tomás Vidal", role: "Alianzas y canales", stat: "8 partners", hue: 30 },
  { kind: "quote", text: "“La plantilla nos ahorró una semana.”", who: "Camila · Founder" },
  { kind: "template", title: "Manejo de objeciones", uses: "Usada 389 veces" },
];

/** Conveyor: resources stream out of the hub along the floor toward the viewer (CRM "leads incoming" reference). */
const LANES = [-480, -240, 0, 240, 480];
const STREAM_DUR = 8.5; // seconds for one card to travel hub → viewer
function buildStream(pool: JCard[], count: number, lanes: number[]) {
  return Array.from({ length: count }, (_, i) => ({
    card: pool[i % pool.length]!,
    lane: lanes[(i * 3) % lanes.length]!,
    // Negative delays so the floor is already full when the chapter opens.
    delay: -((i * STREAM_DUR) / count) - (i % 2) * 0.13,
  }));
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function CardBody({ c }: { c: JCard }) {
  const meta = KIND_META[c.kind];
  return (
    <>
      <span className="j-kind absolute top-3 right-3 grid size-6 place-items-center rounded-full">
        <Icon name={meta.icon} className="size-3.5" />
      </span>
      {c.kind === "expert" ? (
        <div className="flex items-center gap-2.5 pr-7">
          <span className="j-avatar relative grid size-10 flex-none place-items-center rounded-full text-[13px] font-semibold text-white" style={{ "--h": c.hue } as React.CSSProperties}>
            {initials(c.name)}
            <span className="absolute right-0 bottom-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0d2a8a]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] leading-tight font-semibold">{c.name}</p>
            <p className="truncate text-[11px] opacity-70">{c.role}</p>
          </div>
        </div>
      ) : (
        <div className="pr-7">
          <p className="text-[13px] leading-snug font-semibold">{c.kind === "quote" ? c.text : c.title}</p>
          <p className="mt-0.5 truncate text-[11px] opacity-70">{c.kind === "case" ? `Por ${c.owner}` : c.kind === "template" || c.kind === "skill" ? c.uses : c.who}</p>
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="j-tag rounded-full px-2 py-0.5 text-[10px] font-medium">{meta.tag}</span>
        {c.kind === "expert" && <span className="text-[10px] font-medium opacity-80">{c.stat}</span>}
        {c.kind === "case" && <span className="j-metric text-[12px] font-semibold">{c.metric}</span>}
      </div>
    </>
  );
}

const KPIS = [
  { label: "Pipeline", value: "$184k", delta: "+22%" },
  { label: "Propuestas", value: "37", delta: "+9" },
  { label: "Tasa de cierre", value: "34%", delta: "+6pt" },
  { label: "Reuniones", value: "12", delta: "esta semana" },
];

/** Everything the journey shows. The intro uses demo data; the send finale passes the session's real data. */
export type JourneyContent = {
  captions: [string, string, string];
  sources: JSource[];
  hub: { profile: string; profileRight: string; resources: string; resourcesSub: string; count?: number };
  cards: JCard[];
  /** Cards riding the floor at once (repeats the pool). */
  streamCount: number;
  lanes: number[];
  focus: { badge: string; eyebrow: string; title: string; items: string[]; footLeft: string; footRight: string };
  dash: boolean;
  /** Perspective floor conveyor (intro). The send finale scatters its cards instead. */
  floor: boolean;
};

export const INTRO_JOURNEY: JourneyContent = {
  captions: ["Entiendo lo que vendes", "Busco talento y recursos en la comunidad", "Preparo tu propuesta para el cliente"],
  sources: SOURCES,
  hub: { profile: "Perfil de venta", profileRight: "3/3", resources: "Talento y recursos", resourcesSub: "Expertos · casos · plantillas" },
  cards: POOL,
  streamCount: 20,
  lanes: LANES,
  focus: {
    badge: "Probabilidad de cierre · 82%",
    eyebrow: "Propuesta comercial",
    title: "Cadena Retail Andina",
    items: ["Caso de éxito: +38% ventas (Diego)", "Precio sugerido: Plan Pro anual", "Respuesta a 3 objeciones clave", "Aliada para la demo: María"],
    footLeft: "Lista para enviar",
    footRight: "Agendar reunión →",
  },
  dash: true,
  floor: true,
};

/**
 * `focusOpen` (send finale): the summary card is born from the point where the wires meet —
 * driven inline so it never depends on the stylesheet; the intro leaves it to CSS phases.
 */
export function JourneyLayer({ content = INTRO_JOURNEY, focusOpen }: { content?: JourneyContent; focusOpen?: boolean }) {
  const stream = useMemo(() => buildStream(content.cards, content.streamCount, content.lanes), [content]);
  return (
    <div className="journey pointer-events-none absolute inset-0 text-white" aria-hidden="true">
      {/* Glass sales dashboard floating behind the stream (CRM reference). */}
      {content.dash && <div className="j-dash absolute top-[40%] left-1/2 w-[min(1040px,92vw)] -translate-x-1/2 rounded-[26px] p-4">
        <div className="flex items-center justify-between px-1 text-[12px] font-medium text-white/80">
          <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-400" />Panel comercial</span>
          <span className="text-white/50">En vivo</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {KPIS.map((k) => (
            <div key={k.label} className="j-kpi rounded-[16px] px-3 py-2.5">
              <p className="text-[10px] tracking-[0.1em] text-white/55 uppercase">{k.label}</p>
              <p className="mt-0.5 text-[20px] font-semibold tabular-nums">{k.value}</p>
              <svg viewBox="0 0 100 24" className="mt-1 h-5 w-full" preserveAspectRatio="none">
                <path d="M0 20 C 15 18, 22 12, 35 14 S 58 6, 70 9 S 88 3, 100 2" fill="none" stroke="#8fd0ff" strokeWidth="1.6" />
              </svg>
              <p className="text-[10px] text-emerald-300">{k.delta}</p>
            </div>
          ))}
        </div>
      </div>}

      {/* Perspective floor + resource conveyor, vanishing point just under the hub. */}
      {content.floor && <>
      <div className="j-stream absolute inset-x-0 top-[46%] bottom-0">
        <div className="j-plane absolute top-0 left-1/2">
          <div className="j-grid absolute" />
          <div className="j-rays absolute" />
          <div className="j-lightpath absolute" />
          {stream.map((s, i) => (
            <div
              key={i}
              className="j-card j-flow absolute w-[210px] rounded-[18px] p-3.5 text-left"
              style={{ "--lane": `${s.lane}px`, animationDelay: `${s.delay}s`, animationDuration: `${STREAM_DUR}s` } as React.CSSProperties}
            >
              <CardBody c={s.card} />
            </div>
          ))}
        </div>
        <div className="j-dim absolute inset-0" />
      </div>
      <div className="j-sparks absolute inset-x-0 top-[44%] bottom-0">
        {Array.from({ length: 26 }, (_, i) => (
          <span key={i} className="j-spark absolute rounded-full bg-white" style={{ left: `${50 + ((i * 37) % 30) - 15}%`, "--sd": `${(i * 0.29) % 3}s`, "--ss": `${1.8 + (i % 5) * 0.4}s` } as React.CSSProperties} />
        ))}
      </div>
      </>}

      {/* The proposal the agent assembles from those resources. */}
      <div
        className="j-card j-focus absolute top-1/2 left-1/2 w-[min(320px,80vw)] rounded-[24px] p-5 text-left"
        style={
          focusOpen === undefined
            ? undefined
            : {
                zIndex: 4,
                opacity: focusOpen ? 1 : 0,
                transform: `translate(-50%, -30%) scale(${focusOpen ? 1.05 : 0.12})`,
                transition: "transform 0.85s cubic-bezier(0.2, 0.9, 0.25, 1.25) 0.5s, opacity 0.35s ease 0.5s",
              }
        }
      >
        <span className="j-badge absolute -top-3 right-4 rounded-full px-3 py-1 text-[11px] font-semibold">{content.focus.badge}</span>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-[#2f6bff] text-white">
            <Icon name="doc" className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-medium tracking-[0.1em] uppercase opacity-60">{content.focus.eyebrow}</p>
            <p className="text-[17px] leading-tight font-semibold">{content.focus.title}</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 text-[13px]">
          {content.focus.items.map((t, i) => (
            <li key={t} className="j-check flex items-center gap-2" style={{ "--ci": i } as React.CSSProperties}>
              <span className="grid size-5 flex-none place-items-center rounded-full bg-emerald-500 text-white">
                <Icon name="check" className="size-3" />
              </span>
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between rounded-[14px] bg-[#0b1a5c]/[0.06] px-3 py-2 text-[12px]">
          <span className="opacity-70">{content.focus.footLeft}</span>
          <span className="font-semibold text-[#2f6bff]">{content.focus.footRight}</span>
        </div>
      </div>

      <div className="journey-caption absolute inset-x-0 top-[6%] grid justify-items-center gap-2 px-6 text-center">
        <p className="j-cap j-cap-1 text-[clamp(22px,3.2vw,40px)] font-medium tracking-[-0.03em]">
          <span className="mr-3 text-white/55 tabular-nums">01</span>{content.captions[0]}
        </p>
        <p className="j-cap j-cap-2 text-[clamp(22px,3.2vw,40px)] font-medium tracking-[-0.03em]">
          <span className="mr-3 text-white/55 tabular-nums">02</span>{content.captions[1]}
        </p>
        <p className="j-cap j-cap-3 text-[clamp(22px,3.2vw,40px)] font-medium tracking-[-0.03em]">
          <span className="mr-3 text-white/55 tabular-nums">03</span>{content.captions[2]}
        </p>
      </div>

      {/* Glowing light streams from each source into the hub. */}
      <svg className="journey-beams absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs>
          <linearGradient id="jbeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7cc4ff" stopOpacity="0.1" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>
          <filter id="jglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {[250, 500, 750].map((x, i) => {
          const d = `M ${x} 225 C ${x} 300, 500 280, 500 352`;
          return (
            <g key={x}>
              <path className="j-beam-glow" d={d} stroke="#5aa8ff" strokeWidth="10" fill="none" filter="url(#jglow)" />
              <path className="j-beam-core" d={d} stroke="url(#jbeam)" strokeWidth="2" fill="none" />
              <path className="j-beam-in" d={d} stroke="#ffffff" strokeWidth="3.5" fill="none" strokeLinecap="round" style={{ animationDelay: `${i * 0.3}s` }} />
            </g>
          );
        })}
      </svg>

      <div className="journey-sources absolute inset-x-0 top-[15%] flex justify-around px-[8vw]">
        {content.sources.map((src, i) => (
          <div key={src.label} className="j-source j-glass flex items-center gap-3 rounded-[18px] px-4 py-3 text-left" style={{ "--d": `${i * 120}ms` } as React.CSSProperties}>
            <span className="grid size-9 place-items-center rounded-[12px] bg-gradient-to-br from-[#8fd0ff] to-[#2f6bff] text-white shadow-[0_0_18px_rgb(80_160_255/0.7)]">
              <Icon name={src.icon} className="size-[18px]" />
            </span>
            <div>
              <p className="text-[10px] font-medium tracking-[0.12em] text-white/60 uppercase">{src.label}</p>
              <p className="text-[clamp(14px,1.5vw,17px)] leading-tight font-semibold">{src.value}</p>
              <p className="text-[10px] text-white/55">{src.meta}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="journey-hub j-glass absolute top-[35.2%] left-1/2 w-[min(320px,74vw)] -translate-x-1/2 rounded-[22px] px-5 py-4">
        <div className="j-hub-a flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-white/15"><Icon name="spark" className="size-5" /></span>
          <div className="flex-1">
            <p className="text-[10px] font-medium tracking-[0.12em] text-white/60 uppercase">{content.hub.profile}</p>
            <div className="mt-1.5 grid gap-1.5">
              <span className="j-line h-1.5 rounded-full bg-white/85" style={{ "--w": "92%" } as React.CSSProperties} />
              <span className="j-line h-1.5 rounded-full bg-white/55" style={{ "--w": "70%" } as React.CSSProperties} />
            </div>
          </div>
          <p className="text-xl font-semibold tabular-nums">{content.hub.profileRight}</p>
        </div>
        <div className="j-hub-b absolute inset-x-5 top-1/2 flex -translate-y-1/2 items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-white/15"><Icon name="user" className="size-5" /></span>
          <div className="flex-1">
            <p className="text-[10px] font-medium tracking-[0.12em] text-white/60 uppercase">{content.hub.resources}</p>
            <p className="text-[11px] text-white/55">{content.hub.resourcesSub}</p>
          </div>
          {content.hub.count == null ? (
            <p className="j-count text-[28px] leading-none font-semibold tabular-nums" />
          ) : (
            <p className="text-[28px] leading-none font-semibold tabular-nums">{content.hub.count}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Share of the intro viewport height the particle woman occupies (1 / INTRO_SPAN). */
const INTRO_SPAN = 1.9;

/** Dust → woman. Points sampled from the avatar GLB, flown in from a wide starfield. */
function useIntroParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>, active: boolean, startRef: React.RefObject<number>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
      } catch {
        return;
      }
      let gltf;
      try {
        gltf = await new GLTFLoader().loadAsync(AVATAR.url);
      } catch {
        renderer.dispose();
        return;
      }
      if (disposed) {
        renderer.dispose();
        return;
      }

      let mesh: THREE_NS.Mesh | null = null;
      gltf.scene.traverse((o) => {
        const m = o as THREE_NS.Mesh;
        if (m.isMesh && !mesh) mesh = m;
      });
      if (!mesh) return;
      const geo = (mesh as THREE_NS.Mesh).geometry;
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const height = bb.max.y - bb.min.y;
      const center = bb.getCenter(new THREE.Vector3());
      const pos = geo.getAttribute("position");

      const N = Math.min(9000, pos.count);
      const step = pos.count / N;
      const target = new Float32Array(N * 3);
      const start = new Float32Array(N * 3);
      const delay = new Float32Array(N);
      const seed = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const v = Math.floor(i * step);
        target[i * 3] = pos.getX(v) - center.x;
        target[i * 3 + 1] = pos.getY(v) - center.y;
        target[i * 3 + 2] = pos.getZ(v) - center.z;
        // Wide starfield; a share comes in as beams from the top corners (CRM reference).
        const beam = i % 5 === 0;
        if (beam) {
          const side = i % 2 ? 1 : -1;
          const t = Math.random();
          start[i * 3] = side * (2.8 - t * 1.6) * height;
          start[i * 3 + 1] = (1.6 - t * 0.9) * height;
          start[i * 3 + 2] = (Math.random() - 0.5) * 0.3 * height;
        } else {
          start[i * 3] = (Math.random() - 0.5) * 4.2 * height;
          start[i * 3 + 1] = (Math.random() - 0.5) * 2.4 * height;
          start[i * 3 + 2] = (Math.random() - 0.7) * 2.0 * height;
        }
        delay[i] = Math.random() * 0.45 + (beam ? 0.1 : 0);
        seed[i] = Math.random();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(start, 3));
      g.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
      g.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
      g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      const uniforms = { uForm: { value: 0 }, uDust: { value: 0 }, uTime: { value: 0 }, uPx: { value: 400 }, uFade: { value: 1 } };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute vec3 aTarget; attribute float aDelay; attribute float aSeed;
          uniform float uForm, uDust, uTime, uPx;
          varying float vA; varying float vSeed;
          void main() {
            float m = clamp((uForm * 1.45 - aDelay), 0.0, 1.0);
            m = m * m * (3.0 - 2.0 * m);
            vec3 drift = vec3(sin(uTime * 0.3 + aSeed * 20.0), cos(uTime * 0.25 + aSeed * 13.0), 0.0) * 0.04;
            vec3 p = mix(position + drift, aTarget, m);
            float tw = 0.55 + 0.45 * sin(uTime * 2.5 + aSeed * 30.0);
            vA = mix(uDust * 0.35 * tw, 0.55 + 0.45 * tw, m);
            vSeed = aSeed;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = mix(1.4 + aSeed * 1.6, 1.1 + step(0.97, aSeed) * 2.0, m) * uPx / -mv.z;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uFade;
          varying float vA; varying float vSeed;
          void main() {
            float r = length(gl_PointCoord - 0.5);
            if (r > 0.5) discard;
            vec3 c = mix(vec3(0.36, 0.58, 1.0), vec3(0.85, 0.94, 1.0), vSeed);
            gl_FragColor = vec4(c, vA * uFade * (1.0 - smoothstep(0.2, 0.5, r)));
          }`,
      });
      const points = new THREE.Points(g, mat);
      points.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(points);
      const fov = 30;
      const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 100);
      camera.position.set(0, 0, (height * INTRO_SPAN) / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2)));
      camera.lookAt(0, 0, 0);

      const resize = () => {
        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        uniforms.uPx.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))) / 90;
      };
      resize();
      window.addEventListener("resize", resize);

      const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      const render = (ms: number) => {
        const t = ms / 1000;
        uniforms.uTime.value = t;
        // Dust dims while the journey cards tell the story, then returns for the second welcome.
        const journey = ease((ms - T.context) / 600) * (1 - ease((ms - T.rewelcome) / 900));
        uniforms.uDust.value = ease((ms - 600) / 1400) * (1 - 0.75 * journey);
        uniforms.uForm.value = 0; // dust only — the woman herself is the SETI avatar (one avatar, no swap)
        uniforms.uFade.value = 1 - ease((ms - T.handoff) / 1500); // ambient dust clears with the blue
        points.rotation.y = 0.35 * (1 - ease((ms - T.spread) / (T.formed - T.spread + 600))) + 0.04 * Math.sin(t * 0.6);
        renderer.render(scene, camera);
      };
      let raf = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        render(performance.now() - (startRef.current ?? 0));
      };
      loop();
      if (process.env.NODE_ENV !== "production") (window as unknown as { __introAt?: (ms: number) => void }).__introAt = render;

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        g.dispose();
        mat.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [canvasRef, active, startRef]);
}
