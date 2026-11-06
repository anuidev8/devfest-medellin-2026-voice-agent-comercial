"use client";

import { UseAgentUpdate, useAgent, useRenderActivityMessage } from "@copilotkit/react-core/v2";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { StreamHeading } from "./MasonryCard";
import { spokenIndex, useAgentSpeech } from "./spoken";
import { subscribeDecision } from "./voiceDecision";

type ActivityMsg = {
  id: string;
  role?: string;
  activityType?: string;
  content?: { a2ui_operations?: Array<Record<string, unknown>> } | unknown;
};

export type SurfaceKind = "community" | "plan" | "product";

/** Surface ids set by the agent bridge (packages/agent: a2ui-community.ts / a2ui-plan.ts). */
const kindOf = (m: ActivityMsg): SurfaceKind =>
  m.id.endsWith("community-match") ? "community" : m.id.endsWith("product-plan") ? "product" : "plan";

/** Is the streamed CommunityBoard still building? (last updateComponents → root props.status) */
export function communityBuilding(m: ActivityMsg) {
  const ops = (m.content as { a2ui_operations?: Array<Record<string, unknown>> } | undefined)?.a2ui_operations ?? [];
  const upd = ops.findLast((o) => o.updateComponents) as
    | { updateComponents?: { components?: Array<{ status?: string }> } }
    | undefined;
  return upd?.updateComponents?.components?.[0]?.status === "building";
}

/** A2UI surfaces from AG-UI activity messages, grouped by kind. */
export function useA2uiSurfaces() {
  const { agent } = useAgent({ agentId: "default", updates: [UseAgentUpdate.OnMessagesChanged] });
  return useMemo(() => {
    const all = ((agent.messages ?? []) as ActivityMsg[]).filter((m) => m.activityType === "a2ui-surface");
    return {
      community: all.filter((m) => kindOf(m) === "community"),
      plan: all.filter((m) => kindOf(m) === "plan"),
      product: all.filter((m) => kindOf(m) === "product"),
    };
  }, [agent.messages]);
}

/**
 * Stage A2UI: every card here is rendered by CopilotKit's A2UI renderer (catalog in a2ui/catalog.tsx):
 * - community-match → catalog `CommunityBoard` (streams card-by-card)
 * - seller-recommend → plan + approve (basic catalog; buttons send the A2UI action back to the agent)
 */
export function StageA2UI({ layout = "stack", only }: { layout?: "stack" | "rail"; only?: SurfaceKind }) {
  const { renderActivityMessage } = useRenderActivityMessage();
  const surfaces = useA2uiSurfaces();
  const rail = layout === "rail";

  const show = (k: SurfaceKind) => !only || only === k;
  const list = [
    ...(show("community") ? surfaces.community.slice(-1) : []),
    ...(show("plan") ? surfaces.plan.slice(-1) : []),
    ...(show("product") ? surfaces.product.slice(-1) : []),
  ];
  if (!list.length) return null;

  return (
    <div className="grid gap-10" aria-label="Resultados generativos">
      {list.map((message) => {
        const node = renderActivityMessage(message as never);
        if (!node) return null;
        const kind = kindOf(message);
        const title = kind === "community" ? "Apoyo de la comunidad" : kind === "product" ? "Plan de producto" : "Tu plan de venta";
        const building = kind === "community" && communityBuilding(message);
        return (
          <section key={message.id} className={rail ? "grid gap-8" : "rise-floor grid gap-3"}>
            {rail ? (
              <StreamHeading title={title} status={building ? "Armando resultados…" : undefined} />
            ) : (
              <header className="title-tile flex items-center justify-between gap-3 px-5 py-4">
                <h2 className="text-lg leading-tight">{title}</h2>
                <span className={`dot ${building ? "animate-pulse bg-signal" : "bg-good"}`} aria-hidden="true" />
              </header>
            )}
            {kind === "community" ? (
              node
            ) : (
              <SpokenSurface
                kind={kind}
                initial={{ opacity: 0, y: 32, scale: 0.98, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className={rail ? "plan-surface" : "overflow-hidden rounded-[24px] border border-line bg-white p-2 text-[#0b0f1a]"}
              >
                {node}
              </SpokenSurface>
            )}
          </section>
        );
      })}
    </div>
  );
}

type ChatMsg = ActivityMsg & { content?: unknown; toolCalls?: { function: { name: string } }[] };
const msgText = (c: unknown) =>
  typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (p && typeof p === "object" && "text" in p ? String(p.text) : "")).join("") : "";

/**
 * Was the latest plan surface of this kind already approved? True once an approval
 * ("Apruebo el plan…" from the A2UI button, the voice or chat, or confirm_plan) comes after it.
 */
export function usePlanApproved(kind: "plan" | "product") {
  const { agent } = useAgent({ agentId: "default", updates: [UseAgentUpdate.OnMessagesChanged] });
  return useMemo(() => {
    const msgs = (agent.messages ?? []) as ChatMsg[];
    const surfaceAt = msgs.findLastIndex((m) => m.activityType === "a2ui-surface" && kindOf(m) === kind);
    if (surfaceAt < 0) return false;
    return msgs.slice(surfaceAt + 1).some((m) => {
      const t = m.role === "user" ? msgText(m.content).trim().toLowerCase() : "";
      if (t.startsWith("apruebo el plan")) return kind === "product" ? t.startsWith("apruebo el plan de producto") : !t.startsWith("apruebo el plan de producto");
      return false;
    });
  }, [agent.messages, kind]);
}

/** True when Stage has generative surfaces (skip empty placeholder). */
export function useHasStageSurfaces() {
  const { community, plan, product } = useA2uiSurfaces();
  return community.length + plan.length + product.length > 0;
}

/**
 * Wrapper for the A2UI plan surface (rendered by CopilotKit, so we can't pass props in).
 * Marks the text block she is reading aloud — e.g. each template question — with
 * `data-spoken` (styled in globals.css) and keeps it in view.
 */
function SpokenSurface({ kind, children, ...props }: React.ComponentProps<typeof motion.div> & { kind: SurfaceKind }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { text } = useAgentSpeech();
  const approved = usePlanApproved(kind === "product" ? "product" : "plan");

  // Approved: the approve / reject row is done — never ask to approve again.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).filter((b) =>
      /aprobar|rechazar/i.test(b.textContent ?? ""),
    );
    const rows = new Set(buttons.map((b) => b.parentElement ?? b));
    rows.forEach((row) => {
      row.style.display = approved ? "none" : "";
    });
  });

  // Voice approve / reject: light up this surface's A2UI button, then press it.
  useEffect(() => {
    const timers: number[] = [];
    const unsubscribe = subscribeDecision((d) => {
      if ((d.which === "product") !== (kind === "product")) return;
      const root = ref.current;
      const button = Array.from(root?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((b) =>
        (b.textContent ?? "").toLowerCase().includes(d.approved ? "aprobar" : "rechazar"),
      );
      if (!button) return;
      button.scrollIntoView({ block: "center", behavior: "smooth" });
      timers.push(window.setTimeout(() => button.setAttribute("data-voice-press", "1"), 350));
      timers.push(
        window.setTimeout(() => {
          button.click();
          d.resolve(true);
        }, 1500),
      );
      timers.push(window.setTimeout(() => button.removeAttribute("data-voice-press"), 2600));
    });
    return () => {
      unsubscribe();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [kind]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("[data-spoken]").forEach((el) => el.removeAttribute("data-spoken"));
    if (!text) return;
    // Leaf text blocks of the surface (questions, why-lines, projects, people…).
    const blocks = Array.from(root.querySelectorAll<HTMLElement>("p, span, h1, h2, h3, h4, h5, li")).filter(
      (el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 12,
    );
    const i = spokenIndex(text, blocks.map((el) => el.textContent ?? ""));
    const hit = blocks[i];
    if (!hit) return;
    hit.setAttribute("data-spoken", "1");
    hit.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [text]);

  return (
    <motion.div ref={ref} {...props}>
      {children as React.ReactNode}
      {approved && (
        <p className="mx-4 mb-4 mt-2 flex items-center gap-2 text-sm font-medium text-good" role="status">
          <span className="dot bg-good" aria-hidden="true" /> {kind === "product" ? "Plan de producto aprobado" : "Plan aprobado"}
        </p>
      )}
    </motion.div>
  );
}
