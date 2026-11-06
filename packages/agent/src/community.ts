/**
 * Mock NoShy / MyCommunity data for the talk demo.
 * Tools never invent people, events, or packages — they only return from here.
 */

export type Persona = "member" | "company_challenge" | "company_growth";

export type Person = {
  id: string;
  name: string;
  role: string;
  building: string;
  lookingFor: string;
  offering: string;
  skills: string[];
  city: string;
  interests: string[];
  tags: string[];
};

export type ProjectExample = {
  id: string;
  title: string;
  ownerPersonId: string;
  summary: string;
  outcome: string;
  skills: string[];
  industries: string[];
  tags: string[];
};

export type Speaker = {
  id: string;
  personId: string;
  name: string;
  topic: string;
  eventId: string;
  tags: string[];
};

/** Commercial packages sold by NoShy (proposal catalog). */
export type NoshyPackage = {
  id: string;
  name: string;
  priceUsd: number;
  track: "builder" | "company" | "both";
  includes: string[];
  bestFor: string[];
  summary: string;
};

export type CommunityEvent = {
  id: string;
  name: string;
  city: string;
  venue: string;
  dateLabel: string;
  timeLabel: string;
  summary: string;
  forWhom: string[];
  interests: string[];
  speakers: Array<{ name: string; topic: string }>;
};

export type SponsorPackage = {
  id: string;
  name: string;
  priceUsd: number;
  includes: string[];
  bestFor: string[];
};

export type PreContext = {
  persona?: Persona | string;
  building?: string;
  lookingFor?: string;
  offering?: string;
  successCriteria?: string;
  challenge?: string;
  helpType?: string;
  urgency?: string;
  budget?: string;
  targetAudience?: string;
  growthGoal?: string;
  city?: string;
  preferredLanguage?: string;
  name?: string;
  email?: string;
  dealId?: string;
  dealSummary?: string;
  fitRoute?: string;
  mode?: string;
  clientName?: string;
};

export const PEOPLE: Person[] = [
  {
    id: "maria_ai_ecommerce",
    name: "María",
    role: "Founder",
    building: "Producto de IA para ecommerce (automatización de soporte)",
    lookingFor: "Frontend developer con React/Next.js",
    offering: "Producto SaaS, mentorship de product, acceso a clientes ecommerce",
    skills: ["product", "ia", "ecommerce", "ventas", "pitch", "saas"],
    city: "Medellín",
    interests: ["ia", "ecommerce", "agentes", "frontend", "saas"],
    tags: ["founder", "ai", "hiring", "mentor"],
  },
  {
    id: "diego_whatsapp",
    name: "Diego",
    role: "Automation specialist",
    building: "Bots de WhatsApp y flujos de soporte para retail",
    lookingFor: "Proyectos de automatización y alianzas con agencias",
    offering: "WhatsApp automation, integraciones, demos técnicas",
    skills: ["whatsapp", "automatizacion", "n8n", "python", "integraciones"],
    city: "Medellín",
    interests: ["whatsapp", "automatizacion", "retail", "agentes", "soporte"],
    tags: ["freelancer", "automation"],
  },
  {
    id: "camila_design",
    name: "Camila",
    role: "Product designer",
    building: "Design systems para startups de IA",
    lookingFor: "Founders early-stage que necesiten UX",
    offering: "UI/UX, research rápido, prototipos Figma",
    skills: ["ux", "ui", "figma", "research", "design-systems"],
    city: "Medellín",
    interests: ["design", "ux", "ia", "startups", "product"],
    tags: ["designer", "freelancer"],
  },
  {
    id: "andres_investor",
    name: "Andrés",
    role: "Angel investor",
    building: "Portfolio de startups LatAm en AI/devtools",
    lookingFor: "Founders pre-seed con tracción inicial",
    offering: "Capital angel, intros a VCs, feedback de pitch",
    skills: ["pitch", "fundraising", "ventas", "go-to-market"],
    city: "Medellín",
    interests: ["inversion", "ia", "devtools", "founders", "latam"],
    tags: ["investor", "mentor"],
  },
  {
    id: "laura_agency",
    name: "Laura",
    role: "Agency lead",
    building: "Agencia de agentes conversacionales para empresas",
    lookingFor: "Empresas con retos de soporte o lead-gen",
    offering: "Implementación end-to-end, equipo multidisciplinario",
    skills: ["agentes", "voz", "delivery", "b2b", "proyecto"],
    city: "Bogotá",
    interests: ["agentes", "voz", "b2b", "soporte", "agencia"],
    tags: ["agency", "b2b"],
  },
];

export const PROJECTS: ProjectExample[] = [
  {
    id: "proj_support_bot",
    title: "Bot de soporte ecommerce que redujo tickets 40%",
    ownerPersonId: "maria_ai_ecommerce",
    summary: "Agente de IA que responde FAQs y escala a humano en WhatsApp/web.",
    outcome: "Vendió a 2 retailers; caso usado para pitch a sponsors.",
    skills: ["ia", "ecommerce", "soporte", "product", "ventas"],
    industries: ["ecommerce", "retail"],
    tags: ["mvp", "sold", "ai"],
  },
  {
    id: "proj_whatsapp_ops",
    title: "Automatización WhatsApp para retail",
    ownerPersonId: "diego_whatsapp",
    summary: "Flujos de pedidos, estados y FAQ sin equipo 24/7.",
    outcome: "3 clientes activos; demo lista para eventos.",
    skills: ["whatsapp", "automatizacion", "retail", "integraciones"],
    industries: ["retail", "ecommerce"],
    tags: ["freelancer", "ops"],
  },
  {
    id: "proj_ai_design_system",
    title: "Design system para AI product",
    ownerPersonId: "camila_design",
    summary: "UI kit + flujos de onboarding para un SaaS de agentes.",
    outcome: "Aceleró el MVP de un founder en 3 semanas.",
    skills: ["ux", "ui", "product", "ia"],
    industries: ["saas", "ai"],
    tags: ["design", "mvp"],
  },
  {
    id: "proj_agency_voice",
    title: "Agente de voz B2B para lead qualification",
    ownerPersonId: "laura_agency",
    summary: "Concierge de voz que califica leads y agenda demos.",
    outcome: "Pipeline medible para un cliente cloud.",
    skills: ["voz", "agentes", "b2b", "leads", "ventas"],
    industries: ["b2b", "cloud"],
    tags: ["agency", "voice"],
  },
];

export const SPEAKERS: Speaker[] = [
  {
    id: "spk_maria",
    personId: "maria_ai_ecommerce",
    name: "María",
    topic: "De idea a producto vendible: agentes de soporte",
    eventId: "ai_after_hours",
    tags: ["product", "ventas", "ia", "pitch"],
  },
  {
    id: "spk_diego",
    personId: "diego_whatsapp",
    name: "Diego",
    topic: "WhatsApp automation en producción",
    eventId: "ai_after_hours",
    tags: ["automatizacion", "whatsapp", "tech"],
  },
  {
    id: "spk_camila",
    personId: "camila_design",
    name: "Camila",
    topic: "Design systems para AI products",
    eventId: "builders_brunch",
    tags: ["design", "product", "mvp"],
  },
  {
    id: "spk_laura",
    personId: "laura_agency",
    name: "Laura",
    topic: "Cómo una agencia convierte eventos en pipeline",
    eventId: "sponsor_open_day",
    tags: ["b2b", "leads", "ventas", "agency"],
  },
];

export const NOSHY_PACKAGES: NoshyPackage[] = [
  {
    id: "builder_path",
    name: "Builder Path",
    priceUsd: 50,
    track: "builder",
    summary: "De idea a plan accionable con intros y un evento.",
    includes: ["2 intros guiadas", "1 evento", "1 project example de referencia", "Plan de 14 días"],
    bestFor: ["idea", "mvp", "producto", "colaborador", "mentor"],
  },
  {
    id: "sell_better_clinic",
    name: "Sell Better Clinic",
    priceUsd: 80,
    track: "builder",
    summary: "Para builders que no saben vender su producto.",
    includes: ["Pitch review 30 min", "Match con speaker de ventas/product", "1 follow-up class", "Plantilla de propuesta"],
    bestFor: ["ventas", "pitch", "vender", "go-to-market", "cliente"],
  },
  {
    id: "talent_brief",
    name: "Talent Brief",
    priceUsd: 120,
    track: "company",
    summary: "Reto de empresa → 3 matches + intros opt-in.",
    includes: ["Brief estructurado", "3 matches de skills", "Intros con aprobación humana", "Seguimiento 7 días"],
    bestFor: ["talento", "freelancer", "agencia", "hire", "skills"],
  },
  {
    id: "growth_sponsor",
    name: "Growth / Sponsor",
    priceUsd: 900,
    track: "company",
    summary: "Visibilidad y leads con la audiencia técnica.",
    includes: ["Demo o mención en evento", "Audiencia developers/founders", "Lead capture", "5 entradas"],
    bestFor: ["visibilidad", "leads", "sponsor", "demos", "developers"],
  },
];

export const EVENTS: CommunityEvent[] = [
  {
    id: "ai_after_hours",
    name: "AI After Hours — Rooftop Edition",
    city: "Medellín",
    venue: "El Poblado",
    dateLabel: "Jueves próximo",
    timeLabel: "6:00 p. m. – 8:00 p. m.",
    summary: "Demos de agentes, builders locales y networking bilingüe.",
    forWhom: ["developers", "founders", "builders de IA"],
    interests: ["ia", "agentes", "networking", "demos", "frontend", "builders"],
    speakers: [
      { name: "María", topic: "Agentes de soporte para ecommerce" },
      { name: "Diego", topic: "WhatsApp automation en producción" },
    ],
  },
  {
    id: "builders_brunch",
    name: "Visible Builders Brunch",
    city: "Medellín",
    venue: "Laureles",
    dateLabel: "Sábado en 2 semanas",
    timeLabel: "10:00 a. m. – 1:00 p. m.",
    summary: "Brunch de builders: proyectos en vivo, feedback y matches guiados.",
    forWhom: ["builders", "designers", "founders"],
    interests: ["builders", "product", "design", "networking", "proyectos"],
    speakers: [{ name: "Camila", topic: "Design systems para AI products" }],
  },
  {
    id: "sponsor_open_day",
    name: "Community Open Day for Partners",
    city: "Medellín",
    venue: "Cowork centro",
    dateLabel: "Viernes en 3 semanas",
    timeLabel: "4:00 p. m. – 7:00 p. m.",
    summary: "Día abierto para empresas: demos, audiencia técnica y paquetes sponsor.",
    forWhom: ["empresas", "sponsors", "agencias"],
    interests: ["sponsors", "b2b", "leads", "visibilidad", "developers"],
    speakers: [{ name: "Laura", topic: "Cómo una agencia convierte eventos en pipeline" }],
  },
];

export const PACKAGES: SponsorPackage[] = [
  {
    id: "community_partner",
    name: "Community Partner",
    priceUsd: 350,
    includes: ["Logo + mención", "2 entradas", "Post en comunidad"],
    bestFor: ["visibilidad", "branding", "startups"],
  },
  {
    id: "demo_sponsor",
    name: "Demo Sponsor",
    priceUsd: 900,
    includes: ["Demo de 5 minutos", "Stand", "5 entradas", "Lead capture básico"],
    bestFor: ["demos", "leads", "producto", "developers"],
  },
  {
    id: "strategic_ally",
    name: "Aliado Estratégico",
    priceUsd: 2500,
    includes: ["Marca en toda la campaña", "Sesión dedicada", "Datos de interés", "10 entradas"],
    bestFor: ["pipeline", "b2b", "sponsors", "empresas"],
  },
];

function tokenize(...parts: Array<string | undefined>): string[] {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9+]+/g)
    .filter((t) => t.length > 2);
}

function scoreOverlap(haystack: string[], needles: string[]): number {
  if (!needles.length) return 0;
  let score = 0;
  for (const n of needles) {
    if (haystack.some((h) => h.includes(n) || n.includes(h))) score += 1;
  }
  return score;
}

export function matchPeopleLogic(input: {
  goal?: string;
  offering?: string;
  lookingFor?: string;
  city?: string;
  limit?: number;
}) {
  const needles = tokenize(input.goal, input.offering, input.lookingFor);
  const city = input.city?.toLowerCase();
  const ranked = PEOPLE.map((person) => {
    const bag = tokenize(
      person.building,
      person.lookingFor,
      person.offering,
      person.role,
      ...person.skills,
      ...person.interests,
      ...person.tags,
    );
    let score = scoreOverlap(bag, needles);
    // Complementary fit: user's offer ≈ person's need, user's need ≈ person's offer
    score += scoreOverlap(tokenize(person.lookingFor), tokenize(input.offering)) * 2;
    score += scoreOverlap(tokenize(person.offering, ...person.skills), tokenize(input.lookingFor, input.goal)) * 2;
    if (city && person.city.toLowerCase() === city) score += 1;
    const why =
      score > 0
        ? `Encaja porque ${person.name} ${person.lookingFor.toLowerCase()} y ofrece ${person.offering.split(",")[0]} (skills: ${person.skills.slice(0, 3).join(", ")}).`
        : `Perfil en la comunidad: ${person.role} en ${person.city}.`;
    return { ...person, score, why };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 3);

  return {
    matches: ranked,
    reason: "Ranked by skills, complementary offer/need, interests, and city.",
  };
}

export function matchProjectsLogic(input: { goal?: string; skills?: string; limit?: number }) {
  const needles = tokenize(input.goal, input.skills);
  const ranked = PROJECTS.map((project) => {
    const owner = PEOPLE.find((p) => p.id === project.ownerPersonId);
    const bag = tokenize(project.title, project.summary, project.outcome, ...project.skills, ...project.tags);
    const score = scoreOverlap(bag, needles) || 0;
    return {
      ...project,
      ownerName: owner?.name ?? "",
      score,
      why:
        score > 0
          ? `Ejemplo real: ${project.outcome}`
          : `Proyecto de la comunidad por ${owner?.name ?? "un builder"}.`,
    };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 2);
  return { projects: ranked, reason: "Ranked by skill/outcome overlap with the need." };
}

export function matchSpeakersLogic(input: { goal?: string; limit?: number }) {
  const needles = tokenize(input.goal);
  const ranked = SPEAKERS.map((spk) => {
    const event = EVENTS.find((e) => e.id === spk.eventId);
    const bag = tokenize(spk.topic, ...spk.tags);
    const score = scoreOverlap(bag, needles);
    return {
      ...spk,
      eventName: event?.name ?? "",
      score,
      why: `Habla de "${spk.topic}" en ${event?.name ?? "un evento"}.`,
    };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 2);
  return { speakers: ranked, reason: "Ranked by topic/tag overlap." };
}

/**
 * Community match: people with the skills, projects that solved something similar, events.
 * Each item carries `howItHelps` for the role (seller: proof / allies; client: options to explore).
 * Packages are NOT matched unless the user explicitly asked for help (`includeHelpOptions`).
 */
export function matchCommunityLogic(input: {
  goal: string;
  track?: "builder" | "company";
  role?: "seller" | "client";
  clientName?: string;
  offering?: string;
  lookingFor?: string;
  city?: string;
  skills?: string;
  includeHelpOptions?: boolean;
}) {
  const role = input.role ?? (input.track === "company" ? "client" : "seller");
  const forWhom = input.clientName?.trim() || "tu cliente";
  const people = matchPeopleLogic({
    goal: input.goal,
    offering: input.offering,
    lookingFor: input.lookingFor ?? input.skills,
    city: input.city,
    limit: 3,
  });
  const projects = matchProjectsLogic({ goal: input.goal, skills: input.skills ?? input.lookingFor, limit: 2 });
  const speakers = matchSpeakersLogic({ goal: input.goal, limit: 2 });
  const events = matchEventsLogic({
    interest: input.goal,
    goal: input.goal,
    city: input.city ?? "Medellín",
    limit: 2,
  });
  const packages = input.includeHelpOptions
    ? matchNoshyPackagesLogic({ goal: input.goal, track: input.track, limit: 1 })
    : { packages: [] as ReturnType<typeof matchNoshyPackagesLogic>["packages"] };
  const peopleOut = people.matches.map((p) => ({
    ...p,
    howItHelps:
      role === "seller"
        ? `Aliado/a con experiencia en ${p.skills.slice(0, 2).join(" y ")}: puede validar tu enfoque o acompañarte con ${forWhom}.`
        : `Tiene los skills (${p.skills.slice(0, 3).join(", ")}) para ayudarte a resolverlo.`,
  }));
  const projectsOut = projects.projects.map((p) => ({
    ...p,
    howItHelps:
      role === "seller"
        ? `Caso real para citarle a ${forWhom}: ${p.outcome}`
        : `Resolvió algo parecido; explóralo como camino: ${p.outcome}`,
  }));

  const shownIds = [
    ...people.matches.map((m) => m.id),
    ...projects.projects.map((p) => p.id),
    ...speakers.speakers.map((s) => s.id),
    ...events.events.map((e) => e.id),
    ...packages.packages.map((p) => p.id),
  ];

  return {
    track: input.track ?? "builder",
    role,
    goal: input.goal,
    people: peopleOut,
    projects: projectsOut,
    speakers: speakers.speakers,
    events: events.events,
    packages: packages.packages,
    shownIds,
    reason: "Matched community skills, project examples, speakers and events to the need (packages only on request).",
  };
}

export function matchNoshyPackagesLogic(input: {
  goal?: string;
  track?: "builder" | "company";
  limit?: number;
}) {
  const needles = tokenize(input.goal);
  const ranked = NOSHY_PACKAGES.filter((p) => !input.track || p.track === "both" || p.track === input.track)
    .map((pkg) => {
      const bag = tokenize(pkg.name, pkg.summary, ...pkg.includes, ...pkg.bestFor);
      const score = scoreOverlap(bag, needles) + (input.track && pkg.track === input.track ? 1 : 0) || 1;
      return {
        ...pkg,
        score,
        why: pkg.summary,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 2);

  return { packages: ranked, reason: "Ranked NoShy packages by track and need keywords." };
}

export function matchEventsLogic(input: {
  interest?: string;
  city?: string;
  goal?: string;
  limit?: number;
}) {
  const needles = tokenize(input.interest, input.goal);
  const city = input.city?.toLowerCase();
  const ranked = EVENTS.map((event) => {
    const bag = tokenize(event.name, event.summary, ...event.forWhom, ...event.interests);
    let score = scoreOverlap(bag, needles);
    if (city && event.city.toLowerCase() === city) score += 2;
    return {
      ...event,
      score,
      why:
        score > 0
          ? `Relevante para "${input.interest || input.goal || "tu objetivo"}".`
          : `Evento de comunidad en ${event.city}.`,
    };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 3);

  return {
    events: ranked,
    reason: "Ranked by interest/goal overlap and city.",
  };
}

export function normalizePreContext(raw: Record<string, unknown> | undefined): PreContext {
  if (!raw) return {};
  const src = (raw.preContext as Record<string, unknown> | undefined) ?? raw;
  const pick = (k: string) => (typeof src[k] === "string" ? (src[k] as string) : undefined);
  return {
    persona: pick("persona"),
    building: pick("building"),
    lookingFor: pick("lookingFor"),
    offering: pick("offering"),
    successCriteria: pick("successCriteria"),
    challenge: pick("challenge"),
    helpType: pick("helpType"),
    urgency: pick("urgency"),
    budget: pick("budget"),
    targetAudience: pick("targetAudience"),
    growthGoal: pick("growthGoal"),
    city: pick("city") ?? "Medellín",
    preferredLanguage: pick("preferredLanguage") ?? "es",
    name: pick("name"),
    email: pick("email"),
    dealId: pick("dealId"),
    dealSummary: pick("dealSummary"),
    fitRoute: pick("fitRoute"),
    mode: pick("mode"),
    clientName: pick("clientName"),
  };
}

/**
 * Flatten pre-context into a session stateDelta for instruction templating.
 * Only sets keys that were actually provided so later turns don't wipe plan_status,
 * selected matches, etc.
 */
export function preContextToStateDelta(pre: PreContext): Record<string, unknown> {
  const delta: Record<string, unknown> = {};
  const set = (key: string, value: string | undefined) => {
    if (value !== undefined && value !== "") delta[key] = value;
  };

  set("persona", pre.persona);
  set("building", pre.building ?? pre.challenge);
  set("lookingFor", pre.lookingFor ?? pre.helpType ?? pre.growthGoal);
  set("offering", pre.offering ?? pre.targetAudience);
  set("successCriteria", pre.successCriteria);
  set("challenge", pre.challenge);
  set("helpType", pre.helpType);
  set("urgency", pre.urgency);
  set("budget", pre.budget);
  set("targetAudience", pre.targetAudience);
  set("growthGoal", pre.growthGoal);
  set("city", pre.city);
  set("user:preferred_language", pre.preferredLanguage);
  set("user_name", pre.name);
  set("user_email", pre.email);
  set("deal_id", pre.dealId);
  set("deal_summary", pre.dealSummary);
  set("fit_route", pre.fitRoute);
  set("mode", pre.mode);
  set("client_name", pre.clientName);
  return delta;
}
