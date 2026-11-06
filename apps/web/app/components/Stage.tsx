"use client";

import { useMemo } from "react";
import { useConcierge, type StageItem } from "./concierge";
import { MatchCards, SummaryCard, type CommunityMatch, type ContextSummary } from "./CommunityCards";
import { BriefSummary, DiscoveryBoard } from "./IntakeForm";
import { LottieState, type LottieKind } from "./LottieState";
import { MasonrySkeletonBoard, StreamHeading } from "./MasonryCard";
import { ToolCallSlot } from "./ToolCallSlot";
import { StageA2UI, useA2uiSurfaces, useHasStageSurfaces } from "./StageA2UI";

const TOOL_LABEL: Record<string, string> = {
  show_discovery_guide: "Guía de descubrimiento",
  save_meeting_fact: "Dato guardado",
  summarize_context: "Resumen de tus retos",
  match_community: "Apoyo de la comunidad",
  build_strategy_plan: "Recomendación para vender",
  build_product_plan: "Plan de producto",
  send_plan_email: "Envío del plan",
  confirm_plan: "Plan confirmado",
  book_meeting: "Reunión (simulada)",
  open_calendar: "Calendario",
};

const PENDING: Record<string, { kind: LottieKind; text: string }> = {
  match_community: { kind: "search", text: "Buscando en la comunidad…" },
  summarize_context: { kind: "think", text: "Resumiendo tus retos…" },
  build_strategy_plan: { kind: "build", text: "Armando la recomendación…" },
  build_product_plan: { kind: "build", text: "Armando el plan de producto…" },
  send_plan_email: { kind: "think", text: "Enviando…" },
  confirm_plan: { kind: "think", text: "Confirmando…" },
  book_meeting: { kind: "think", text: "Reservando…" },
};

const HIDDEN = new Set([
  "open_calendar",
  "save_meeting_fact",
  "approve_plan",
  "build_strategy_plan",
  "build_product_plan",
  "match_community",
  "assess_context",
]);

const labelFor = (name: string) => TOOL_LABEL[name] ?? name.replace(/_/g, " ");

/**
 * When a strategy plan exists, fold community matches into the A2UI recommend
 * surface — do not also paint a fixed plan card or a separate match list.
 *
 * `layout="rail"` = flat sections for the right ContextRail (no title-tile chrome).
 */
export type RailStep = "summary" | "community" | "plan" | "product" | "followup";

const STEP_OF: Record<string, RailStep> = {
  show_discovery_guide: "summary",
  summarize_context: "summary",
  match_community: "community",
  build_strategy_plan: "plan",
  build_product_plan: "product",
};
export const stepOfTool = (name: string): RailStep => STEP_OF[name] ?? "followup";

export function Stage({ layout = "stack", step }: { layout?: "stack" | "rail"; step?: RailStep }) {
  const { items, running } = useConcierge();
  const hasSurfaces = useHasStageSurfaces();
  const surfaces = useA2uiSurfaces();
  const rail = layout === "rail";

  const planBuilding = items.some((i) => i.name === "build_strategy_plan" && !i.done);
  const matchBuilding = items.some((i) => i.name === "match_community" && !i.done);

  const visible = useMemo(
    () => items.filter((i) => !HIDDEN.has(i.name) && (!step || stepOfTool(i.name) === step)),
    [items, step],
  );

  if (rail && step === "summary") return <SummaryStep />;

  if (rail && step === "product") {
    const building = items.some((i) => i.name === "build_product_plan" && !i.done);
    const done = items.some((i) => i.name === "build_product_plan" && i.done);
    const waiting = building || (done && !surfaces.product.length && running);
    return (
      <div className="grid gap-16" aria-live="polite">
        {waiting ? (
          <section className="grid gap-8">
            <StreamHeading title="Plan de producto" status="Armando el plan de producto…" />
            <MasonrySkeletonBoard count={3} label="Armando el plan de producto" />
          </section>
        ) : (
          <StageA2UI layout={layout} only="product" />
        )}
      </div>
    );
  }

  const matchDone = items.some((i) => i.name === "match_community" && i.done);
  // Surfaces are emitted at the end of the run: keep skeletons until they land.
  const communityWaiting = matchBuilding || (matchDone && !surfaces.community.length && running);
  const planWaiting = planBuilding || (items.some((i) => i.name === "build_strategy_plan" && i.done) && !surfaces.plan.length && running);
  const pendingA2ui = step ? (step === "plan" && planWaiting) || (step === "community" && communityWaiting) : planBuilding || matchBuilding;
  const a2uiOnly = step === "community" || step === "plan" ? step : undefined;
  const showA2ui = !step || !!a2uiOnly;

  const planPending = step ? step === "plan" : planBuilding;
  const pendingBlock = pendingA2ui ? (
    <section className={rail ? "grid gap-8" : "rise-floor grid gap-3"}>
      {rail ? (
        <StreamHeading
          title={planPending ? "Tu plan de venta" : "Apoyo de la comunidad"}
          status={planPending ? "Armando la recomendación…" : "Buscando en la comunidad…"}
        />
      ) : (
        <header className="title-tile flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-lg leading-tight">{planPending ? "Recomendación para vender" : "Apoyo de la comunidad"}</h2>
          <span className="dot animate-pulse bg-signal" aria-label="En curso" />
        </header>
      )}
      {rail ? (
        <MasonrySkeletonBoard count={planPending ? 3 : 5} label={planPending ? "Armando la recomendación" : "Buscando en la comunidad"} />
      ) : (
        <LottieState
          kind={planPending ? "build" : "search"}
          size={64}
          label={planPending ? "Armando la recomendación…" : "Buscando en la comunidad…"}
        />
      )}
    </section>
  ) : null;

  if (!visible.length)
    return (
      <div className="grid gap-8" aria-live="polite">
        {showA2ui && <StageA2UI layout={layout} only={a2uiOnly} />}
        {pendingBlock}
        {!step && !pendingA2ui && !hasSurfaces ? (
          rail ? (
            <p className="max-w-[36ch] text-sm text-muted">
              {running ? "El agente está trabajando…" : "El resumen y la recomendación aparecen mientras hablas."}
            </p>
          ) : (
            <div className="title-tile grid place-items-center gap-2 px-6 py-10 text-center">
              {running ? <LottieState kind="think" size={64} /> : null}
              <p className="text-xl tracking-[-0.02em]">{running ? "El agente está trabajando" : "Aquí aparecen los resultados"}</p>
              <p className="mx-auto max-w-[36ch] text-sm text-muted">El resumen, la recomendación y la comunidad aparecen mientras hablas.</p>
            </div>
          )
        ) : null}
      </div>
    );

  return (
    <div className={rail ? "grid gap-16" : "grid gap-8"} aria-live="polite">
      {showA2ui && <StageA2UI layout={layout} only={a2uiOnly} />}
      {pendingBlock}

      {visible.map((item, i) => (
        <section
          key={item.id}
          className={`grid ${rail ? "gap-8" : "gap-3"} transition-[opacity,transform] duration-[900ms] ease-[var(--ease-out-soft)] ${
            rail ? "" : "rise-floor"
          } ${i > 0 && !rail ? "origin-top scale-[0.98] opacity-60 hover:scale-100 hover:opacity-100" : ""}`}
        >
          {rail ? (
            <StreamHeading title={labelFor(item.name)} status={item.done ? undefined : PENDING[item.name]?.text ?? "Preparando…"} />
          ) : (
            <header className="title-tile flex items-center justify-between gap-3 px-5 py-4">
              <h2 className="text-lg leading-tight">{labelFor(item.name)}</h2>
              <span className={`dot ${item.done ? "bg-good" : "animate-pulse bg-signal"}`} aria-label={item.done ? "Listo" : "En curso"} />
            </header>
          )}
          {item.done ? (
            <StageCard item={item} rail={rail} />
          ) : rail ? (
            <MasonrySkeletonBoard count={item.name === "summarize_context" ? 4 : 3} label={PENDING[item.name]?.text ?? "Preparando…"} />
          ) : (
            <LottieState kind={PENDING[item.name]?.kind ?? "think"} size={64} label={PENDING[item.name]?.text ?? "Preparando…"} />
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * Resumen step: the challenges summary, the Deal Brief and the discovery playbook questions
 * together. While discovery is still running the questions lead; once there is a summary it leads.
 */
function SummaryStep() {
  const { items, discovery, deal } = useConcierge();
  const summarizing = items.some((i) => i.name === "summarize_context" && !i.done);
  const hasSummary = items.some((i) => i.name === "summarize_context");

  const summary = hasSummary ? (
    <section key="summary" className="grid gap-8">
      <StreamHeading title="Resumen de tus retos" status={summarizing ? "Resumiendo tus retos…" : undefined} />
      <ToolCallSlot name="summarize_context" />
    </section>
  ) : null;
  const brief = deal ? (
    <BriefSummary key="brief" summary={deal.summary} route={deal.fit.route} reasons={deal.fit.reasons} evidence={deal.evidence} rail />
  ) : null;
  // CopilotKit tool render (show_discovery_guide); the voice RPC playbook is the fallback.
  const playbook = (
    <div key="playbook" className="empty:hidden">
      <ToolCallSlot name="show_discovery_guide" fallback={discovery ? <DiscoveryBoard questions={discovery.questions} /> : null} />
    </div>
  );

  return (
    <div className="grid gap-14" aria-live="polite">
      {hasSummary || deal ? [summary, brief, playbook] : [playbook, summary, brief]}
    </div>
  );
}

function StageCard({ item, rail }: { item: StageItem; rail?: boolean }) {
  switch (item.name) {
    case "match_community":
      return <MatchCards data={item.result as CommunityMatch | null} layout={rail ? "mosaic" : "stack"} />;
    case "summarize_context":
      return <SummaryCard data={item.result as ContextSummary | null} flat={rail} />;
    case "book_meeting":
      return <BookedCard result={item.result as Booked | null} />;
    default:
      return <GenericCard result={item.result} />;
  }
}

type Booked = { status?: string; name?: string; email?: string; datetime?: string };

function BookedCard({ result }: { result: Booked | null }) {
  if (!result) return null;
  const [day, ...rest] = String(result.datetime ?? "").split(" ");
  return (
    <div className="tile flex flex-wrap items-center gap-4 p-5">
      <div className="w-16 flex-none overflow-hidden rounded-2xl bg-raise text-center">
        <span className="block bg-good py-0.5 text-[11px] font-bold tracking-[0.08em] text-[#05210f] uppercase">{day?.slice(0, 3) || "Cita"}</span>
        <LottieState kind="done" size={56} className="py-1" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-good">Reserva simulada</p>
        <p className="mt-1.5 text-2xl tracking-[-0.02em]">{result.datetime ?? [day, ...rest].join(" ")}</p>
        <p className="truncate text-sm text-muted">
          {result.name} · {result.email}
        </p>
      </div>
    </div>
  );
}

function GenericCard({ result }: { result: unknown }) {
  if (result == null) return null;
  if (typeof result !== "object") return <p className="tile p-4 text-sm">{String(result)}</p>;

  const entries = Object.entries(result as Record<string, unknown>);
  const scalars = entries.filter(([, v]) => v != null && typeof v !== "object");
  const lists = entries.filter(([, v]) => Array.isArray(v) && v.length) as [string, unknown[]][];

  return (
    <div className="tile grid gap-4 p-5">
      {!!scalars.length && (
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-3">
          {scalars.slice(0, 8).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="eyebrow">{k.replace(/([A-Z])/g, " $1")}</dt>
              <dd className="mt-1 break-words">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {lists.slice(0, 3).map(([k, list]) => (
        <div key={k} className="grid gap-2">
          <p className="eyebrow">{k.replace(/([A-Z])/g, " $1")}</p>
          <ul className="grid gap-2">
            {list.slice(0, 6).map((entry, i) => (
              <li key={i} className="rounded-2xl bg-raise px-4 py-3 text-sm">
                {summarize(entry)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function summarize(entry: unknown) {
  if (entry == null || typeof entry !== "object") return String(entry);
  const o = entry as Record<string, unknown>;
  const title = o.name ?? o.title ?? o.label ?? o.id;
  const detail = o.description ?? o.reason ?? o.summary ?? o.role ?? o.date;
  return (
    <>
      <span className="font-medium">{String(title ?? "—")}</span>
      {detail != null && <span className="block text-xs text-muted">{String(detail)}</span>}
    </>
  );
}

