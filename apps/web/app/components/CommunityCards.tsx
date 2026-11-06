"use client";

import { useRenderTool } from "@copilotkit/react-core/v2";
import { LottieState } from "./LottieState";
import { DiscoveryBoard } from "./IntakeForm";
import { MasonryBoard, MasonryCard, MasonrySkeleton, MasonrySkeletonBoard } from "./MasonryCard";
import { useSpokenIndex } from "./spoken";
import { isDone, parseToolResult } from "./tool-utils";

type MatchPerson = { id: string; name: string; role: string; city?: string; skills: string[]; why?: string; howItHelps?: string };
type MatchProject = { id: string; title: string; outcome: string; ownerName?: string; skills?: string[]; why?: string; howItHelps?: string };
type MatchEvent = { id: string; name: string; dateLabel?: string; city?: string; why?: string };
type MatchPackage = { id: string; name: string; priceUsd: number; summary?: string; includes?: string[] };

export type CommunityMatch = {
  goal?: string;
  people?: MatchPerson[];
  projects?: MatchProject[];
  events?: MatchEvent[];
  packages?: MatchPackage[];
};

/** Badge for the card being read aloud. */
const READING = <><span className="dot animate-pulse bg-signal" aria-hidden="true" /> Leyendo</>;

const Kicker = ({ children }: { children: React.ReactNode }) => <p className="eyebrow">{children}</p>;

const Skills = ({ skills }: { skills?: string[] }) =>
  skills?.length ? (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {skills.slice(0, 4).map((s) => (
        <li key={s} className="rounded-full bg-raise px-2.5 py-1 text-xs text-muted">
          {s}
        </li>
      ))}
    </ul>
  ) : null;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** Community support: people / projects. `mosaic` = big horizontal snap carousel for the right rail. */
export function MatchCards({
  data,
  layout = "stack",
  pending = false,
}: {
  data: CommunityMatch | null;
  layout?: "stack" | "mosaic";
  /** A2UI board still streaming: keep skeleton tiles after the cards that already landed. */
  pending?: boolean;
}) {
  const people = data?.people ?? [];
  const projects = data?.projects ?? [];
  const events = data?.events ?? [];
  const packages = data?.packages ?? [];
  // Card being read aloud (people first, then projects — same order as the board).
  const reading = useSpokenIndex([
    ...people.map((p) => `${p.name} ${p.role} ${(p.skills ?? []).join(" ")}`),
    ...projects.map((p) => `${p.title} ${p.ownerName ?? ""}`),
  ]);
  if (!people.length && !projects.length) return <p className="text-sm">No encontré matches en la comunidad.</p>;

  if (layout === "mosaic") {
    return (
      <div className="grid gap-6">
        <MasonryBoard label="Matches de la comunidad">
          {people.map((p, i) => (
            <MasonryCard
              key={p.id}
              size={i === 0 ? "hero" : "square"}
              active={reading === i}
              badge={reading === i ? READING : undefined}
              title={p.name}
              caption={[p.role, p.city].filter(Boolean).join(" · ")}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="masonry-card__visual">
                <span
                  className={`masonry-card__avatar ${i === 0 ? "is-top" : ""}`}
                  aria-hidden="true"
                >
                  {initials(p.name)}
                </span>
                {i === 0 && <span className="masonry-card__badge">Más afín</span>}
                {(p.howItHelps ?? p.why) && (
                  <p className="masonry-card__visual-text">{p.howItHelps ?? p.why}</p>
                )}
                <Skills skills={p.skills} />
              </div>
            </MasonryCard>
          ))}
          {projects.map((p, i) => (
            <MasonryCard
              key={p.id}
              size={i === 0 && !people.length ? "hero" : "square"}
              active={reading === people.length + i}
              badge={reading === people.length + i ? READING : undefined}
              title={p.title}
              caption={p.ownerName ? `Proyecto · ${p.ownerName}` : "Proyecto"}
              style={{ animationDelay: `${(people.length + i) * 90}ms` }}
            >
              <div className="masonry-card__visual">
                <p className="masonry-card__visual-text">{p.outcome}</p>
                {(p.howItHelps ?? p.why) && (
                  <p className="text-base text-muted">{p.howItHelps ?? `Por qué: ${p.why}`}</p>
                )}
                <Skills skills={p.skills} />
              </div>
            </MasonryCard>
          ))}
          {events.slice(0, 1).map((e) => (
            <MasonryCard
              key={e.id}
              size="compact"
              title={e.name}
              caption={[e.dateLabel, e.city].filter(Boolean).join(" · ") || "Evento"}
            >
              <div className="masonry-card__visual masonry-card__visual--quiet">
                <p className="eyebrow">Evento</p>
              </div>
            </MasonryCard>
          ))}
          {packages.slice(0, 1).map((p) => (
            <MasonryCard key={p.id} size="compact" title={p.name} caption="Paquete">
              <div className="masonry-card__visual masonry-card__visual--quiet">
                <p className="masonry-card__big-num">${p.priceUsd}</p>
                <p className="text-xs text-muted">USD</p>
              </div>
            </MasonryCard>
          ))}
          {pending && [0, 1].map((k) => <MasonrySkeleton key={`sk-${k}`} size="square" delay={k * 0.08} />)}
        </MasonryBoard>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {!!people.length && (
        <div className="grid gap-2">
          <Kicker>Personas con el skill</Kicker>
          <div className="grid gap-2">
            {people.map((p, i) => (
              <article
                key={p.id}
                className={`rise-floor tile p-3 ${i === 0 ? "border-signal" : ""}`}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="flex items-center gap-3 rounded-full bg-raise p-1.5 pr-4">
                  <span className={`grid size-10 flex-none place-items-center rounded-full text-sm font-medium ${i === 0 ? "bg-signal text-signal-ink" : "bg-line text-text"}`} aria-hidden="true">
                    {initials(p.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] leading-tight">{p.name}</h3>
                    <p className="truncate text-xs text-muted">
                      {p.role}
                      {p.city ? ` · ${p.city}` : ""}
                    </p>
                  </div>
                  {i === 0 && <span className="flex-none rounded-full bg-signal px-2.5 py-1 text-[11px] font-medium text-signal-ink">Más afín</span>}
                </div>
                <div className="px-2 pb-1">
                  <Skills skills={p.skills} />
                  {(p.howItHelps ?? p.why) && <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{p.howItHelps ?? p.why}</p>}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {!!projects.length && (
        <div className="grid gap-2">
          <Kicker>Proyectos que resolvieron algo parecido</Kicker>
          <div className="grid gap-2">
            {projects.map((p, i) => (
              <article key={p.id} className="rise-floor tile p-5" style={{ animationDelay: `${i * 90}ms` }}>
                {p.ownerName && <p className="eyebrow">Proyecto · {p.ownerName}</p>}
                <h3 className="mt-1.5 text-lg leading-snug">{p.title}</h3>
                <p className="mt-1.5 text-sm">{p.outcome}</p>
                <Skills skills={p.skills} />
                {(p.howItHelps ?? p.why) && <p className="mt-2.5 text-[13px] text-muted">{p.howItHelps ?? `Por qué: ${p.why}`}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      {(!!events.length || !!packages.length) && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {events.slice(0, 1).map((e) => (
            <article key={e.id} className="tile p-5">
              <Kicker>Evento</Kicker>
              <h3 className="mt-1.5 text-base">{e.name}</h3>
              <p className="text-xs text-muted">{[e.dateLabel, e.city].filter(Boolean).join(" · ")}</p>
            </article>
          ))}
          {packages.slice(0, 1).map((p) => (
            <article key={p.id} className="tile p-5">
              <Kicker>Paquete</Kicker>
              <h3 className="mt-1.5 text-base">{p.name}</h3>
              <p className="mt-1 text-2xl tracking-[-0.03em] tabular-nums">${p.priceUsd} USD</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export type ContextSummary = {
  role?: "seller" | "client";
  roleLabel?: string;
  headline?: string;
  situation?: string;
  challenges?: string[];
  success?: string;
  askPlan?: string;
};

/** Short summary of the challenges, shown before any plan; ends with the permission question. */
export function SummaryCard({ data, flat }: { data: ContextSummary | null; flat?: boolean }) {
  const challenges = data?.challenges ?? [];
  // Card being read aloud: 0 = headline/situation, 1..n = retos, last = éxito.
  const reading = useSpokenIndex([
    `${data?.headline ?? ""} ${data?.situation ?? ""} ${data?.askPlan ?? ""}`,
    ...challenges,
    data?.success ?? "",
  ]);
  if (!data?.headline) return <p className="text-sm">No pude armar el resumen.</p>;
  if (flat) {
    return (
      <MasonryBoard label="Resumen de retos">
        <MasonryCard
          size="hero"
          active={reading === 0}
          badge={reading === 0 ? READING : undefined}
          title={data.headline}
          caption={`Resumen · ${data.roleLabel ?? (data.role === "client" ? "Cliente" : "Vendedor")}`}
        >
          <div className="masonry-card__visual">
            {data.situation && <p className="masonry-card__visual-text">{data.situation}</p>}
            {data.askPlan && <p className="text-base text-muted">{data.askPlan}</p>}
          </div>
        </MasonryCard>
        {challenges.map((c, i) => (
          <MasonryCard
            key={c}
            size="square"
            title={`Reto ${i + 1}`}
            active={reading === i + 1}
            badge={reading === i + 1 ? READING : undefined}
          >
            <div className="masonry-card__visual masonry-card__visual--quiet">
              <span className="masonry-card__big-num">{String(i + 1).padStart(2, "0")}</span>
              <p className="masonry-card__visual-text">{c}</p>
            </div>
          </MasonryCard>
        ))}
        {data.success && (
          <MasonryCard
            size="wide"
            title="Cómo se ve el éxito"
            active={reading === challenges.length + 1}
            badge={reading === challenges.length + 1 ? READING : undefined}
          >
            <div className="masonry-card__visual masonry-card__visual--quiet">
              <p className="eyebrow">Éxito</p>
              <p className="masonry-card__visual-text">{data.success}</p>
            </div>
          </MasonryCard>
        )}
      </MasonryBoard>
    );
  }
  return (
    <div className="rise-floor tile grid gap-4 p-5">
      <div>
        <Kicker>Resumen · {data.roleLabel ?? (data.role === "client" ? "Cliente" : "Vendedor")}</Kicker>
        <h3 className="mt-1.5 text-xl leading-tight tracking-[-0.02em]">{data.headline}</h3>
        {data.situation && <p className="mt-1.5 text-sm text-muted">{data.situation}</p>}
      </div>
      {!!data.challenges?.length && (
        <div className="grid gap-2">
          <Kicker>{data.challenges.length > 1 ? "Retos" : "Reto"}</Kicker>
          <ul className="grid gap-2">
            {data.challenges.map((c, i) => (
              <li key={c} className="grid grid-cols-[1.5rem_1fr] items-start gap-2 rounded-2xl bg-raise px-4 py-3 text-sm">
                <span className="text-xs text-muted tabular-nums">{i + 1}</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.success && (
        <div className="rounded-2xl bg-raise px-4 py-3 text-sm">
          <p className="eyebrow">Cómo se ve el éxito</p>
          <p className="mt-1">{data.success}</p>
        </div>
      )}
      {data.askPlan && <p className="border-t border-line pt-3 text-sm">{data.askPlan}</p>}
    </div>
  );
}

/** Renders generative cards inside chat. Plan = single recommend+approve card. */
export function CommunityCards() {
  useRenderTool({
    name: "match_community",
    render: ({ status }) => {
      // Projects/people are folded into the plan recommend card — avoid a second list in chat.
      if (!isDone(status)) return <LottieState kind="search" size={56} label="Buscando en la comunidad…" />;
      return null;
    },
  });
  // Resumen step: same renderer in chat and on the board (ToolCallSlot). Skeleton while streaming.
  useRenderTool({
    name: "summarize_context",
    render: ({ status, result }) => {
      if (!isDone(status)) return <MasonrySkeletonBoard count={4} label="Resumiendo tus retos" />;
      return (
        <div className="my-2">
          <SummaryCard data={parseToolResult<ContextSummary>(result)} flat />
        </div>
      );
    },
  });
  // Contexto step: discovery questions.
  useRenderTool({
    name: "show_discovery_guide",
    render: ({ status, result }) => {
      if (!isDone(status)) return <MasonrySkeletonBoard count={3} label="Preparando preguntas" />;
      const data = parseToolResult<{ questions?: { id: string; label?: string; question: string }[] }>(result);
      return <DiscoveryBoard questions={data?.questions ?? []} />;
    },
  });
  useRenderTool({
    name: "build_product_plan",
    render: ({ status }) => {
      // Product plan + approve is an A2UI surface (product-plan), not a React card.
      if (!isDone(status)) return <LottieState kind="build" size={56} label="Armando el plan de producto…" />;
      return null;
    },
  });
  useRenderTool({
    name: "assess_context",
    render: () => null, // internal gate (skip discovery when context is complete) — nothing to show
  });
  useRenderTool({
    name: "build_strategy_plan",
    render: ({ status }) => {
      // Recommend+approve UI is A2UI over AG-UI (ACTIVITY_SNAPSHOT), not a fixed React card.
      if (!isDone(status)) return <LottieState kind="build" size={56} label="Armando la recomendación…" />;
      return null;
    },
  });
  return null;
}
