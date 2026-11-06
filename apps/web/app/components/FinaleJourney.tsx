"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConcierge, type StageItem } from "./concierge";
import { CardBody, JourneyLayer, type JCard, type JourneyContent } from "./IntroSequence";

/** Fired when the finale ends → VoiceRoom asks the voice for the closing lines. */
export const FINALE_DONE_EVENT = "concierge:finale-done";
/** Test-mode button: play the finale with whatever data exists (or sample data). */
export const FINALE_PREVIEW_EVENT = "concierge:finale-preview";

export type Delivery =
  | { kind: "email"; to: string; subject: string; mock: boolean }
  | { kind: "meeting"; title: string; datetime: string; durationMinutes: number; mock: boolean };

/** The latest successful send_plan_email / book_meeting in the flow (or null). */
export function deliveryFrom(item: StageItem | undefined): Delivery | null {
  if (!item?.done || !item.result || typeof item.result !== "object") return null;
  const r = item.result as Record<string, unknown>;
  if (item.name === "send_plan_email" && r.status === "sent") {
    return { kind: "email", to: String(r.email ?? ""), subject: String(r.subject ?? "Tu plan"), mock: r.mock === true };
  }
  if (item.name === "book_meeting" && (r.status === "booked" || r.status === "ok")) {
    return {
      kind: "meeting",
      title: String(r.title ?? "Reunión"),
      datetime: String(r.datetime ?? ""),
      durationMinutes: Number(r.durationMinutes ?? 30),
      mock: r.mock === true,
    };
  }
  return null;
}

type Phase = "context" | "community" | "focus" | "check" | "out";

// Timeline (ms) — same chapters as the intro: sources → card stream → plan card, then sparkles → check.
const T = { community: 3200, focus: 8400, check: 12000, out: 16600, done: 17300 } as const;

const clip = (s: string, n = 46) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
}

type Person = { name?: string; role?: string; skills?: string[] };
type Project = { title?: string; ownerName?: string; outcome?: string; skills?: string[] };

/** A few cards (not the whole catalogue): the people, projects and skills this session actually matched. */
const PREVIEW_CARDS: JCard[] = [
  { kind: "expert", name: "Diego Restrepo", role: "Automatización · WhatsApp", stat: "Skill clave", hue: 205 },
  { kind: "case", title: "Bot de soporte retail", owner: "Diego", metric: "−60% tiempos" },
  { kind: "skill", title: "Discovery comercial", uses: "Para tu reunión" },
  { kind: "expert", name: "María Gómez", role: "Ventas B2B", stat: "Aliada", hue: 160 },
];

/** Journey content built from the real session (intake, summary, matches, plans) — sample data in preview. */
function useSendJourney(delivery: Delivery): JourneyContent {
  const { intake, clientName, items } = useConcierge();
  return useMemo(() => {
    const last = (name: string) =>
      [...items].find((i) => i.name === name && i.done)?.result as Record<string, unknown> | undefined; // items: newest first
    const summary = last("summarize_context");
    const match = last("match_community");
    const plan = last("build_strategy_plan");
    const product = last("build_product_plan");

    const people = ((match?.people as Person[] | undefined) ?? []).filter((p) => p.name).slice(0, 3);
    const projects = ((match?.projects as Project[] | undefined) ?? []).filter((p) => p.title).slice(0, 3);
    const skills = [
      ...new Set([
        ...(((product?.team as { skill?: string }[] | undefined) ?? []).map((t) => t.skill ?? "")),
        ...people.flatMap((p) => p.skills ?? []),
      ]),
    ]
      .filter(Boolean)
      .slice(0, 2);

    const cards: JCard[] = [
      ...people.map((p, i): JCard => ({
        kind: "expert",
        name: p.name!,
        role: clip(p.role ?? "", 30),
        stat: p.skills?.[0] ?? "Comunidad",
        hue: [205, 160, 280][i] ?? 30,
      })),
      ...projects.map((p): JCard => ({ kind: "case", title: clip(p.title!, 40), owner: p.ownerName ?? "Comunidad", metric: clip(p.outcome ?? "", 22) })),
      ...skills.map((k): JCard => ({ kind: "skill", title: k, uses: "Skill para tu plan" })),
    ];
    const real = cards.length >= 2;
    const pool = real ? cards : PREVIEW_CARDS;

    const challenge = (summary?.challenges as string[] | undefined)?.[0] ?? String(summary?.headline ?? "");
    const email = delivery.kind === "email";
    const dest = email ? delivery.to : formatWhen(delivery.datetime);

    const focusItems = [
      Array.isArray(plan?.questions) && plan.questions.length ? `${plan.questions.length} preguntas clave para tu cliente` : "",
      typeof plan?.nextStep === "string" ? clip(plan.nextStep, 52) : "",
      Array.isArray(product?.phases) && product.phases[0] ? `Fase 1: ${clip(String((product.phases[0] as { name?: string }).name ?? ""), 40)}` : "",
      people[0]?.name ? `Apoyo de la comunidad: ${people[0].name}` : projects[0]?.title ? `Caso para citar: ${clip(projects[0].title, 36)}` : "",
    ].filter(Boolean);

    return {
      captions: [
        email ? "Enviando tu propuesta" : "Agendando tu reunión",
        "Reuniendo productos y talento relacionados",
        "Construyendo tu plan para los próximos días",
      ],
      sources: [
        { icon: "box", label: "Tu necesidad", value: clip(intake.lookingFor || intake.persona || "Vender mejor", 30), meta: intake.name || "Tu contexto" },
        { icon: "target", label: "Cliente", value: clip(clientName || "Tu próximo cliente", 30), meta: clip(challenge || "Reto entendido", 34) },
        { icon: "flag", label: email ? "Para" : "Cuándo", value: clip(dest || "Tu correo", 30), meta: email ? "Propuesta por correo" : "Reunión" },
      ],
      hub: {
        profile: "Tu propuesta",
        profileRight: "✓",
        resources: "Productos y talento",
        resourcesSub: "Proyectos · personas · skills",
        count: pool.length,
      },
      cards: pool,
      streamCount: Math.min(10, Math.max(6, pool.length * 2)),
      lanes: [-300, 0, 300],
      focus: {
        badge: email ? "Lista para enviar" : "Reunión confirmada",
        eyebrow: "Tu plan · próximos días",
        title: clip(String(plan?.headline ?? product?.headline ?? (clientName ? `Plan para tu reunión con ${clientName}` : "Tu plan comercial")), 44),
        items: focusItems.length ? focusItems : ["Preguntas clave para tu cliente", "Ángulo de valor y objeciones", "Apoyo de la comunidad"],
        footLeft: email ? clip(delivery.to, 28) : clip(dest, 28),
        footRight: email ? "Enviando →" : "Agendada ✓",
      },
      dash: false,
      floor: false,
    };
  }, [intake, clientName, items, delivery]);
}

/**
 * Send finale (full screen, above the board, below the voice dock). Reuses the intro's journey
 * view with this session's real data: what you need → related products / talent stream in →
 * your plan for the next days → sparkles converge into a big check → back to the avatar.
 */
export function FinaleJourney({ delivery, onDone }: { delivery: Delivery; onDone: () => void }) {
  const content = useSendJourney(delivery);
  const [phase, setPhase] = useState<Phase>("context");
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase("community"), T.community),
      window.setTimeout(() => setPhase("focus"), T.focus),
      window.setTimeout(() => setPhase("check"), T.check),
      window.setTimeout(() => setPhase("out"), T.out),
      window.setTimeout(() => doneRef.current(), T.done),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const email = delivery.kind === "email";

  return (
    <motion.div
      className="absolute inset-0 z-10 overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label={email ? "Enviando tu propuesta" : "Agendando tu reunión"}
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "out" ? 0 : 1 }}
      transition={{ duration: 0.7 }}
    >
      {/* Inline display: the intro's "hide once seen" rule (html:not([data-intro]) .intro) must never hide the finale. */}
      <div
        className="intro intro--send absolute inset-0 overflow-hidden"
        style={{ display: "block" }}
        data-phase={phase === "out" ? "check" : phase}
      >
        <div className="intro-bg absolute inset-0" aria-hidden="true">
          <div className="intro-rays absolute inset-[-50%]" />
        </div>
        <JourneyLayer content={content} focusOpen={phase === "focus"} />
        <ScatterCards cards={content.cards} phase={phase} />

        {/* Sparkles → big check */}
        {(phase === "check" || phase === "out") && (
          <div className="absolute inset-0">
            <CheckSparkles />
            <motion.div
              className="finale-done absolute inset-x-0 bottom-[14%] px-6 text-center text-white"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.6 }}
            >
              <p>{email ? "¡Propuesta enviada!" : "¡Reunión agendada!"}</p>
              <p className="mt-2 text-base font-normal tracking-normal text-white/75 md:text-lg">
                {email ? `Revisa ${delivery.to}` : formatWhen(delivery.datetime)}
              </p>
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Where the wires meet: just under the hub, where the summary card lands. */
const HUB = { x: 50, y: 58 };
/** Scattered slots around the hub (% of the stage), clear of the captions, sources and the voice dock. */
const SLOTS = [
  { x: 15, y: 40, r: -4 },
  { x: 85, y: 41, r: 3 },
  { x: 9, y: 62, r: 2 },
  { x: 91, y: 63, r: -3 },
  { x: 23, y: 81, r: 4 },
  { x: 77, y: 80, r: -2 },
  { x: 34, y: 66, r: -2 },
  { x: 66, y: 67, r: 3 },
];

/**
 * Send finale, chapter 2→3: the related products / people / skills burst out of the hub and
 * scatter around the screen, each wired back to one point; then everything shoots into
 * that point and the single summary card (the intro's .j-focus) takes over.
 */
function ScatterCards({ cards, phase }: { cards: JCard[]; phase: Phase }) {
  const shown = cards.slice(0, SLOTS.length);
  const out = phase === "community";
  const converge = phase === "focus";
  if (!out && !converge) return null;

  return (
    <div className="pointer-events-none absolute inset-0 text-white" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wire" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#bfe3ff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>
        </defs>
        {shown.map((_, i) => {
          const s = SLOTS[i]!;
          const cx = (s.x + HUB.x) / 2 + (s.y > HUB.y ? 6 : -6);
          const cy = (s.y + HUB.y) / 2 - 8;
          return (
            <motion.path
              key={i}
              d={`M ${s.x} ${s.y} Q ${cx} ${cy} ${HUB.x} ${HUB.y}`}
              fill="none"
              stroke="url(#wire)"
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
              style={{ filter: "drop-shadow(0 0 4px rgb(140 200 255 / 0.9))" }}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={converge ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 0.85 }}
              transition={converge ? { duration: 0.5, ease: "easeIn" } : { delay: 0.9 + i * 0.18, duration: 0.7, ease: "easeOut" }}
            />
          );
        })}
      </svg>

      {/* The single point every wire feeds: pulses while cards connect, flares as they shoot in. */}
      <motion.span
        className="absolute size-5 rounded-full bg-white"
        style={{ left: `${HUB.x}%`, top: `${HUB.y}%`, translate: "-50% -50%", boxShadow: "0 0 30px 12px rgb(140 200 255 / 0.85)" }}
        initial={{ scale: 0, opacity: 0 }}
        animate={converge ? { scale: [1, 6, 0], opacity: [1, 0.9, 0] } : { scale: [0.8, 1.25, 0.8], opacity: 1 }}
        transition={converge ? { duration: 0.9, ease: "easeOut" } : { duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />

      {shown.map((c, i) => {
        const s = SLOTS[i]!;
        return (
          // Outer: slot + gentle float. Inner: burst out of the hub, then shoot back into it.
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${s.x}%`, top: `${s.y}%`, translate: "-50% -50%" }}
            animate={converge ? { y: 0 } : { y: [0, -8, 0] }}
            transition={converge ? { duration: 0.2 } : { delay: 1 + i * 0.18, duration: 3 + (i % 3) * 0.6, repeat: Infinity, ease: "easeInOut" }}
          >
          <motion.div
            className="j-card relative w-[min(210px,40vw)] rounded-[18px] p-3.5 text-left"
            initial={{ x: `${(HUB.x - s.x) * 0.9}vw`, y: `${(HUB.y - s.y) * 0.9}vh`, scale: 0.3, opacity: 0, rotate: 0 }}
            animate={
              converge
                ? { x: `${HUB.x - s.x}vw`, y: `${HUB.y - s.y}vh`, scale: 0.15, opacity: 0, rotate: 0 }
                : { x: 0, y: 0, scale: 1, opacity: 1, rotate: s.r }
            }
            transition={
              converge
                ? { duration: 0.55, delay: i * 0.04, ease: [0.6, 0, 0.9, 0.4] }
                : { delay: 0.15 + i * 0.18, type: "spring", stiffness: 90, damping: 16, opacity: { delay: 0.15 + i * 0.18, duration: 0.3 } }
            }
          >
            <CardBody c={c} />
          </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** three.js: sparkles swirl in and converge into a big check mark + ring; crisp SVG check on top. */
function CheckSparkles() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [reduce] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (reduce) return;
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    void import("three").then((THREE) => {
      if (disposed) return;
      // Never a 0×0 box (would give a NaN aspect → NaN positions): fall back to the viewport.
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      mount.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const aspect = w / h;
      const camera = new THREE.OrthographicCamera(-aspect * 2, aspect * 2, 2, -2, 0.1, 10);
      camera.position.z = 5;

      // Targets: check stroke (two segments, thick) + ring around it.
      const N = 2200;
      const start = new Float32Array(N * 3);
      const target = new Float32Array(N * 3);
      const delay = new Float32Array(N);
      const A = new THREE.Vector2(-0.62, 0.02);
      const B = new THREE.Vector2(-0.16, -0.46);
      const C = new THREE.Vector2(0.7, 0.52);
      for (let i = 0; i < N; i += 1) {
        let x: number;
        let y: number;
        if (i < N * 0.62) {
          // check: first leg ~35%, second leg ~65%
          const t = Math.random();
          const [p, q] = t < 0.35 ? [A, B] : [B, C];
          const u = t < 0.35 ? t / 0.35 : (t - 0.35) / 0.65;
          x = p.x + (q.x - p.x) * u + (Math.random() - 0.5) * 0.09;
          y = p.y + (q.y - p.y) * u + (Math.random() - 0.5) * 0.09;
        } else {
          const a = Math.random() * Math.PI * 2;
          const r = 1.15 + (Math.random() - 0.5) * 0.05;
          x = Math.cos(a) * r;
          y = Math.sin(a) * r;
        }
        target.set([x, y, 0], i * 3);
        const a = Math.random() * Math.PI * 2;
        const r = 2.2 + Math.random() * 2.6;
        start.set([Math.cos(a) * r * aspect, Math.sin(a) * r, 0], i * 3);
        delay[i] = Math.random() * 0.35;
      }
      const geometry = new THREE.BufferGeometry();
      const pos = new Float32Array(start);
      geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const colors = new Float32Array(N * 3);
      const blue = new THREE.Color("#2f6bff");
      const cyan = new THREE.Color("#45d4f5");
      const white = new THREE.Color("#ffffff");
      for (let i = 0; i < N; i += 1) {
        const c = Math.random() < 0.45 ? white : blue.clone().lerp(cyan, 0.4 + Math.random() * 0.6);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        size: 3.2 * renderer.getPixelRatio(),
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(geometry, material);
      scene.add(points);

      const t0 = performance.now();
      const DURATION = 1.7;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const tick = (now: number) => {
        const t = (now - t0) / 1000;
        for (let i = 0; i < N; i += 1) {
          const k = ease(Math.min(1, Math.max(0, (t - delay[i]!) / DURATION)));
          // swirl while travelling, settle on the target
          const swirl = (1 - k) * 2.4;
          const sx = start[i * 3]!;
          const sy = start[i * 3 + 1]!;
          const rx = sx * Math.cos(swirl) - sy * Math.sin(swirl);
          const ry = sx * Math.sin(swirl) + sy * Math.cos(swirl);
          pos[i * 3] = rx + (target[i * 3]! - rx) * k;
          pos[i * 3 + 1] = ry + (target[i * 3 + 1]! - ry) * k;
        }
        geometry.attributes.position!.needsUpdate = true;
        // settled: gentle breathing twinkle
        material.opacity = t > DURATION + 0.4 ? 0.75 + Math.sin(t * 5) * 0.2 : 0.95;
        points.rotation.z = t > DURATION ? Math.sin(t * 1.4) * 0.015 : 0;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [reduce]);

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />
      {/* Crisp check strokes in once the sparkles have landed */}
      <svg className="finale-check absolute left-1/2 top-1/2" viewBox="-1.3 -1.3 2.6 2.6" aria-hidden="true">
        <motion.path
          d="M -0.62 -0.02 L -0.16 0.46 L 0.7 -0.52"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: reduce ? 0 : 1.6, duration: 0.55, ease: "easeOut" }}
        />
      </svg>
    </div>
  );
}

/** How long the goodbye lines stay under the avatar (page.tsx clears `closing` after this). */
export const FAREWELL_MS = 16000;
const FAREWELL_STEP_MS = FAREWELL_MS / 4;

/** Goodbye lines under the avatar (back in the centre) while the voice closes the session. */
export function FinaleCaption({ delivery }: { delivery?: Delivery | null }) {
  const { clientName, intake } = useConcierge();
  const name = intake.name.split(" ")[0];
  const lines = useMemo(
    () => [
      {
        title: delivery?.kind === "meeting" ? "¡Reunión lista!" : "¡Tu propuesta va en camino!",
        sub: name ? `Gracias, ${name}. Fue un gusto preparar esto contigo.` : "Gracias por construir esto con nosotros.",
      },
      {
        title: clientName ? `Mucha suerte con ${clientName}` : "Mucha suerte en tu próxima venta",
        sub: "Llegas con preguntas claras y valor concreto. Cada conversación es una oportunidad.",
      },
      { title: "Sigue construyendo con la comunidad", sub: "Proyectos, talento y aliados listos para acompañarte." },
      { title: "¡Gracias, Google DevFest Medellín 2026!", sub: "Nos vemos en la próxima. Ve por ese sí." },
    ],
    [delivery?.kind, clientName, name],
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => Math.min(n + 1, lines.length - 1)), FAREWELL_STEP_MS);
    return () => window.clearInterval(id);
  }, [lines.length]);
  const line = lines[i]!;

  return (
    <motion.div
      className="finale-caption pointer-events-none absolute inset-x-0 bottom-36 z-20 mx-auto max-w-xl px-6 text-center md:bottom-40"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.6 }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xl tracking-[-0.02em] md:text-2xl">{line.title}</p>
          <p className="mt-2 text-sm text-muted md:text-base">{line.sub}</p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
