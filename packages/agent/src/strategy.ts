/**
 * Strategy workflow: summary of the challenges → (user says yes) → strategy plan.
 *
 * The plan is NOT a pitch for our packages or people. It is a strategy + the questions the seller
 * should ask the client (or the client should answer), and community projects / people appear only as
 * support: proof to cite, options to explore, allies with the right skills.
 *
 * Two roles:
 *   seller — prepares a sale / meeting with a client, or wants to pitch better
 *   client — a company with a need (problem, talent, solution)
 *
 * Question banks are fixed (reliable, no invented content); the model adapts them with its own
 * hypotheses / angle / objections, which come in as tool arguments.
 */
import { PEOPLE, PROJECTS, matchNoshyPackagesLogic } from "./community.js";

export type Role = "seller" | "client";

export function inferRole(input: { role?: string; persona?: string; text?: string; clientName?: string; track?: string }): Role {
  if (input.role === "seller" || input.role === "client") return input.role;
  // Preparing a named client always means selling to that client.
  if (input.clientName?.trim()) return "seller";
  const p = `${input.persona ?? ""} ${input.text ?? ""}`.toLowerCase();
  if (/(vend|pitch|cliente|prospect|propuesta para|reuni[oó]n con|equipo de ventas|closing|cerrar)/.test(p)) return "seller";
  if (/(necesit|busco|buscamos|talento|contrat|soluci[oó]n|problema|freelancer|agencia|desarrollador|dev )/.test(p)) return "client";
  if (input.track === "company") return "client";
  return "seller";
}

// ─── Summary ────────────────────────────────────────────────────────────────

export type ContextSummary = {
  role: Role;
  roleLabel: string;
  headline: string;
  situation: string;
  challenges: string[];
  success: string;
  clientName: string;
  askPlan: string;
};

export function summarizeContextLogic(input: {
  role: Role;
  situation?: string;
  challenges?: string[];
  success?: string;
  clientName?: string;
  known?: { persona?: string; building?: string; lookingFor?: string; challenge?: string; successCriteria?: string; dealSummary?: string };
}): ContextSummary {
  const k = input.known ?? {};
  const client = input.clientName?.trim() ?? "";
  const situation =
    input.situation?.trim() ||
    [k.persona, k.building].filter(Boolean).join(" · ") ||
    k.dealSummary ||
    (input.role === "seller" ? "Preparas una venta" : "Tu empresa tiene una necesidad");
  const challenges = (input.challenges ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 3);
  if (!challenges.length) {
    const fallback = [k.challenge, k.lookingFor].filter(Boolean) as string[];
    challenges.push(...(fallback.length ? fallback : ["Aún por precisar"]));
  }
  const success = input.success?.trim() || k.successCriteria || "Por definir juntos";
  const headline =
    input.role === "seller"
      ? client
        ? `Tu venta a ${client}`
        : "Tu reto de venta"
      : "La necesidad de tu empresa";
  return {
    role: input.role,
    roleLabel: input.role === "seller" ? "Vendedor" : "Cliente",
    headline,
    situation,
    challenges,
    success,
    clientName: client,
    askPlan:
      input.role === "seller"
        ? `¿Quieres que te arme un plan para ${client ? `tu reunión con ${client}` : "esa venta"}?`
        : "¿Quieres que te arme un plan para resolverlo?",
  };
}

// ─── Question banks (fixed; the model adapts with extraQuestions) ───────────

type Q = { topic: string; question: string; why: string };

/**
 * Seller template questions — Alex Hormozi's CLOSER sales framework (Clarify, Label, Overview past
 * pain, Sell the vacation, Explain away concerns, Reinforce) + his value equation (dream outcome ×
 * perceived likelihood ÷ time delay × effort). The plan A2UI surface shows the first 5, in order.
 */
const SELLER_QUESTIONS = (client: string): Q[] => [
  {
    topic: "Aclarar (C)",
    question: `¿Por qué ${client} está buscando resolver esto justo ahora?`,
    why: "CLOSER · Clarify: que el cliente diga en voz alta su motivo; si no hay un porqué, no hay venta.",
  },
  {
    topic: "Nombrar el problema (L)",
    question: "Si lo resumo: hoy están en [situación] y quieren llegar a [resultado]. ¿Es así, o me falta algo?",
    why: "CLOSER · Label: pon nombre al problema con sus palabras; quien define el problema guía la solución.",
  },
  {
    topic: "Dolor pasado (O)",
    question: "¿Qué han probado antes para resolverlo y por qué no funcionó?",
    why: "CLOSER · Overview past pain: revela contra qué compites y por qué tu propuesta es distinta.",
  },
  {
    topic: "Resultado soñado (S)",
    question: "Si en 90 días esto funciona perfecto, ¿qué cambia en sus números y en su día a día?",
    why: "CLOSER · Sell the vacation + ecuación de valor (resultado soñado): vende el destino, no el avión.",
  },
  {
    topic: "Objeciones (E)",
    question: "¿Qué les impediría avanzar hoy: dinero, tiempo, confianza o alguien más que decide?",
    why: "CLOSER · Explain away concerns: saca la objeción real antes de que te la digan al final.",
  },
  {
    topic: "Probabilidad de éxito",
    question: "¿Qué necesitarían ver para confiar en que esto sí va a funcionar para ustedes?",
    why: "Ecuación de valor · probabilidad percibida: casos y garantías suben el valor sin bajar el precio.",
  },
  {
    topic: "Tiempo y esfuerzo",
    question: "¿Para cuándo necesitan el resultado y cuánto esfuerzo de su equipo pueden poner?",
    why: "Ecuación de valor · menos espera y menos esfuerzo = más valor; ajusta tu oferta a eso.",
  },
];

const CLIENT_QUESTIONS: Q[] = [
  { topic: "Problema", question: "¿Qué resultado exacto necesitas y para cuándo?", why: "Define el alcance antes de buscar soluciones." },
  { topic: "Restricciones", question: "¿Qué presupuesto, equipo interno y tecnología tienes hoy?", why: "Descarta opciones que no encajan desde el inicio." },
  { topic: "Construir o comprar", question: "¿Prefieres construirlo con tu equipo, contratar talento o adoptar una solución existente?", why: "Cambia por completo el camino y el costo." },
  { topic: "Criterio de éxito", question: "¿Cómo vas a medir que funcionó?", why: "Te da un criterio objetivo para comparar opciones." },
  { topic: "Riesgos", question: "¿Qué pasaría si el proyecto se retrasa o falla?", why: "Ayuda a decidir cuánto riesgo aceptar y qué validar primero." },
];

// ─── Plan ───────────────────────────────────────────────────────────────────

export type SupportProject = { id: string; title: string; outcome: string; ownerName: string; howItHelps: string };
export type SupportPerson = { id: string; name: string; role: string; skills: string[]; howItHelps: string };

export type StrategyPlan = {
  role: Role;
  headline: string;
  objective: string;
  clientName: string;
  /** seller */
  hypotheses?: string[];
  valueAngle?: string;
  objections?: { objection: string; answer: string }[];
  nextStep?: string;
  /** client */
  problem?: string;
  approaches?: { name: string; when: string; tradeoff: string }[];
  phases?: { name: string; outcome: string }[];
  /** both */
  questions: Q[];
  support: { projects: SupportProject[]; people: SupportPerson[] };
  /** Only when the user explicitly asked for help/packages. */
  helpOptions: { id: string; name: string; priceUsd: number; summary: string }[];
  createdAt: string;
};

export function supportFor(role: Role, client: string, ids: { peopleIds?: string[]; projectIds?: string[] }) {
  const forWhom = client || "tu cliente";
  const projects: SupportProject[] = PROJECTS.filter((p) => (ids.projectIds ?? []).includes(p.id)).map((p) => {
    const owner = PEOPLE.find((x) => x.id === p.ownerPersonId);
    return {
      id: p.id,
      title: p.title,
      outcome: p.outcome,
      ownerName: owner?.name ?? "",
      howItHelps:
        role === "seller"
          ? `Caso real para mostrarle a ${forWhom}: ${p.outcome}`
          : `Resolvió algo parecido — explóralo como referencia o camino: ${p.outcome}`,
    };
  });
  const people: SupportPerson[] = PEOPLE.filter((p) => (ids.peopleIds ?? []).includes(p.id)).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    skills: p.skills.slice(0, 4),
    howItHelps:
      role === "seller"
        ? `Aliado/a con experiencia en ${p.skills.slice(0, 2).join(" y ")}: puede validar tu enfoque o acompañarte en la demo.`
        : `Tiene los skills (${p.skills.slice(0, 3).join(", ")}) para ayudarte a construirlo o asesorarte.`,
  }));
  return { projects, people };
}

export function buildStrategyPlanLogic(input: {
  role: Role;
  goal: string;
  clientName?: string;
  challenges?: string[];
  hypotheses?: string[];
  valueAngle?: string;
  objections?: { objection: string; answer: string }[];
  extraQuestions?: string[];
  nextStep?: string;
  approaches?: { name: string; when: string; tradeoff: string }[];
  phases?: { name: string; outcome: string }[];
  peopleIds?: string[];
  projectIds?: string[];
  includeHelpOptions?: boolean;
}): StrategyPlan {
  const client = input.clientName?.trim() ?? "";
  const challenges = (input.challenges ?? []).filter(Boolean);
  const extra: Q[] = (input.extraQuestions ?? [])
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((question) => ({ topic: "Específica", question, why: "Ajustada a lo que nos contaste." }));
  const support = supportFor(input.role, client, input);
  const helpOptions = input.includeHelpOptions
    ? matchNoshyPackagesLogic({ goal: input.goal, track: input.role === "seller" ? "builder" : "company", limit: 1 }).packages.map((p) => ({
        id: p.id,
        name: p.name,
        priceUsd: p.priceUsd,
        summary: p.summary,
      }))
    : [];
  const base = { role: input.role, objective: input.goal, clientName: client, support, helpOptions, createdAt: new Date().toISOString() };

  if (input.role === "seller") {
    const proof = support.projects[0];
    return {
      ...base,
      headline: client ? `Plan para tu reunión con ${client}` : "Plan para tu próxima venta",
      hypotheses: input.hypotheses?.length
        ? input.hypotheses.slice(0, 3)
        : challenges.length
          ? challenges.map((c) => `${client || "El cliente"} probablemente necesita resolver: ${c}`)
          : [`${client || "El cliente"} busca ${input.goal}`],
      questions: [...SELLER_QUESTIONS(client || "el cliente"), ...extra],
      valueAngle:
        input.valueAngle?.trim() ||
        `Empieza por su problema, no por tu producto: muestra que entiendes "${challenges[0] ?? input.goal}" y cómo se ve el resultado${proof ? `, con un caso real como "${proof.title}"` : ""}.`,
      objections: input.objections?.length
        ? input.objections.slice(0, 3)
        : [
            { objection: "Es caro", answer: "Vuelve a su resultado soñado y a lo que ya les costó lo que probaron antes: el precio se compara con eso, no con cero." },
            { objection: "No es el momento", answer: "Propón un primer paso pequeño y medible en lugar del proyecto completo." },
            { objection: "Lo tengo que consultar", answer: "Ofrece preparar un resumen de una página para quien decide." },
          ],
      nextStep: input.nextStep?.trim() || `Agendar la reunión con ${client || "el cliente"} y abrir con las 2 primeras preguntas.`,
    };
  }

  return {
    ...base,
    headline: "Plan para resolver tu necesidad",
    problem: challenges[0] ? `${challenges[0]}${input.goal ? ` — objetivo: ${input.goal}` : ""}` : input.goal,
    approaches: input.approaches?.length
      ? input.approaches.slice(0, 3)
      : [
          { name: "Construir con tu equipo", when: "Si es parte central de tu negocio y tienes capacidad interna.", tradeoff: "Más control, más tiempo." },
          { name: "Contratar talento", when: "Si te falta un skill puntual por un tiempo definido.", tradeoff: "Rápido de arrancar; requiere buen brief." },
          { name: "Adoptar algo ya probado", when: "Si alguien ya resolvió un caso parecido.", tradeoff: "Lo más rápido; menos a la medida." },
        ],
    questions: [...CLIENT_QUESTIONS, ...extra],
    phases: input.phases?.length
      ? input.phases.slice(0, 4)
      : [
          { name: "1 · Definir", outcome: "Brief de una página con objetivo, alcance y métrica." },
          { name: "2 · Explorar", outcome: "Revisar los proyectos y personas de abajo; elegir un camino." },
          { name: "3 · Piloto", outcome: "Primera versión pequeña y medible en 2–4 semanas." },
          { name: "4 · Escalar", outcome: "Ampliar solo si el piloto cumple la métrica." },
        ],
  };
}

/** One line for voice / email: never the full plan. */
export function planSpokenSummary(plan: StrategyPlan) {
  const support = [plan.support.projects[0] && `el caso "${plan.support.projects[0].title}"`, plan.support.people[0] && `${plan.support.people[0].name}`]
    .filter(Boolean)
    .join(" y ");
  return `${plan.headline}. ${plan.questions.length} preguntas clave${support ? `, y de la comunidad ${support} como apoyo` : ""}.`;
}

/** Plain-text version for email. */
export function planAsText(plan: StrategyPlan) {
  const lines = [plan.headline, "", `Objetivo: ${plan.objective}`];
  if (plan.hypotheses?.length) lines.push("", "Qué probablemente necesita:", ...plan.hypotheses.map((h) => `- ${h}`));
  if (plan.problem) lines.push("", `Problema: ${plan.problem}`);
  if (plan.approaches?.length) lines.push("", "Caminos posibles:", ...plan.approaches.map((a) => `- ${a.name}: ${a.when} (${a.tradeoff})`));
  lines.push("", "Preguntas clave:", ...plan.questions.map((q) => `- [${q.topic}] ${q.question}`));
  if (plan.valueAngle) lines.push("", `Ángulo de valor: ${plan.valueAngle}`);
  if (plan.objections?.length) lines.push("", "Objeciones probables:", ...plan.objections.map((o) => `- "${o.objection}" → ${o.answer}`));
  if (plan.phases?.length) lines.push("", "Fases:", ...plan.phases.map((p) => `- ${p.name}: ${p.outcome}`));
  if (plan.support.projects.length || plan.support.people.length) {
    lines.push("", "Apoyo de la comunidad:");
    lines.push(...plan.support.projects.map((p) => `- Proyecto: ${p.title} — ${p.howItHelps}`));
    lines.push(...plan.support.people.map((p) => `- ${p.name} (${p.role}) — ${p.howItHelps}`));
  }
  if (plan.nextStep) lines.push("", `Siguiente paso: ${plan.nextStep}`);
  return lines.join("\n");
}


// ─── Product build plan ─────────────────────────────────────────────────────

/**
 * Plan to BUILD the product/solution (not just win the meeting). Same community support,
 * framed with Hormozi's value equation: dream outcome × likelihood ÷ (time delay × effort).
 * No prices are invented: a budget range only appears if the user gave one.
 */
export type ProductPlan = {
  kind: "product";
  headline: string;
  clientName: string;
  problem: string;
  outcome: string;
  scope: { now: string[]; later: string[] };
  approach: { name: string; why: string };
  phases: { name: string; duration: string; outcome: string; doneWhen: string }[];
  team: { skill: string; who: string }[];
  risks: string[];
  value: { dreamOutcome: string; likelihood: string; timeDelay: string; effort: string };
  budget: string;
  nextStep: string;
  support: { projects: SupportProject[]; people: SupportPerson[] };
  createdAt: string;
};

export type ProductPlanInput = {
  goal: string;
  problem?: string;
  outcome?: string;
  mvpScope?: string[];
  laterScope?: string[];
  approach?: { name: string; why: string };
  phases?: { name: string; duration?: string; outcome: string; doneWhen?: string }[];
  skillsNeeded?: string[];
  risks?: string[];
  budget?: string;
  whoBuilds?: string;
  nextStep?: string;
  clientName?: string;
  challenges?: string[];
  peopleIds?: string[];
  projectIds?: string[];
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function buildProductPlanLogic(input: ProductPlanInput): ProductPlan {
  const client = input.clientName?.trim() ?? "";
  const support = supportFor("client", client, input);
  const problem = input.problem?.trim() || input.challenges?.[0] || input.goal;
  const outcome = input.outcome?.trim() || `En 90 días: ${input.goal}, con una métrica acordada.`;
  const proof = support.projects[0];

  // Each needed skill → a community person who has it (from the matched support), else open.
  const skills = (input.skillsNeeded ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const team = skills.map((skill) => {
    const person = PEOPLE.filter((p) => support.people.some((s) => s.id === p.id)).find((p) =>
      p.skills.some((k) => norm(k).includes(norm(skill)) || norm(skill).includes(norm(k))),
    );
    return { skill, who: person ? `${person.name} · ${person.role}` : "Por definir (buscar en la comunidad)" };
  });

  return {
    kind: "product",
    headline: client ? `Construir la solución de ${client}` : `Construir: ${input.goal}`,
    clientName: client,
    problem,
    outcome,
    scope: {
      now: input.mvpScope?.length ? input.mvpScope.slice(0, 4) : [`La versión más pequeña que resuelva: ${problem}`],
      later: input.laterScope?.slice(0, 4) ?? [],
    },
    approach: input.approach ?? {
      name: proof ? "Partir de un caso ya probado" : "MVP pequeño con talento de la comunidad",
      why: proof
        ? `"${proof.title}" resolvió algo parecido: reduce riesgo y tiempo.`
        : "Validar rápido con poco esfuerzo antes de invertir en la versión completa.",
    },
    phases: input.phases?.length
      ? input.phases.slice(0, 4).map((p) => ({ name: p.name, duration: p.duration ?? "", outcome: p.outcome, doneWhen: p.doneWhen ?? "" }))
      : [
          { name: "1 · Descubrimiento", duration: "1 semana", outcome: "Brief de una página: usuario, problema, métrica.", doneWhen: "El cliente aprueba alcance y métrica." },
          { name: "2 · MVP", duration: "2–4 semanas", outcome: "Primera versión con el alcance de ahora.", doneWhen: "Funciona con datos reales en un caso." },
          { name: "3 · Piloto", duration: "2–4 semanas", outcome: "Usuarios reales lo usan; medimos.", doneWhen: "Cumple la métrica acordada." },
          { name: "4 · Escala", duration: "Según piloto", outcome: "Ampliar alcance (lo de después).", doneWhen: "Solo si el piloto funcionó." },
        ],
    team,
    risks: input.risks?.length
      ? input.risks.slice(0, 3)
      : ["Alcance que crece antes de validar", "Datos o integraciones del cliente no disponibles a tiempo"],
    value: {
      dreamOutcome: outcome,
      likelihood: proof ? `Caso real de la comunidad: "${proof.title}" + piloto medible.` : "Piloto medible antes de escalar.",
      timeDelay: "Primer resultado visible en el MVP (2–4 semanas), no al final del proyecto.",
      effort: input.whoBuilds?.trim() || "Lo construye talento de la comunidad; el cliente solo valida y aporta datos.",
    },
    budget: input.budget?.trim() ?? "",
    nextStep: input.nextStep?.trim() || "Agendar la sesión de descubrimiento (1 semana) para cerrar alcance y métrica.",
    support,
    createdAt: new Date().toISOString(),
  };
}

export function productSpokenSummary(plan: ProductPlan) {
  const who = plan.team.find((t) => !t.who.startsWith("Por definir"))?.who;
  return `${plan.headline}. ${plan.phases.length} fases, empezando por un MVP de ${plan.phases[1]?.duration || "pocas semanas"}${who ? `, con ${who} como apoyo` : ""}.`;
}

export function productPlanAsText(plan: ProductPlan) {
  const lines = [plan.headline, "", `Problema: ${plan.problem}`, `Resultado (90 días): ${plan.outcome}`];
  lines.push("", "Alcance ahora (MVP):", ...plan.scope.now.map((s) => `- ${s}`));
  if (plan.scope.later.length) lines.push("Después:", ...plan.scope.later.map((s) => `- ${s}`));
  lines.push("", `Camino: ${plan.approach.name} — ${plan.approach.why}`);
  lines.push("", "Fases:", ...plan.phases.map((p) => `- ${p.name}${p.duration ? ` (${p.duration})` : ""}: ${p.outcome}${p.doneWhen ? ` · Listo cuando: ${p.doneWhen}` : ""}`));
  if (plan.team.length) lines.push("", "Equipo / skills:", ...plan.team.map((t) => `- ${t.skill}: ${t.who}`));
  lines.push("", "Riesgos a validar primero:", ...plan.risks.map((r) => `- ${r}`));
  if (plan.budget) lines.push("", `Presupuesto: ${plan.budget}`);
  lines.push("", `Siguiente paso: ${plan.nextStep}`);
  return lines.join("\n");
}
