"use client";

import { AnimatePresence, motion } from "motion/react";
import { UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConcierge } from "./concierge";
import { Icon } from "./Icon";
import { IntakeForm } from "./IntakeForm";
import { Stage, stepOfTool, type RailStep } from "./Stage";
import { communityBuilding, useA2uiSurfaces } from "./StageA2UI";
import { subscribeDecision } from "./voiceDecision";

type Step = "context" | RailStep;

const STEPS: { id: Step; label: string }[] = [
  { id: "context", label: "Contexto" },
  { id: "summary", label: "Resumen" },
  { id: "community", label: "Comunidad" },
  { id: "plan", label: "Plan" },
  { id: "product", label: "Producto" },
  { id: "followup", label: "Cierre" },
];

/** Minimum time a finished step stays on screen before the board moves on (ms). */
const STEP_DWELL_MS: Record<Step, number> = {
  context: 1500,
  summary: 7000,
  community: 9000,
  plan: 12000, // only matters when the product plan follows ("ambos")
  product: 0,
  followup: 0,
};

// Approval / send / booking never open a step: after approval the board stays on the plan,
// and the send finale (full screen) takes over — no "Cierre" cards flashing before it.
const HIDDEN_TOOLS = new Set([
  "open_calendar",
  "save_meeting_fact",
  "approve_plan",
  "assess_context",
  "confirm_plan",
  "send_plan_email",
  "book_meeting",
]);

type RailMsg = {
  id: string;
  activityType?: string;
  toolCalls?: { id: string; function: { name: string } }[];
};

/**
 * The newest thing the agent did, in message order: a tool call (→ its step) or a community
 * board landing (→ community). Plan surfaces are covered by their tool call.
 */
function newestEvent(msgs: RailMsg[]): { key: string; step: Step } | null {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]!;
    if (m.activityType === "a2ui-surface") {
      if (m.id.endsWith("community-match")) return { key: m.id, step: "community" };
      continue;
    }
    const call = (m.toolCalls ?? []).findLast((c) => !HIDDEN_TOOLS.has(c.function.name) && c.function.name !== "match_community");
    if (call) return { key: call.id, step: stepOfTool(call.function.name) };
  }
  return null;
}

/**
 * Right board (Shopping Console layout). One step at a time: the board follows the
 * flow (contexto → resumen → comunidad → plan → cierre) and hides earlier steps;
 * the step bar lets you look back. Approval is the A2UI plan surface (AG-UI) only.
 */
export function ContextRail({
  open,
  onClose,
  voiceLive = false,
}: {
  open: boolean;
  onClose: () => void;
  voiceLive?: boolean;
}) {
  const { items, running, brainError, discovery, deal } = useConcierge();

  const surfaces = useA2uiSurfaces();
  const hasPlanSurface = surfaces.plan.length > 0;
  const hasCommunityBoard = surfaces.community.length > 0;
  const hasPlaybook = !!discovery || !!deal;

  const available = useMemo(() => {
    const has = new Set<Step>(["context"]);
    for (const i of items) {
      // Community shows only when its board arrives (asked for on its own); inside a plan run
      // the matches are just the plan's support.
      if (HIDDEN_TOOLS.has(i.name) || i.name === "match_community") continue;
      has.add(stepOfTool(i.name));
    }
    if (hasPlaybook) has.add("summary");
    if (hasCommunityBoard) has.add("community");
    if (hasPlanSurface) has.add("plan");
    if (surfaces.product.length) has.add("product");
    return STEPS.filter((s) => has.has(s.id));
  }, [items, hasPlaybook, hasCommunityBoard, hasPlanSurface, surfaces.product.length]);

  // The board follows the NEWEST thing the agent did, not the furthest step: asking for
  // community / product cards from the Plan view must bring the community cards back.
  const { agent } = useAgent({ agentId: "default", updates: [UseAgentUpdate.OnMessagesChanged] });
  const newest = useMemo(() => newestEvent(agent.messages as unknown as RailMsg[]), [agent.messages]);
  const latest: Step = newest?.step ?? (hasPlaybook ? "summary" : "context");
  const latestKey = newest?.key ?? latest;
  const [view, setView] = useState<Step>(latest);
  const [paused, setPaused] = useState(false); // user picked a step by hand
  const current = available.some((s) => s.id === view) ? view : latest;

  // A step is "ready" once its card has fully landed (dwell starts counting from there).
  const lastCommunity = surfaces.community.at(-1);
  const ready: Record<Step, boolean> = {
    context: true,
    summary: !items.some((i) => i.name === "summarize_context" && !i.done),
    community: !!lastCommunity && !communityBuilding(lastCommunity),
    plan: hasPlanSurface,
    product: surfaces.product.length > 0,
    followup: true,
  };
  const currentReady = ready[current] || !running; // never get stuck once the run ended

  // Follow the flow ONE step at a time: the agent often calls match_community and
  // build_strategy_plan in the same turn, so without a dwell the board would jump
  // straight to Plan and the community cards would never be seen.
  const readySince = useRef<number | null>(null);
  useEffect(() => {
    readySince.current = currentReady ? Date.now() : null;
  }, [current, currentReady]);

  const latestRef = useRef(latestKey);
  useEffect(() => {
    if (latestRef.current === latestKey) return;
    latestRef.current = latestKey;
    const id = window.setTimeout(() => {
      setPaused(false); // new result landed → resume following
      // An earlier step got new results (e.g. product / community cards asked from the Plan): go straight there.
      const at = (s: Step) => STEPS.findIndex((x) => x.id === s);
      setView((v) => (at(latest) < at(v) ? latest : v));
    }, 0);
    return () => window.clearTimeout(id);
  }, [latestKey, latest]);

  useEffect(() => {
    if (paused || current === latest || !currentReady) return;
    const idx = available.findIndex((s) => s.id === current);
    const target = available.findIndex((s) => s.id === latest);
    if (target < idx) return; // handled above (jump back)
    // Walk forward one step at a time (plan → product for "ambos"), but never stop on an old community board.
    const next = available.slice(idx + 1).find((s) => s.id !== "community" || s.id === latest)?.id;
    if (!next) return;
    const shownFor = readySince.current ? Date.now() - readySince.current : 0;
    const id = window.setTimeout(() => setView(next), Math.max(0, STEP_DWELL_MS[current] - shownFor));
    return () => window.clearTimeout(id);
  }, [paused, current, latest, currentReady, available]);

  // Voice approve / reject: show that plan's step so its button can be pressed on screen.
  useEffect(
    () =>
      subscribeDecision((d) => {
        setView(d.which === "product" ? "product" : "plan");
        setPaused(true);
      }),
    [],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [current]);

  return (
    <aside
      aria-label="Contexto en vivo"
      aria-hidden={!open}
      data-open={open ? "1" : "0"}
      className={`context-rail absolute inset-x-0 bottom-0 z-30 flex max-h-[68vh] flex-col transition-[transform,opacity] duration-[900ms] ease-[var(--ease-out-soft)] md:max-h-none lg:top-16 lg:bottom-0 lg:delay-150 lg:right-0 lg:max-w-none ${
        open
          ? "translate-y-0 opacity-100 lg:translate-x-0"
          : "pointer-events-none translate-y-full opacity-0 lg:translate-y-0 lg:translate-x-[calc(100%+1.5rem)]"
      }`}
    >
      <div className="context-rail-sheet flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[32px] border-t border-line/60 bg-transparent lg:rounded-none lg:border-t-0">
        <header className="flex flex-none items-center justify-between gap-3 px-5 pb-1 pt-4 md:px-10 md:pt-4">
          <nav aria-label="Pasos" className="rail-steps">
            {available.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setView(s.id);
                  setPaused(s.id !== latest);
                }}
                aria-current={current === s.id ? "step" : undefined}
                className="rail-step"
              >
                {s.id === latest && s.id !== current && <span className="dot animate-pulse bg-signal" aria-hidden="true" />}
                {s.label}
              </button>
            ))}
          </nav>
          <button type="button" onClick={onClose} className="cbtn cbtn-sm" aria-label="Cerrar panel">
            <Icon name="close" size={18} />
          </button>
        </header>

        {brainError && (
          <div role="alert" className="mx-5 mt-2 flex items-start gap-3 rounded-2xl border border-[color:var(--signal)]/40 bg-raise px-4 py-3 text-sm md:mx-10">
            <span className="dot mt-1.5 flex-none bg-signal" aria-hidden="true" />
            <p className="min-w-0">
              <span className="font-medium">No se pudieron preparar los resultados.</span>{" "}
              <span className="text-muted">{brainError}</span>
            </p>
          </div>
        )}

        <div
          ref={scrollRef}
          className="rail-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-10 pt-4 md:px-10 md:pb-16"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={current}
              initial={{ opacity: 0, x: 40, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -40, filter: "blur(6px)" }}
              transition={{ type: "spring", stiffness: 160, damping: 24 }}
              aria-label={STEPS.find((s) => s.id === current)?.label}
            >
              {current === "context" && <IntakeForm variant="rail" voiceLive={voiceLive} />}
              {current !== "context" && <Stage layout="rail" step={current} />}
            </motion.section>
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
