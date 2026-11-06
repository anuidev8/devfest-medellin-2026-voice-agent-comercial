/**
 * NoShy discovery playbook — adapted from SETI's comercial flow.
 * Stages: context → discovery → match → proposal
 * Tracks: builder (idea→product/sell) | company (talent/solution/growth)
 *
 * Six fixed questions after intake. Voice asks them one at a time, with the list on screen.
 */

export type DiscoveryTrack = "builder" | "company";
export type DiscoveryStage = "context" | "discovery" | "summary" | "match" | "proposal";
export type DiscoveryFactType = "profile" | "need" | "pain" | "stakeholder" | "next_step" | "skill_gap" | "budget";

export const DISCOVERY_TRACKS: { id: DiscoveryTrack; label: string; hint: string }[] = [
  {
    id: "builder",
    label: "Builder / Founder",
    hint: "Tienes una idea o producto y necesitas gente, mentoría o un path para venderlo.",
  },
  {
    id: "company",
    label: "Empresa",
    hint: "Buscas talento, una solución, o visibilidad/leads en la comunidad.",
  },
];

export const DISCOVERY_STAGES: { id: DiscoveryStage; label: string; hint: string }[] = [
  { id: "context", label: "Contexto", hint: "Quién eres y qué buscas hoy." },
  { id: "discovery", label: "Indagación", hint: "Dolor, situación actual y qué te falta." },
  { id: "match", label: "Comunidad", hint: "Personas, proyectos, speakers y eventos que encajan." },
  { id: "proposal", label: "Propuesta", hint: "Paquete + plan de acción concreto." },
];

export type DiscoverySlot = {
  id: string;
  label: string;
  question: string;
  why: string;
  track: "general" | DiscoveryTrack;
  required: boolean;
  factTypes: DiscoveryFactType[];
};

// quien and objetivo come from intake; the other six are the spoken questions, in order.
export const DISCOVERY_SLOTS: DiscoverySlot[] = [
  {
    id: "quien",
    label: "Quién eres",
    question: "Para ubicarme: ¿vienes con un proyecto propio o en nombre de una empresa? Cuéntame en una frase a qué te dedicas.",
    why: "Define el track y el tono de la propuesta.",
    track: "general",
    required: true,
    factTypes: ["profile"],
  },
  {
    id: "objetivo",
    label: "Objetivo",
    question: "¿Qué necesitas resolver?",
    why: "Punto de partida del match.",
    track: "general",
    required: true,
    factTypes: ["need"],
  },
  {
    id: "porque_ahora",
    label: "Por qué ahora",
    question: "¿Qué te hizo buscarnos justo ahora?",
    why: "Clarify (Hormozi): el motivo del momento revela urgencia y objetivo real.",
    track: "general",
    required: true,
    factTypes: [],
  },
  {
    id: "dolor",
    label: "Dolor principal",
    question: "¿Qué te frena hoy, y qué te cuesta si sigue igual 3 meses más?",
    why: "Label + coste de no actuar: sin dolor cuantificado no hay proyecto.",
    track: "general",
    required: true,
    factTypes: ["pain"],
  },
  {
    id: "situacion_actual",
    label: "Qué ha probado",
    question: "¿Qué has probado y por qué no funcionó del todo?",
    why: "Overview del pasado: evita proponer lo que ya falló y anticipa objeciones.",
    track: "general",
    required: true,
    factTypes: [],
  },
  {
    id: "proyecto",
    label: "Tu proyecto",
    question: "¿Qué construyes, para quién, y ya tienes clientes que pagan?",
    why: "La madurez decide entre Builder Path y Sell Better Clinic.",
    track: "builder",
    required: true,
    factTypes: ["skill_gap"],
  },
  {
    id: "ayuda",
    label: "Ayuda que necesitas",
    question: "¿Qué skills o tipo de ayuda son obligatorios?",
    why: "Elige el catálogo y rankea personas y proyectos.",
    track: "company",
    required: true,
    factTypes: ["skill_gap"],
  },
  {
    id: "exito",
    label: "Cómo miden el éxito",
    question: "¿Qué número o señal te diría que valió la pena?",
    why: "Estado futuro medible (Gap Selling): la medida con la que juzgarán la propuesta.",
    track: "general",
    required: true,
    factTypes: [],
  },
  {
    id: "cierre",
    label: "Plazo, presupuesto y decisión",
    question: "¿Para cuándo lo necesitas, qué presupuesto tienes en mente y decides tú o alguien más?",
    why: "BANT: Budget, Authority y Timing para saber si avanzar y con quién.",
    track: "general",
    required: true,
    factTypes: ["budget", "stakeholder", "next_step"],
  },
];

export const DISCOVERY_WHY =
  "Con estas preguntas entendemos tu necesidad real y te conectamos con personas, proyectos, speakers y eventos de la comunidad — no con un catálogo genérico.";

export type DiscoveryFact = {
  factType: DiscoveryFactType | string;
  value: string;
  slotId?: string | null;
};

export type DiscoveryState = {
  track: DiscoveryTrack;
  pendingSlotIds: string[];
  stage: DiscoveryStage;
  shownItemIds: string[];
  recommendationShown: boolean;
};

export const EMPTY_DISCOVERY_STATE: DiscoveryState = {
  track: "builder",
  pendingSlotIds: [],
  stage: "context",
  shownItemIds: [],
  recommendationShown: false,
};

export type DiscoverySlotStatus = "known" | "missing" | "pending";

export type DiscoverySlotView = {
  id: string;
  label: string;
  question: string;
  why: string;
  required: boolean;
  status: DiscoverySlotStatus;
  values: string[];
};

export type DiscoveryBrief = {
  track: DiscoveryTrack;
  stage: DiscoveryStage;
  why: string;
  slots: DiscoverySlotView[];
  knownCount: number;
  totalCount: number;
  next: DiscoverySlotView | null;
  openQuestions: Array<{ id: string; label: string; question: string }>;
};

export function slotsForTrack(track: DiscoveryTrack): DiscoverySlot[] {
  return DISCOVERY_SLOTS.filter((s) => s.track === "general" || s.track === track);
}

export function inferTrack(input: {
  persona?: string;
  track?: string;
  text?: string;
}): DiscoveryTrack {
  if (input.track === "company" || input.track === "builder") return input.track;
  const p = (input.persona ?? "").toLowerCase();
  if (p.includes("company") || p.includes("empresa") || p.includes("sponsor") || p.includes("growth")) {
    return "company";
  }
  const t = (input.text ?? "").toLowerCase();
  if (/(empresa|contrat|talento|freelancer|agencia|sponsor|visibilidad|leads)/.test(t)) {
    return "company";
  }
  return "builder";
}

function resolveFactSlot(
  factType: string,
  slotId: string | null | undefined,
  track: DiscoveryTrack,
  filled: ReadonlySet<string>,
): string | null {
  const slots = slotsForTrack(track);
  if (slotId && slots.some((s) => s.id === slotId)) return slotId;
  const accepting = slots.filter((s) => s.factTypes.includes(factType as DiscoveryFactType));
  return (accepting.find((s) => !filled.has(s.id)) ?? accepting[0])?.id ?? null;
}

export type BriefSessionInput = {
  track?: DiscoveryTrack;
  clientName?: string;
  objective?: string;
  needsContext?: string;
  building?: string;
  lookingFor?: string;
  facts?: DiscoveryFact[];
  discovery?: Partial<DiscoveryState> | null;
};

/**
 * Builds the on-screen discovery guide. Stage advances by flow signals
 * (shown items / recommendation), not by filling every slot.
 */
export function computeDiscoveryBrief(session: BriefSessionInput): DiscoveryBrief {
  const track = session.track ?? session.discovery?.track ?? "builder";
  const state: DiscoveryState = {
    ...EMPTY_DISCOVERY_STATE,
    ...session.discovery,
    track,
  };
  const slots = slotsForTrack(track);

  const values = new Map<string, string[]>();
  const add = (slotId: string, value?: string) => {
    const text = value?.trim();
    if (!text) return;
    const list = values.get(slotId) ?? [];
    if (!list.includes(text)) values.set(slotId, [text, ...list]);
  };

  add("quien", session.clientName);
  add("objetivo", session.objective ?? session.lookingFor);
  add("dolor", session.needsContext);
  if (track === "builder") add("proyecto", session.building);
  else add("ayuda", session.building);

  for (const fact of session.facts ?? []) {
    const slotId = resolveFactSlot(fact.factType, fact.slotId, track, new Set(values.keys()));
    if (slotId) add(slotId, fact.value);
  }

  const pending = new Set(state.pendingSlotIds);
  const views: DiscoverySlotView[] = slots.map((slot) => {
    const known = values.get(slot.id) ?? [];
    return {
      id: slot.id,
      label: slot.label,
      question: slot.question,
      why: slot.why,
      required: slot.required,
      status: known.length ? "known" : pending.has(slot.id) ? "pending" : "missing",
      values: known,
    };
  });

  const missing = views.filter((s) => s.status === "missing");
  const next = missing.find((s) => s.required) ?? missing[0] ?? null;
  const contextReady = views
    .filter((s) => s.id === "quien" || s.id === "objetivo")
    .every((s) => s.status === "known" || !s.required);

  let stage: DiscoveryStage = "proposal";
  if (!contextReady && !session.clientName && !session.objective) stage = "context";
  else if (!state.shownItemIds.length) stage = "discovery";
  else if (!state.recommendationShown) stage = "match";

  if (state.stage === "proposal" || state.recommendationShown) stage = "proposal";
  else if (state.shownItemIds.length && !state.recommendationShown) stage = "match";

  return {
    track,
    stage,
    why: DISCOVERY_WHY,
    slots: views,
    knownCount: views.filter((s) => s.status === "known").length,
    totalCount: views.length,
    next,
    openQuestions: missing.map((s) => ({
      id: s.id,
      label: s.label,
      question: s.question,
    })),
  };
}

export function applyFactToState(
  facts: DiscoveryFact[],
  fact: DiscoveryFact,
): DiscoveryFact[] {
  const next = [...facts];
  const idx = next.findIndex(
    (f) => (fact.slotId && f.slotId === fact.slotId) || (!fact.slotId && f.factType === fact.factType && f.value === fact.value),
  );
  if (idx >= 0) next[idx] = fact;
  else next.push(fact);
  return next;
}

/** Slots that must be known to skip discovery and go straight to the summary. */
const CORE_SLOTS = ["quien", "objetivo", "dolor"] as const;

export type ContextReadiness = {
  /** summary = skip discovery; ask_missing = ask only `missing`; discovery = full guide. */
  next: "summary" | "ask_missing" | "discovery";
  ready: boolean;
  known: string[];
  missing: Array<{ id: string; label: string; question: string }>;
};

/**
 * Do we already know enough (company + what the client needs + the pain) to summarize?
 * A Deal Brief (transcript / pasted brief) counts as full context.
 */
export function assessContextLogic(brief: DiscoveryBrief, hasDealBrief = false): ContextReadiness {
  const known = brief.slots.filter((s) => s.status === "known").map((s) => s.label);
  const coreMissing = brief.slots
    .filter((s) => (CORE_SLOTS as readonly string[]).includes(s.id) && s.status !== "known")
    .map((s) => ({ id: s.id, label: s.label, question: s.question }));
  if (hasDealBrief || coreMissing.length === 0) return { next: "summary", ready: true, known, missing: [] };
  if (coreMissing.length <= 2 && known.length >= 2) return { next: "ask_missing", ready: false, known, missing: coreMissing };
  return { next: "discovery", ready: false, known, missing: coreMissing };
}
