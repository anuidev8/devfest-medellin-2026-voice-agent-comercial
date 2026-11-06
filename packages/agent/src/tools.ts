import { FunctionTool, type ToolContext } from "@google/adk";
import { z } from "zod";
import { matchCommunityLogic } from "./community.js";
import { applyMatchFocus, inferMatchFocus } from "./match-focus.js";
import {
  buildProductPlanLogic,
  buildStrategyPlanLogic,
  inferRole,
  planAsText,
  planSpokenSummary,
  productPlanAsText,
  productSpokenSummary,
  summarizeContextLogic,
  type ProductPlan,
  type Role,
  type StrategyPlan,
} from "./strategy.js";
import { updateDeal } from "./deal-store.js";
import {
  applyFactToState,
  assessContextLogic,
  computeDiscoveryBrief,
  DISCOVERY_SLOTS,
  inferTrack,
  type DiscoveryFact,
  type DiscoveryState,
  type DiscoveryTrack,
} from "./discovery-playbook.js";
import { bookGoogleMeet } from "./calendar-book.js";
import { sendEmail } from "./email.js";
import { analyzeTranscript } from "./meeting-analyst.js";
import { fetchMeetTranscriptText, listRecentMeetTranscripts } from "./meet-transcript.js";

const MAX_TOOL_TRANSCRIPT_CHARS = 200_000;

function applyDealAnalysis(
  toolContext: ToolContext | undefined,
  analysis: Awaited<ReturnType<typeof analyzeTranscript>>,
  source: { kind: "meet" | "paste"; conferenceRecord?: string },
) {
  const { clientName, brief, fit, summary, evidence } = analysis;
  toolContext?.state.set("client_name", clientName);
  toolContext?.state.set("deal_summary", summary);
  toolContext?.state.set("fit_route", fit.route);
  toolContext?.state.set("challenge", [brief.currentState, brief.tried && `Ya probó: ${brief.tried}`].filter(Boolean).join(". "));
  toolContext?.state.set("building", brief.scope);
  toolContext?.state.set("successCriteria", brief.targetResult);
  toolContext?.state.set("budget", brief.budget);
  toolContext?.state.set("urgency", brief.timing);
  toolContext?.state.set("lookingFor", brief.targetResult || brief.scope);
  toolContext?.state.set("mode", "client");
  toolContext?.state.set("current_intent", "deal_brief");
  toolContext?.state.set("temp:last_deal_analysis", { ...analysis, source });
  writeDiscovery(toolContext, { stage: "discovery" });
  saveDeal(toolContext, {
    status: "transcript_analyzed",
    clientName,
    summary,
    fitRoute: fit.route,
    source: source.kind,
    conferenceRecord: source.conferenceRecord,
  });
  return { status: "ok" as const, clientName, brief, fit, summary, evidence, source };
}

/**
 * Demo delivery: until Resend / Google Calendar are configured, email + meeting succeed as
 * clearly-flagged mocks (mock: true) so the full journey can be shown. MOCK_DELIVERY=0 disables it.
 */
const mockDelivery = () => process.env.MOCK_DELIVERY !== "0";

function saveDeal(toolContext: ToolContext | undefined, patch: Record<string, unknown>) {
  const dealId = toolContext?.state.get<string>("deal_id");
  if (dealId) updateDeal(dealId, patch);
}

function readFacts(toolContext?: ToolContext): DiscoveryFact[] {
  return (toolContext?.state.get<DiscoveryFact[]>("discovery_facts") as DiscoveryFact[] | undefined) ?? [];
}

function readDiscovery(toolContext?: ToolContext): Partial<DiscoveryState> {
  return (toolContext?.state.get<Partial<DiscoveryState>>("discovery") as Partial<DiscoveryState> | undefined) ?? {};
}

function writeDiscovery(toolContext: ToolContext | undefined, patch: Partial<DiscoveryState>) {
  const current = readDiscovery(toolContext);
  toolContext?.state.set("discovery", { ...current, ...patch });
}

// ─── Discovery (SETI-style) ──────────────────────────────────────────────────

/** Same brief inputs the discovery guide uses (state + saved facts). */
function currentBrief(toolContext?: ToolContext) {
  const track = inferTrack({
    persona: toolContext?.state.get<string>("persona"),
    track: readDiscovery(toolContext).track,
  });
  return computeDiscoveryBrief({
    track,
    clientName: toolContext?.state.get<string>("client_name") || toolContext?.state.get<string>("user_name"),
    objective: toolContext?.state.get<string>("lookingFor") || toolContext?.state.get<string>("growthGoal"),
    needsContext: toolContext?.state.get<string>("challenge") || toolContext?.state.get<string>("building"),
    building: toolContext?.state.get<string>("building"),
    lookingFor: toolContext?.state.get<string>("lookingFor"),
    facts: readFacts(toolContext),
    discovery: readDiscovery(toolContext),
  });
}

export const assessContext = new FunctionTool({
  name: "assess_context",
  description:
    "Revisa si YA hay contexto suficiente (quién es / la empresa, qué necesita el cliente, el dolor). Llámala ANTES de show_discovery_guide, y después de guardar con save_meeting_fact lo que el usuario contó o pegó de una vez. next=summary → NO hagas discovery: llama summarize_context ya. next=ask_missing → pregunta SOLO lo de missing (una a la vez). next=discovery → show_discovery_guide.",
  parameters: z.object({}),
  execute: async (_input, toolContext?: ToolContext) => {
    const hasDealBrief = !!toolContext?.state.get<string>("deal_summary");
    const readiness = assessContextLogic(currentBrief(toolContext), hasDealBrief);
    toolContext?.state.set("context_ready", readiness.ready);
    return {
      ...readiness,
      instructionForModel:
        readiness.next === "summary"
          ? "Ya hay contexto completo: no hagas preguntas de discovery. Llama summarize_context ahora y pregunta \"¿Lo entendí bien?\"."
          : readiness.next === "ask_missing"
            ? "Falta poco: pregunta solo lo de missing, una pregunta a la vez; guarda con save_meeting_fact y vuelve a llamar assess_context."
            : "Falta contexto: llama show_discovery_guide.",
    };
  },
});

export const showDiscoveryGuide = new FunctionTool({
  name: "show_discovery_guide",
  description:
    "Devuelve las preguntas de discovery pendientes (spokenQuestions, ordenadas: la primera es la siguiente a hacer) para el track builder (founder/proyecto propio) o company (empresa). Úsala al inicio, al cambiar de track, o si el usuario pide ver las preguntas. Haz solo la primera; lista todas únicamente si el usuario lo pide.",
  parameters: z.object({
    track: z.enum(["builder", "company"]).optional().describe("Track de discovery"),
  }),
  execute: async ({ track }, toolContext?: ToolContext) => {
    const inferred =
      track ??
      inferTrack({
        persona: toolContext?.state.get<string>("persona"),
        track: readDiscovery(toolContext).track,
      });
    writeDiscovery(toolContext, { track: inferred, stage: "discovery" });
    toolContext?.state.set("discovery_track", inferred);

    const brief = computeDiscoveryBrief({
      track: inferred,
      clientName: toolContext?.state.get<string>("user_name"),
      objective: toolContext?.state.get<string>("lookingFor") || toolContext?.state.get<string>("growthGoal"),
      needsContext:
        toolContext?.state.get<string>("challenge") || toolContext?.state.get<string>("building"),
      building: toolContext?.state.get<string>("building"),
      lookingFor: toolContext?.state.get<string>("lookingFor"),
      facts: readFacts(toolContext),
      discovery: readDiscovery(toolContext),
    });

    // Prefer required open slots first; fall back to first slots of the track.
    const questions =
      brief.openQuestions.length > 0
        ? brief.openQuestions
        : brief.slots.filter((s) => s.required).map((s) => ({
            id: s.id,
            label: s.label,
            question: s.question,
          }));

    const spokenQuestions = questions
      .map((q, i) => `${i + 1}. ${q.question}`)
      .join("\n");

    const payload = {
      ...brief,
      questions,
      spokenQuestions,
      instructionForModel:
        "Haz SOLO la primera pregunta de spokenQuestions, en tono conversacional (no leas la lista). Escucha, resume lo que entendiste en una frase y profundiza (\"¿por qué?\", \"¿qué impacto tiene?\") antes de pasar a la siguiente. No digas que están en pantalla si no hay UI.",
    };

    toolContext?.state.set("discovery_brief", payload);
    toolContext?.state.set("current_intent", "discovery");
    return payload;
  },
});

export const saveMeetingFact = new FunctionTool({
  name: "save_meeting_fact",
  description:
    "Guarda lo que respondió el usuario a una pregunta de discovery. Llámala una vez por dato útil, en el mismo turno en que lo dice. Ej.: \"soy founder de una app\" → factType=profile, slotId=quien; \"quiero cerrar 3 clientes este mes\" → factType=need, slotId=objetivo; \"no sé hacer el pitch\" → factType=skill_gap, slotId=proyecto; \"tengo unos 2.000 USD\" → factType=budget, slotId=cierre. value = la respuesta resumida en palabras del usuario.",
  parameters: z.object({
    factType: z
      .enum(["profile", "need", "pain", "stakeholder", "next_step", "skill_gap", "budget"])
      .describe("profile = quién es (founder, empresa, rol); need = objetivo; pain = qué lo frena; skill_gap = qué no sabe hacer"),
    value: z.string().describe("Valor capturado"),
    slotId: z
      .enum(DISCOVERY_SLOTS.map((s) => s.id) as [string, ...string[]])
      .optional()
      .describe("Pregunta del playbook a la que responde (id del slot)"),
  }),
  execute: async ({ factType, value, slotId }, toolContext?: ToolContext) => {
    const facts = applyFactToState(readFacts(toolContext), { factType, value, slotId });
    toolContext?.state.set("discovery_facts", facts);

    // Mirror key facts into instruction template keys
    // Keep an intake persona (member / company_*) if the web form already set one.
    if ((slotId === "quien" || factType === "profile") && !toolContext?.state.get<string>("persona")) {
      toolContext?.state.set("persona", value);
    }
    if (slotId === "objetivo" || factType === "need") toolContext?.state.set("lookingFor", value);
    if (slotId === "dolor" || factType === "pain") toolContext?.state.set("challenge", value);
    if (slotId === "proyecto" || slotId === "ayuda") toolContext?.state.set("building", value);
    if (factType === "skill_gap") toolContext?.state.set("lookingFor", value);
    if (factType === "budget") toolContext?.state.set("budget", value);

    const track = (readDiscovery(toolContext).track ?? "builder") as DiscoveryTrack;
    const brief = computeDiscoveryBrief({
      track,
      clientName: toolContext?.state.get<string>("user_name"),
      objective: toolContext?.state.get<string>("lookingFor"),
      needsContext: toolContext?.state.get<string>("challenge"),
      building: toolContext?.state.get<string>("building"),
      lookingFor: toolContext?.state.get<string>("lookingFor"),
      facts,
      discovery: readDiscovery(toolContext),
    });
    toolContext?.state.set("discovery_brief", brief);
    return { saved: true, factType, value, slotId, brief };
  },
});

export const matchCommunity = new FunctionTool({
  name: "match_community",
  description:
    "Busca en la comunidad. Usa focus=projects si solo pidió proyectos/casos; focus=people si solo personas/skills; focus=all (o al armar el plan) para ambos. No inventa datos. Paquetes solo con includeHelpOptions=true.",
  parameters: z.object({
    goal: z.string().describe("Necesidad o objetivo del cliente"),
    focus: z
      .enum(["projects", "people", "all"])
      .optional()
      .describe("projects | people | all — qué secciones mostrar en UI"),
    track: z.enum(["builder", "company"]).optional(),
    role: z.enum(["seller", "client"]).optional().describe("seller = prepara una venta; client = empresa con una necesidad"),
    includeHelpOptions: z.boolean().optional().describe("true SOLO si el usuario pidió explícitamente apoyo/paquetes de NoShy"),
    offering: z.string().optional(),
    lookingFor: z.string().optional(),
    skills: z.string().optional(),
    city: z.string().optional(),
  }),
  execute: async (input, toolContext?: ToolContext) => {
    const track =
      input.track ??
      (readDiscovery(toolContext).track as DiscoveryTrack | undefined) ??
      inferTrack({ persona: toolContext?.state.get<string>("persona"), text: input.goal });

    const role = resolveRole(toolContext, input.role, input.goal);
    const focus = inferMatchFocus({
      focus: input.focus,
      goal: input.goal,
      lookingFor: input.lookingFor,
      skills: input.skills,
    });
    const raw = matchCommunityLogic({
      goal: [input.goal, toolContext?.state.get<string>("deal_summary")].filter(Boolean).join(". "),
      track,
      role,
      clientName: toolContext?.state.get<string>("client_name"),
      includeHelpOptions: input.includeHelpOptions,
      offering: input.offering ?? toolContext?.state.get<string>("offering"),
      lookingFor: input.lookingFor ?? toolContext?.state.get<string>("lookingFor"),
      skills: input.skills,
      city: input.city ?? toolContext?.state.get<string>("city") ?? "Medellín",
    });
    const result = applyMatchFocus(raw, focus);

    writeDiscovery(toolContext, {
      track,
      stage: "match",
      shownItemIds: result.shownIds,
      recommendationShown: false,
    });
    toolContext?.state.set("selected_people", result.people.map((p) => p.id));
    toolContext?.state.set("selected_events", result.events.map((e) => e.id));
    toolContext?.state.set("selected_packages", result.packages.map((p) => p.id));
    toolContext?.state.set("selected_projects", result.projects.map((p) => p.id));
    toolContext?.state.set("temp:last_community_match", result);
    toolContext?.state.set("current_intent", "match");
    return result;
  },
});

function resolveRole(toolContext: ToolContext | undefined, explicit?: string, text?: string): Role {
  const role = inferRole({
    role: explicit ?? toolContext?.state.get<string>("role"),
    persona: toolContext?.state.get<string>("persona"),
    clientName: toolContext?.state.get<string>("client_name"),
    track: readDiscovery(toolContext).track,
    text: [text, toolContext?.state.get<string>("lookingFor")].filter(Boolean).join(" "),
  });
  toolContext?.state.set("role", role);
  return role;
}

export const summarizeContext = new FunctionTool({
  name: "summarize_context",
  description:
    "Etapa RESUMEN: muestra una tarjeta corta con la situación, los retos (1–3) y cómo se ve el éxito, en palabras del usuario. Llámala cuando discovery tenga objetivo y dolor claros, ANTES de cualquier plan. Después pregunta si lo entendiste bien y luego usa askPlan para preguntar si quiere el plan. Vuelve a llamarla si el usuario corrige algo.",
  parameters: z.object({
    role: z.enum(["seller", "client"]).optional().describe("seller = prepara una venta a un cliente; client = empresa con una necesidad"),
    situation: z.string().describe("Una frase: quién es y, si aplica, a qué cliente le vende"),
    challenges: z.array(z.string()).describe("1–3 retos concretos, en palabras del usuario"),
    success: z.string().describe("Cómo se ve el éxito (número o señal); cadena vacía si no lo dijo"),
  }),
  execute: async ({ role, situation, challenges, success }, toolContext?: ToolContext) => {
    const resolved = resolveRole(toolContext, role, `${situation} ${challenges.join(" ")}`);
    const summary = summarizeContextLogic({
      role: resolved,
      situation,
      challenges,
      success,
      clientName: toolContext?.state.get<string>("client_name"),
      known: {
        persona: toolContext?.state.get<string>("persona"),
        building: toolContext?.state.get<string>("building"),
        lookingFor: toolContext?.state.get<string>("lookingFor"),
        challenge: toolContext?.state.get<string>("challenge"),
        successCriteria: toolContext?.state.get<string>("successCriteria"),
        dealSummary: toolContext?.state.get<string>("deal_summary"),
      },
    });
    toolContext?.state.set("context_summary", summary);
    toolContext?.state.set("current_intent", "summary");
    writeDiscovery(toolContext, { stage: "summary" });
    return summary;
  },
});

/**
 * Community support for a plan. match_community stores its picks in session.state, but when the
 * model calls match_community and the plan tool in parallel (same turn) — or the match was focused
 * on only people / only projects — those lists are empty. Fill the gaps with a fresh match so the
 * plan always carries real projects and people with skills.
 */
function supportIds(toolContext: ToolContext | undefined, goal: string, role: Role, skills?: string) {
  let peopleIds = toolContext?.state.get<string[]>("selected_people") ?? [];
  let projectIds = toolContext?.state.get<string[]>("selected_projects") ?? [];
  if (peopleIds.length && projectIds.length) return { peopleIds, projectIds };
  const match = matchCommunityLogic({
    goal: [goal, toolContext?.state.get<string>("deal_summary"), toolContext?.state.get<string>("lookingFor")].filter(Boolean).join(". "),
    track: (readDiscovery(toolContext).track as DiscoveryTrack | undefined) ?? (role === "client" ? "company" : "builder"),
    role,
    clientName: toolContext?.state.get<string>("client_name"),
    offering: toolContext?.state.get<string>("offering"),
    lookingFor: toolContext?.state.get<string>("lookingFor"),
    skills,
    city: toolContext?.state.get<string>("city") ?? "Medellín",
  });
  if (!peopleIds.length) peopleIds = match.people.slice(0, 3).map((p) => p.id);
  if (!projectIds.length) projectIds = match.projects.slice(0, 3).map((p) => p.id);
  toolContext?.state.set("selected_people", peopleIds);
  toolContext?.state.set("selected_projects", projectIds);
  return { peopleIds, projectIds };
}

export const buildStrategyPlan = new FunctionTool({
  name: "build_strategy_plan",
  description:
    "Etapa PLAN: SOLO después de que el usuario aceptó que le armes un plan. Genera una estrategia (NO vende paquetes ni personas): vendedor → hipótesis de necesidad, preguntas para el cliente, ángulo de valor, objeciones y siguiente paso; cliente → problema, caminos posibles, preguntas/criterios y fases. Proyectos y personas de la comunidad (de match_community) van como apoyo. En voz di solo el headline y una frase.",
  parameters: z.object({
    goal: z.string().describe("Objetivo del plan en palabras del usuario"),
    role: z.enum(["seller", "client"]).optional(),
    hypotheses: z.array(z.string()).optional().describe("Vendedor: 1–3 hipótesis de lo que el cliente necesita"),
    valueAngle: z.string().optional().describe("Vendedor: cómo contar el valor para ESTE cliente, en una frase"),
    objections: z
      .array(z.object({ objection: z.string(), answer: z.string() }))
      .optional()
      .describe("Vendedor: objeciones probables de este cliente y cómo responderlas"),
    extraQuestions: z.array(z.string()).optional().describe("Hasta 3 preguntas específicas de este caso, además del banco fijo"),
    nextStep: z.string().optional(),
    approaches: z
      .array(z.object({ name: z.string(), when: z.string(), tradeoff: z.string() }))
      .optional()
      .describe("Cliente: caminos posibles (construir / contratar / adoptar)"),
    includeHelpOptions: z.boolean().optional().describe("true SOLO si el usuario pidió apoyo/paquetes de NoShy"),
  }),
  execute: async (input, toolContext?: ToolContext) => {
    const role = resolveRole(toolContext, input.role, input.goal);
    const summary = toolContext?.state.get<{ challenges?: string[] }>("context_summary");
    const plan = buildStrategyPlanLogic({
      ...input,
      role,
      clientName: toolContext?.state.get<string>("client_name"),
      challenges: summary?.challenges ?? [toolContext?.state.get<string>("challenge") ?? ""].filter(Boolean),
      ...supportIds(toolContext, input.goal, role),
    });
    writeDiscovery(toolContext, { stage: "proposal", recommendationShown: true });
    toolContext?.state.set("strategy_plan", plan);
    toolContext?.state.set("plan_status", "draft");
    toolContext?.state.set("plan_confirmed", false);
    toolContext?.state.set("current_intent", "plan");
    saveDeal(toolContext, { status: "plan_ready", plan: plan.headline, role });
    return { ...plan, spoken: planSpokenSummary(plan) };
  },
});

export const buildProductPlan = new FunctionTool({
  name: "build_product_plan",
  description:
    "Plan para CONSTRUIR el producto/solución (no solo la reunión). SOLO tras un sí del usuario a ese plan. Problema → resultado a 90 días, alcance del MVP (ahora / después), camino, fases con criterio de listo, equipo por skill (personas de match_community), riesgos y siguiente paso, con la ecuación de valor de Hormozi. Llama antes match_community(focus=people, skills=los skills que hacen falta). NO inventes precios: budget solo si el usuario lo dio. En voz di solo el headline y una frase.",
  parameters: z.object({
    goal: z.string().describe("Qué hay que construir, en palabras del usuario"),
    problem: z.string().optional(),
    outcome: z.string().optional().describe("Resultado a 90 días con una métrica"),
    mvpScope: z.array(z.string()).optional().describe("Lo mínimo para el MVP (máx. 4)"),
    laterScope: z.array(z.string()).optional().describe("Lo que va después del piloto"),
    approach: z.object({ name: z.string(), why: z.string() }).optional(),
    phases: z
      .array(z.object({ name: z.string(), duration: z.string().optional(), outcome: z.string(), doneWhen: z.string().optional() }))
      .optional(),
    skillsNeeded: z.array(z.string()).optional().describe("Skills necesarios para construirlo"),
    risks: z.array(z.string()).optional(),
    budget: z.string().optional().describe("Solo si el usuario dio presupuesto"),
    whoBuilds: z.string().optional(),
    nextStep: z.string().optional(),
  }),
  execute: async (input, toolContext?: ToolContext) => {
    const summary = toolContext?.state.get<{ challenges?: string[] }>("context_summary");
    const plan = buildProductPlanLogic({
      ...input,
      clientName: toolContext?.state.get<string>("client_name"),
      challenges: summary?.challenges ?? [toolContext?.state.get<string>("challenge") ?? ""].filter(Boolean),
      ...supportIds(toolContext, input.goal, resolveRole(toolContext, undefined, input.goal), input.skillsNeeded?.join(" ")),
    });
    toolContext?.state.set("product_plan", plan);
    toolContext?.state.set("product_plan_status", "draft");
    toolContext?.state.set("current_intent", "product_plan");
    saveDeal(toolContext, { status: "product_plan_ready", productPlan: plan.headline });
    return { ...plan, spoken: productSpokenSummary(plan) };
  },
});

export const confirmPlan = new FunctionTool({
  name: "confirm_plan",
  description:
    "Registra la respuesta del usuario a \"¿confirmas este plan?\". Llámala solo después de que el usuario diga explícitamente sí (true) o no (false). which=product para el plan de producto (\"Apruebo el plan de producto…\"); por defecto el plan de la reunión.",
  parameters: z.object({
    confirmed: z.boolean(),
    which: z.enum(["meeting", "product"]).optional(),
  }),
  execute: async ({ confirmed, which }, toolContext?: ToolContext) => {
    if (which === "product") {
      toolContext?.state.set("product_plan_status", confirmed ? "confirmed" : "draft");
      if (confirmed) toolContext?.state.set("plan_confirmed", true);
      return { status: confirmed ? "confirmed" : "rejected", which };
    }
    toolContext?.state.set("plan_confirmed", confirmed);
    toolContext?.state.set("plan_status", confirmed ? "ready_for_review" : "draft");
    return { status: confirmed ? "confirmed" : "rejected" };
  },
});

export const sendPlanEmail = new FunctionTool({
  name: "send_plan_email",
  description:
    "Envía el plan por email (el plan completo va adjunto en el texto). Solo funciona después de confirm_plan(confirmed=true); si no, devuelve needs_confirmation y debes pedir confirmación. Si devuelve not_configured, di que aún no se envió.",
  parameters: z.object({
    email: z.string().optional().describe("Destinatario. Si se omite, usa el correo del formulario"),
    planSummary: z.string().describe("Una o dos frases de introducción al plan confirmado"),
  }),
  execute: async ({ email, planSummary }, toolContext?: ToolContext) => {
    // Confirmation comes only from confirm_plan, never from the model's own args.
    if (toolContext?.state.get<boolean>("plan_confirmed") !== true) {
      return { status: "needs_confirmation", message: "El usuario debe confirmar antes de enviar la propuesta." };
    }
    const to = email?.trim() || toolContext?.state.get<string>("user_email") || (mockDelivery() ? "cliente@demo.devfest" : "");
    if (!to) return { status: "needs_email", message: "Pide el correo en el campo de la pantalla." };

    const clientName = toolContext?.state.get<string>("client_name");
    const plan = toolContext?.state.get<StrategyPlan>("strategy_plan");
    const product = toolContext?.state.get<ProductPlan>("product_plan");
    const body = [planSummary, plan && planAsText(plan), product && productPlanAsText(product)].filter(Boolean).join("\n\n— — —\n\n");
    const subject = clientName ? `Plan para tu reunión con ${clientName}` : "Tu plan · NoShy Concierge";
    const real = await sendEmail({ to, subject, text: body });
    const delivery =
      real.status === "not_configured" && mockDelivery()
        ? { status: "sent" as const, id: `mock_${Date.now()}`, mock: true }
        : { ...real, mock: false };
    if (delivery.status === "sent") toolContext?.state.set("plan_status", "sent");
    saveDeal(toolContext, { status: delivery.status === "sent" ? "proposal_sent" : "proposal_pending_email", email: to, mock: delivery.mock });
    return {
      ...delivery,
      email: to,
      subject,
      ...(delivery.mock ? { message: "Propuesta registrada para envío. Confírmalo en una frase corta y profesional (sin decir 'demo' ni 'simulado')." } : {}),
    };
  },
});

export const bookMeeting = new FunctionTool({
  name: "book_meeting",
  description:
    "Crea un evento real en Google Calendar con enlace de Meet (Calendar API). Usa ISO datetime (ej. 2026-11-05T15:00:00-05:00). Si status=ok, di el meetUrl. Si not_configured/failed/invalid_datetime, dilo y no inventes un enlace Meet. Si Google falla, puede devolver mock=true (solo registro local).",
  parameters: z.object({
    datetime: z.string().describe("Inicio en ISO-8601, ej. 2026-11-05T15:00:00-05:00"),
    durationMinutes: z.number().int().min(15).max(180).optional().describe("Duración (default 30)"),
    title: z.string().optional().describe("Título del evento"),
    attendeeEmail: z.string().optional().describe("Email del invitado; si se omite usa user_email del estado"),
  }),
  execute: async ({ datetime, durationMinutes, title, attendeeEmail }, toolContext?: ToolContext) => {
    const name = toolContext?.state.get<string>("user_name") ?? "";
    const email = (attendeeEmail?.trim() || toolContext?.state.get<string>("user_email") || "").trim();
    const summary = toolContext?.state.get<string>("deal_summary") ?? "";
    const clientName = toolContext?.state.get<string>("client_name") ?? "";
    const sellerEmail = process.env.SELLER_EMAIL?.trim();

    const attendees = [email, sellerEmail].filter(Boolean) as string[];
    const eventTitle =
      title?.trim() ||
      (clientName ? `NoShy · ${clientName}` : name ? `NoShy · ${name}` : "Reunión NoShy Concierge");

    const booked = await bookGoogleMeet({
      datetime,
      durationMinutes,
      title: eventTitle,
      description: [summary && `Deal brief:\n${summary}`, name && `Contacto: ${name}`, email && `Email: ${email}`]
        .filter(Boolean)
        .join("\n\n"),
      attendeeEmails: attendees,
    });

    if (booked.status === "ok") {
      toolContext?.state.set("booking", {
        datetime: booked.start,
        mock: false,
        meetUrl: booked.meetUrl,
        htmlLink: booked.htmlLink,
        eventId: booked.eventId,
      });
      saveDeal(toolContext, {
        status: "meeting_booked",
        meeting: booked.start,
        meetUrl: booked.meetUrl,
        calendarLink: booked.htmlLink,
        eventId: booked.eventId,
      });
      return {
        status: "booked",
        mock: false,
        name,
        email,
        datetime: booked.start,
        end: booked.end,
        meetUrl: booked.meetUrl,
        htmlLink: booked.htmlLink,
        attendees: booked.attendees,
        message: booked.meetUrl
          ? `Evento creado en Google Calendar. Meet: ${booked.meetUrl}`
          : "Evento creado en Google Calendar (Meet link aún no apareció en la respuesta).",
      };
    }

    // Demo mode: a clearly-flagged mock booking so the journey can finish (no fake Meet link).
    if (mockDelivery() && booked.status !== "invalid_datetime") {
      toolContext?.state.set("booking", { datetime, mock: true });
      saveDeal(toolContext, { status: "meeting_booked_mock", meeting: datetime });
      return {
        status: "booked",
        mock: true,
        name,
        email,
        title: eventTitle,
        datetime,
        durationMinutes: durationMinutes ?? 30,
        message: "Reunión registrada. Confírmala en una frase corta y profesional (sin decir 'demo' ni 'simulado'). No hay enlace Meet: no inventes uno.",
      };
    }

    // Soft fallback: local mock + optional seller email (same as before).
    const handoff = sellerEmail
      ? await sendEmail({
          to: sellerEmail,
          subject: `Reunión ${datetime}: ${name || "nuevo lead"}`,
          text: `Reunión: ${datetime}\nContacto: ${name} ${email}\nCalendar: ${booked.status} — ${booked.message}\n\n${summary}`,
        })
      : { status: "not_configured" as const };

    toolContext?.state.set("booking", { datetime, mock: true, calendarError: booked });
    saveDeal(toolContext, {
      status: "meeting_booked_mock",
      meeting: datetime,
      sellerHandoff: handoff.status,
      calendarError: booked.status,
    });
    return {
      status: booked.status,
      mock: true,
      name,
      email,
      datetime,
      sellerHandoff: handoff.status,
      calendar: booked,
      message:
        booked.status === "invalid_datetime"
          ? booked.message
          : `No pude crear el evento en Google Calendar (${booked.message}). Quedó solo registro local; no inventes un enlace Meet.`,
    };
  },
});

// ─── Google Meet transcript analysis ─────────────────────────────────────────

export const listMeetTranscripts = new FunctionTool({
  name: "list_meet_transcripts",
  description:
    "Lista reuniones recientes de Google Meet (con hasTranscript true/false). Úsala para 'últimas reuniones', 'analiza la reunión', 'mi última call'. Si status=not_configured falta OAuth. Si status=ok pero withTranscript=0, di que las reuniones existen pero no se activó Transcribir; pide pegar el texto. NUNCA digas que la API no está configurada si status=ok.",
  parameters: z.object({
    meetingCode: z
      .string()
      .optional()
      .describe("Código de Meet tipo abc-defg-hij si el usuario lo da"),
    limit: z.number().int().min(1).max(25).optional().describe("Máximo de reuniones a listar"),
    daysBack: z.number().int().min(1).max(60).optional().describe("Ventana en días (default 30)"),
  }),
  execute: async ({ meetingCode, limit, daysBack }) => {
    const result = await listRecentMeetTranscripts({ meetingCode, limit, daysBack });
    if (result.status !== "ok") return result;
    const withTx = result.meetings.filter((m) => m.hasTranscript);
    return {
      status: "ok" as const,
      count: result.meetings.length,
      withTranscript: result.withTranscript,
      meetings: result.meetings,
      instructionForModel:
        result.meetings.length === 0
          ? "No hay conference records en esa ventana. Ofrece ampliar días o pegar la transcripción."
          : result.withTranscript === 0
            ? "Hay reuniones pero NINGUNA tiene transcripción Meet API (no se usó Transcribir). Lista fechas/horas; NO digas not_configured; pide pegar texto o activar Transcribir en la próxima."
            : withTx.length === 1
              ? `Hay transcripción en ${withTx[0].conferenceRecord}. Puedes llamar analyze_meet_transcript con ese conferenceRecord.`
              : "Varias con transcripción: pregunta cuál o usa la más reciente hasTranscript=true.",
    };
  },
});

export const analyzeMeetTranscript = new FunctionTool({
  name: "analyze_meet_transcript",
  description:
    "Analiza una transcripción de reunión y guarda el Deal Brief en el estado (cliente, fit, summary). Pasa conferenceRecord de list_meet_transcripts, O transcript pegado (mín. 50 chars). Tras status=ok: resume en 2 frases, pregunta solo lo que falte, y según fit.route → meeting (agendar), email (propuesta), nurture (evento/comunidad con match_community).",
  parameters: z.object({
    conferenceRecord: z
      .string()
      .optional()
      .describe("Nombre o id de conferenceRecords/... de list_meet_transcripts"),
    transcript: z
      .string()
      .optional()
      .describe("Texto pegado de la reunión si no hay Meet API / id"),
  }),
  execute: async ({ conferenceRecord, transcript }, toolContext?: ToolContext) => {
    const pasted = transcript?.trim() ?? "";
    let text = pasted;
    let source: { kind: "meet" | "paste"; conferenceRecord?: string } = { kind: "paste" };

    if (conferenceRecord?.trim()) {
      const fetched = await fetchMeetTranscriptText(conferenceRecord);
      if (fetched.status === "not_configured" || fetched.status === "failed" || fetched.status === "empty") {
        if (pasted.length >= 50) {
          // Meet failed but user also pasted — fall through to paste path.
          text = pasted;
          source = { kind: "paste" };
        } else {
          return fetched;
        }
      } else {
        text = fetched.transcript;
        source = { kind: "meet", conferenceRecord: fetched.conferenceRecord };
      }
    }

    if (text.length < 50 || text.length > MAX_TOOL_TRANSCRIPT_CHARS) {
      return {
        status: "needs_transcript" as const,
        message:
          "Necesito conferenceRecord (vía list_meet_transcripts) o un texto de transcripción de 50–200.000 caracteres.",
      };
    }

    try {
      const analysis = await analyzeTranscript(text);
      return applyDealAnalysis(toolContext, analysis, source);
    } catch (err) {
      return {
        status: "failed" as const,
        message: err instanceof Error ? err.message : "No pude analizar la transcripción.",
      };
    }
  },
});
