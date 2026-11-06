"use client";

import { useState } from "react";
import { INTAKE_FIELDS, useConcierge } from "./concierge";
import { LottieState } from "./LottieState";
import { MasonryBoard, MasonryCard } from "./MasonryCard";
import { useSpokenIndex } from "./spoken";

/**
 * Phase 1 of the MVP: the voice agent collects all three answers, then submits
 * them together (LiveKit RPC `intake.submit`). They sync into CopilotKit agent
 * state → ADK session.state, and the ADK flow starts on its own.
 * Typing works too, so the form stays interactive.
 *
 * `variant="rail"` = Shopping Console masonry cards on the right ContextRail.
 */
/** How the voice asks each field (keywords matched against her live speech). */
const FIELD_ASKS: Record<(typeof INTAKE_FIELDS)[number]["id"], string> = {
  name: "¿Cómo te llamas? tu nombre",
  persona: "perfil a qué te dedicas vendes vendedor empresa cliente rol",
  lookingFor: "qué necesitas qué buscas qué quieres lograr resolver necesidad",
};

export function IntakeForm({ variant = "card", voiceLive = false }: { variant?: "card" | "rail"; voiceLive?: boolean }) {
  const { intake, fillIntake, voiceFilled, running, discovery, deal, clientName, email, saveEmail, analyzeTranscript, items } = useConcierge();
  const filled = INTAKE_FIELDS.filter((f) => intake[f.id]).length;
  const complete = filled === INTAKE_FIELDS.length;
  const [open, setOpen] = useState(false);
  const rail = variant === "rail";

  // Question by question: the card being asked glows. Her live speech wins; otherwise
  // (voice on) the first empty field is the one in progress.
  const spoken = useSpokenIndex(INTAKE_FIELDS.map((f) => FIELD_ASKS[f.id]));
  const firstEmpty = INTAKE_FIELDS.findIndex((f) => !intake[f.id]);
  const activeIndex = spoken >= 0 ? spoken : voiceLive ? firstEmpty : -1;

  // Once the brain has the context (assessed / summarized / discovery answered), this step
  // collapses to a plain "Contexto entendido" note — the cards live in the next steps.
  const understood =
    complete && (!!discovery?.done || items.some((i) => i.name === "assess_context" || i.name === "summarize_context"));

  if (rail && understood) {
    const answers = [
      ...INTAKE_FIELDS.map((f) => ({ label: f.label, value: intake[f.id] })),
      ...(clientName ? [{ label: "Cliente", value: clientName }] : []),
      ...(email ? [{ label: "Correo", value: email }] : []),
    ].filter((a) => a.value);
    return (
      <div aria-label="Contexto entendido" className="intake-rail grid gap-8">
        <div className="flex items-center gap-4">
          <span className="grid size-12 flex-none place-items-center rounded-full bg-good text-[#05210f]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <div>
            <h2 className="masonry-section-title">Contexto entendido</h2>
            <p className="mt-2 text-base text-muted">{running ? "Preparando el resumen…" : "Con esto armamos tu resumen y tu plan."}</p>
          </div>
        </div>
        <dl className="grid max-w-[62ch] gap-4">
          {answers.map((a) => (
            <div key={a.label} className="grid gap-1 border-b border-line/60 pb-3">
              <dt className="eyebrow">{a.label}</dt>
              <dd className="text-lg leading-snug">{a.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (rail) {
    return (
      <div aria-label="Tu contexto" className="intake-rail">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="masonry-section-title">Tu contexto</h2>
            <p className={`mt-3 text-base ${complete ? "text-good" : "text-muted"}`}>
              {complete
                ? running
                  ? "El agente está trabajando"
                  : "Listo · contexto completo"
                : `${filled} de ${INTAKE_FIELDS.length} respuestas · por voz`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {complete && running && <LottieState kind="think" size={40} />}
            <ProgressRing value={filled} total={INTAKE_FIELDS.length} large />
          </div>
        </div>

        <MasonryBoard label="Campos de contexto">
          {INTAKE_FIELDS.map((f, i) => (
            <MasonryField
              key={f.id}
              field={f}
              value={intake[f.id]}
              flash={voiceFilled.includes(f.id)}
              active={i === activeIndex}
              onCommit={(v) => void fillIntake(f.id, v)}
              size={i === 0 ? "hero" : "square"}
              delay={i * 70}
            />
          ))}
          <MasonryEmail
            label={clientName ? "Correo cliente" : "Correo"}
            value={email}
            onCommit={saveEmail}
            delay={220}
          />
        </MasonryBoard>

        {/* Discovery playbook + Deal Brief live in the Resumen step (Stage → SummaryStep). */}
        <div className="mt-6">
          <TranscriptBox onSubmit={analyzeTranscript} />
          <p className="mt-4 max-w-[40ch] text-[11px] leading-snug text-muted">
            Hablas con una IA. Guardamos estos datos para preparar tu propuesta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Tu contexto"
      className="reveal-2 tile absolute inset-x-4 top-[4.25rem] z-20 max-h-[calc(100dvh-11rem)] overflow-y-auto p-2.5 md:inset-x-auto md:left-6 md:top-24 md:max-h-[calc(100dvh-14rem)] md:w-80 md:p-4"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="intake-body"
        className="flex w-full items-center gap-3 text-left md:pointer-events-none md:mb-3"
      >
        <ProgressRing value={filled} total={INTAKE_FIELDS.length} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-tight">Tu contexto</p>
          <p className={`text-xs ${complete ? "text-good" : "text-muted"}`}>
            {complete ? (running ? "El agente está trabajando" : "Listo") : `${filled} de ${INTAKE_FIELDS.length} respuestas · por voz`}
          </p>
        </div>
        {complete && running && <LottieState kind="think" size={40} />}
        <span className="text-xs text-muted md:hidden" aria-hidden="true">
          {open ? "Cerrar" : "Ver"}
        </span>
      </button>
      <div id="intake-body" className={`${open ? "block" : "hidden"} mt-3 md:mt-0 md:block`}>
        <div className="grid gap-1.5">
          {INTAKE_FIELDS.map((f) => (
            <FieldRow key={f.id} field={f} value={intake[f.id]} flash={voiceFilled.includes(f.id)} onCommit={(v) => void fillIntake(f.id, v)} />
          ))}
          <EmailRow label={clientName ? "Correo cliente" : "Correo"} value={email} onCommit={saveEmail} />
        </div>
        {discovery && (
          <div className="mt-4">
            <p className="eyebrow mb-2">{discovery.done ? "Contexto entendido" : "Tu negocio · preguntas"}</p>
            <ol className="grid max-h-28 gap-1.5 overflow-y-auto md:max-h-56">
              {discovery.questions.map((q, i) => (
                <li
                  key={q.id}
                  className={`chip-land grid grid-cols-[1.25rem_1fr] gap-1 rounded-2xl bg-raise px-3 py-2 text-xs leading-snug ${discovery.done ? "text-muted line-through" : "text-text"}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="text-muted tabular-nums">{i + 1}</span>
                  {q.question}
                </li>
              ))}
            </ol>
          </div>
        )}
        {deal && <BriefSummary summary={deal.summary} route={deal.fit.route} reasons={deal.fit.reasons} evidence={deal.evidence} />}
        <TranscriptBox onSubmit={analyzeTranscript} />
        <p className="mt-3 text-[11px] leading-snug text-muted">Hablas con una IA. Guardamos estos datos para preparar tu propuesta.</p>
      </div>
    </section>
  );
}

const ROUTE_LABEL = { meeting: "Listo para reunión", email: "Enviar propuesta", nurture: "Recurso gratuito" } as const;

export function BriefSummary({
  summary,
  route,
  reasons,
  evidence,
  rail,
}: {
  summary: string;
  route: keyof typeof ROUTE_LABEL;
  reasons: string[];
  evidence?: string[];
  rail?: boolean;
}) {
  if (rail) {
    return (
      <MasonryCard
        size="hero"
        kicker="Resumen"
        title={ROUTE_LABEL[route]}
        caption={reasons.join(" · ")}
      >
        <div className="masonry-card__visual">
          <p className="masonry-card__visual-text">{summary}</p>
          {!!evidence?.length && <blockquote className="text-base text-muted italic">“{evidence[0]}”</blockquote>}
        </div>
      </MasonryCard>
    );
  }
  return (
    <div className="chip-land mt-4 rounded-2xl bg-raise p-3">
      <p className="mb-1.5 flex items-center justify-between gap-2">
        <span className="eyebrow">Resumen</span>
        <span className="rounded-full bg-signal px-2.5 py-1 text-[11px] font-medium text-signal-ink">{ROUTE_LABEL[route]}</span>
      </p>
      <p className="text-[13px] leading-snug">{summary}</p>
      <p className="mt-1 text-[11px] text-muted">{reasons.join(" · ")}</p>
      {!!evidence?.length && <blockquote className="mt-1.5 text-[11px] text-muted italic">“{evidence[0]}”</blockquote>}
    </div>
  );
}

function MasonryField({
  field,
  value,
  flash,
  active,
  onCommit,
  size,
  delay,
}: {
  field: (typeof INTAKE_FIELDS)[number];
  value: string;
  flash: boolean;
  active?: boolean;
  onCommit: (value: string) => void;
  size: "hero" | "tall" | "wide" | "square" | "compact";
  delay: number;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const [focused, setFocused] = useState(false);
  if (value !== synced && !focused) {
    setSynced(value);
    setDraft(value);
  }

  return (
    <MasonryCard
      as="label"
      size={size}
      title={field.label}
      caption={value ? "Por voz · editable" : field.placeholder}
      flash={flash}
      active={active && !flash}
      badge={flash ? "✓ Guardado" : active ? <><span className="dot animate-pulse bg-signal" aria-hidden="true" /> Preguntando</> : value ? "Listo" : undefined}
      style={{ animationDelay: `${delay}ms` }}
    >
      <input
        value={draft}
        placeholder={field.placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (draft.trim() !== value) onCommit(draft);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="masonry-card__input"
        aria-label={field.label}
      />
    </MasonryCard>
  );
}

function MasonryEmail({
  label,
  value,
  onCommit,
  delay,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  delay: number;
}) {
  return (
    <MasonryCard
      as="div"
      size="wide"
      title={label}
      caption={value ? "Listo para la propuesta" : "nombre@empresa.com"}
      style={{ animationDelay: `${delay}ms` }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("email") as HTMLInputElement;
          if (input.value.trim() !== value) onCommit(input.value);
        }}
      >
        <input
          id="intake-email"
          name="email"
          type="email"
          defaultValue={value}
          placeholder="nombre@empresa.com"
          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
          className="masonry-card__input"
          aria-label={label}
        />
      </form>
    </MasonryCard>
  );
}

function EmailRow({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  return (
    <form
      className="grid grid-cols-[6.75rem_1fr] items-center gap-2 rounded-2xl bg-raise px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("email") as HTMLInputElement;
        if (input.value.trim() !== value) onCommit(input.value);
      }}
    >
      <label htmlFor="intake-email-legacy" className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">
        {label}
      </label>
      <input
        id="intake-email-legacy"
        name="email"
        type="email"
        defaultValue={value}
        placeholder="nombre@empresa.com"
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-muted/60"
      />
    </form>
  );
}

function TranscriptBox({ onSubmit }: { onSubmit: (transcript: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <details className="mt-2">
      <summary className="mt-1 cursor-pointer text-xs text-muted hover:text-text">Usar la transcripción de una reunión</summary>
      <form
        className="mt-2 grid gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await onSubmit(text);
            setText("");
            setConsent(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "No pude analizar la transcripción.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <textarea
          id="meeting-transcript"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Pega aquí la transcripción"
          aria-label="Transcripción de la reunión"
          className="rounded-2xl bg-raise px-3 py-2 text-xs text-text outline-none placeholder:text-muted/60"
        />
        <label className="flex items-start gap-2 text-[11px] leading-snug text-muted">
          <input id="meeting-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          Tengo permiso de los participantes para usar esta reunión.
        </label>
        {error && <p role="alert" className="text-[11px] text-danger">{error}</p>}
        <button type="submit" disabled={!text.trim() || !consent || busy} className="btn btn-quiet justify-self-start px-4 py-2.5 text-xs">
          {busy ? "Analizando…" : "Analizar"}
        </button>
      </form>
    </details>
  );
}

function FieldRow({
  field,
  value,
  flash,
  onCommit,
}: {
  field: (typeof INTAKE_FIELDS)[number];
  value: string;
  flash: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const [focused, setFocused] = useState(false);
  if (value !== synced && !focused) {
    setSynced(value);
    setDraft(value);
  }

  return (
    <label
      className={`grid grid-cols-[6.75rem_1fr] items-center gap-2 rounded-2xl px-3 py-2 transition-[background,box-shadow] duration-[320ms] ${
        flash ? "chip-land bg-raise shadow-[inset_0_0_0_1.5px_var(--glow)]" : value ? "bg-raise" : "bg-raise/50"
      }`}
    >
      <span className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">{field.label}</span>
      <input
        value={draft}
        placeholder={field.placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (draft.trim() !== value) onCommit(draft);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-muted/60"
      />
    </label>
  );
}

function ProgressRing({ value, total, large }: { value: number; total: number; large?: boolean }) {
  const r = large ? 20 : 17;
  const size = large ? 52 : 44;
  const c = 2 * Math.PI * r;
  const done = value >= total;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={large ? "size-[3.25rem] flex-none" : "size-11 flex-none"} role="img" aria-label={`${value} de ${total} respuestas`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--raise)" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={done ? "var(--good)" : "var(--signal)"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(value / total) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 900ms var(--ease-out-soft)" }}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={large ? 13 : 12} fontWeight="500" fill="var(--text)">
        {value}/{total}
      </text>
    </svg>
  );
}

/**
 * Discovery questions bento ("Tu negocio"). Rendered by the CopilotKit `show_discovery_guide`
 * tool renderer and by the voice intake fallback. `done` comes from concierge state.
 */
export function DiscoveryBoard({ questions }: { questions: { id: string; label?: string; question: string }[] }) {
  const { discovery } = useConcierge();
  const done = !!discovery?.done;
  const reading = useSpokenIndex(questions.map((q) => q.question));
  if (!questions.length) return null;
  return (
    <div className="grid gap-6">
      <h3 className="masonry-section-title masonry-section-title--sm">{done ? "Playbook de preguntas · respondido" : "Playbook de preguntas"}</h3>
      <MasonryBoard label="Preguntas de descubrimiento">
        {questions.map((q, i) => (
          <MasonryCard
            key={q.id}
            size={i === 0 ? "hero" : "square"}
            title={q.label || `Pregunta ${i + 1}`}
            caption={done ? "Respondida" : "Por responder"}
            active={i === reading}
            badge={i === reading ? <><span className="dot animate-pulse bg-signal" aria-hidden="true" /> Preguntando</> : undefined}
            className={done && i !== reading ? "opacity-60" : ""}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="masonry-card__visual masonry-card__visual--quiet">
              <span className="masonry-card__big-num">{String(i + 1).padStart(2, "0")}</span>
              <p className="masonry-card__visual-text">{q.question}</p>
            </div>
          </MasonryCard>
        ))}
      </MasonryBoard>
    </div>
  );
}
