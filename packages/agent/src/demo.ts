import { matchCommunityLogic } from "./community.js";
import { computeDiscoveryBrief, inferTrack } from "./discovery-playbook.js";
import { applyMatchFocus, inferMatchFocus } from "./match-focus.js";
import { buildProductPlanLogic, buildStrategyPlanLogic, inferRole, planSpokenSummary, productSpokenSummary, summarizeContextLogic } from "./strategy.js";

/**
 * Deterministic fallback when no Gemini key is set. Development only.
 * Mirrors the flow: discovery → summary of challenges → (user says yes) → strategy plan + community support.
 */
export type DemoStep =
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; args: Record<string, unknown>; result: unknown };

export function demoRespond(lastUserText: string): DemoStep[] {
  const text = lastUserText.toLowerCase();
  // Scheduling wins over the sell flow: "agenda con el cliente" must open the calendar.
  if (/(agend|calendario)/.test(text)) {
    return [
      { kind: "tool", name: "open_calendar", args: { reason: "Agendar reunión" }, result: "Calendario abierto" },
      { kind: "text", text: "Te abro el calendario para agendar." },
    ];
  }

  // Meet transcript path (demo-no-key): show the tool contract without calling Google.
  if (/(transcri|meet\.google|analiza(r)? (la )?reuni[oó]n|mi [uú]ltima (call|llamada|reuni[oó]n))/.test(text)) {
    return [
      {
        kind: "tool",
        name: "list_meet_transcripts",
        args: {},
        result: {
          status: "not_configured",
          message: "Meet API no configurada en demo-no-key. Pega la transcripción o configura GOOGLE_MEET_ACCESS_TOKEN.",
        },
      },
      {
        kind: "text",
        text: "Para analizar una reunión de Meet necesito conectar la API (GOOGLE_MEET_ACCESS_TOKEN) o que pegues la transcripción aquí.",
      },
    ];
  }

  // Product plan A2UI actions (before the generic "apruebo el plan" branch).
  if (/^apruebo el plan de producto/.test(text)) {
    return [
      { kind: "tool", name: "confirm_plan", args: { confirmed: true, which: "product" }, result: { status: "confirmed", which: "product" } },
      { kind: "text", text: "Plan de producto aprobado. ¿Agendamos la sesión de descubrimiento o te lo envío por correo?" },
    ];
  }
  if (/^rechazo el plan de producto/.test(text)) {
    return [
      { kind: "tool", name: "confirm_plan", args: { confirmed: false, which: "product" }, result: { status: "rejected", which: "product" } },
      { kind: "text", text: "Entendido. Dime qué ajustamos del plan de producto." },
    ];
  }

  // Build the product (or both plans): community skills → (meeting plan) → product plan.
  if (/(plan de producto|construir (el|la|un|una)|para construir|ambos|los dos planes)/.test(text)) {
    const both = /(ambos|los dos)/.test(text);
    const goal = "construir un bot de WhatsApp para soporte y ventas del cliente retail";
    const skillsNeeded = ["whatsapp", "automatizacion", "ia", "product"];
    const match = matchCommunityLogic({ goal: `${goal} ${skillsNeeded.join(" ")}`, track: "company", role: "client", city: "Medellín" });
    const ids = { peopleIds: match.people.slice(0, 3).map((p) => p.id), projectIds: match.projects.map((p) => p.id) };
    const product = buildProductPlanLogic({ goal, skillsNeeded, challenges: [goal], ...ids });
    const steps: DemoStep[] = [{ kind: "tool", name: "match_community", args: { goal, focus: "all" }, result: match }];
    if (both) {
      const plan = buildStrategyPlanLogic({ role: "seller", goal: "vender el bot de WhatsApp al cliente retail", challenges: [goal], ...ids });
      steps.push({ kind: "tool", name: "build_strategy_plan", args: { goal, role: "seller" }, result: { ...plan, spoken: planSpokenSummary(plan) } });
    }
    const spoken = productSpokenSummary(product);
    steps.push(
      { kind: "tool", name: "build_product_plan", args: { goal, skillsNeeded }, result: { ...product, spoken } },
      { kind: "text", text: `${spoken} Apruébalo o recházalo en la tarjeta.` },
    );
    return steps;
  }

  // Focused community asks (before generic sell/plan flows).
  const focus = inferMatchFocus({ text });
  if (
    focus !== "all" &&
    /(proyecto|project|persona|people|skill|talento|comunidad|match|muéstr|muestra|enséñ|busca)/.test(text)
  ) {
    const role = inferRole({ text });
    const goal =
      role === "seller" ? "preparar la reunión con el cliente y vender mejor" : "resolver la necesidad de la empresa";
    const track = role === "seller" ? "builder" : "company";
    const raw = matchCommunityLogic({ goal: `${goal} soporte retail whatsapp ventas`, track, role, city: "Medellín" });
    const match = applyMatchFocus(raw, focus);
    // No text dump — the community A2UI surface (catalog CommunityBoard) paints the cards.
    return [{ kind: "tool", name: "match_community", args: { goal, role, focus }, result: match }];
  }

  // A2UI button actions arrive as user messages (userMessage on the event).
  // Must run before the "el plan" branch — "Apruebo el plan…" contains that phrase.
  if (/^apruebo el plan/.test(text)) {
    return [
      {
        kind: "tool",
        name: "confirm_plan",
        args: { confirmed: true },
        result: { status: "confirmed" },
      },
      { kind: "text", text: "Plan aprobado. ¿Te lo envío por correo o agendamos la reunión?" },
    ];
  }
  if (/^rechazo el plan/.test(text)) {
    return [
      {
        kind: "tool",
        name: "confirm_plan",
        args: { confirmed: false },
        result: { status: "rejected" },
      },
      { kind: "text", text: "Entendido. Dime qué ajustamos del plan." },
    ];
  }

  // The user accepted the plan (or asked for it): community support → strategy plan.
  if (/(arma(me)? el plan|el plan|^s[ií]\b|s[ií],|dale|claro|de acuerdo|hazlo)/.test(text)) {
    const role = inferRole({ text });
    const goal = role === "seller" ? "preparar la reunión con el cliente y vender mejor" : "resolver la necesidad de la empresa";
    const track = role === "seller" ? "builder" : "company";
    const match = matchCommunityLogic({ goal: `${goal} soporte retail whatsapp ventas`, track, role, city: "Medellín" });
    const plan = buildStrategyPlanLogic({
      role,
      goal,
      challenges: [goal],
      peopleIds: match.people.slice(0, 2).map((p) => p.id),
      projectIds: match.projects.map((p) => p.id),
    });
    const spoken = planSpokenSummary(plan);
    // Plan UI is emitted as A2UI over AG-UI (ACTIVITY_SNAPSHOT) by the bridge —
    // not as a fixed React card or approve_plan frontend tool.
    return [
      { kind: "tool", name: "match_community", args: { goal, role }, result: match },
      { kind: "tool", name: "build_strategy_plan", args: { goal, role }, result: { ...plan, spoken } },
      { kind: "text", text: `${spoken} Aprueba o rechaza la recomendación en la tarjeta A2UI.` },
    ];
  }

  // A need or a sale described: discovery facts → summary of the challenges → ask before the plan.
  if (
    /(vender|sell|client|cliente|idea|producto|mvp|talento|freelancer|agencia|sponsor|frontend|founder|whatsapp|soporte|meeting|necesit|no s[eé] c[oó]mo)/.test(
      text,
    )
  ) {
    const track = inferTrack({ text });
    const role = inferRole({ text, track });
    const goal =
      role === "seller"
        ? "preparar la reunión con el cliente y vender mejor"
        : text.includes("whatsapp") || text.includes("soporte")
          ? "automatizar el soporte por WhatsApp"
          : "encontrar talento o una solución para un reto";
    const brief = computeDiscoveryBrief({
      track,
      clientName: "Demo",
      objective: goal,
      needsContext: goal,
      building: goal,
      lookingFor: goal,
      facts: [{ factType: "pain", value: goal, slotId: "dolor" }],
      discovery: { track, pendingSlotIds: [], stage: "discovery", shownItemIds: [], recommendationShown: false },
    });
    const summary = summarizeContextLogic({
      role,
      situation: role === "seller" ? "Vas a presentar tu producto a un cliente" : "Tu empresa tiene un reto por resolver",
      challenges: [goal],
      success: "",
    });
    return [
      { kind: "tool", name: "show_discovery_guide", args: { track }, result: brief },
      { kind: "tool", name: "save_meeting_fact", args: { factType: "pain", value: goal, slotId: "dolor" }, result: { saved: true } },
      { kind: "tool", name: "summarize_context", args: { role, situation: summary.situation, challenges: summary.challenges, success: "" }, result: summary },
      { kind: "text", text: `Te resumo: ${summary.situation}; el reto es ${summary.challenges[0]}. ¿Lo entendí bien? ${summary.askPlan}` },
    ];
  }

  // Discovery guide (greeting / help / "muéstramelas")
  if (
    /(en qu[eé] me puedes|ayudar|prepar|gu[ií]a|preguntas|empezar|hola|hey|mu[eé]stramel|ens[eé][nñ]amel)/.test(
      text,
    )
  ) {
    const track = inferTrack({ text });
    const brief = computeDiscoveryBrief({ track, objective: "", clientName: "" });
    const questions = (brief.openQuestions.length ? brief.openQuestions : brief.slots.slice(0, 5)).map(
      (q, i) => `${i + 1}. ${"question" in q ? q.question : (q as { question: string }).question}`,
    );
    const spoken = questions.join("\n");
    return [
      {
        kind: "tool",
        name: "show_discovery_guide",
        args: { track },
        result: { ...brief, spokenQuestions: spoken, questions: brief.openQuestions },
      },
      {
        kind: "text",
        text: `Estas son las preguntas clave (${track}):\n${spoken}\nEmpecemos por la primera.`,
      },
    ];
  }

  const brief = computeDiscoveryBrief({ track: "builder" });
  return [
    { kind: "tool", name: "show_discovery_guide", args: { track: "builder" }, result: brief },
    {
      kind: "text",
      text: "¡Hola! Soy NoShy Concierge, tu compañero comercial. Te ayudo a preparar tus reuniones con clientes para vender tu producto o servicio, y después te acompaño con el seguimiento: resumen, propuesta y siguientes pasos.",
    },
  ];
}
