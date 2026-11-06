import assert from "node:assert";
import { matchCommunityLogic, matchPeopleLogic } from "./community.js";
import { buildStrategyPlanLogic, inferRole, planAsText, summarizeContextLogic } from "./strategy.js";
import { assessFit, briefSummary, type DealBrief } from "./deal-brief.js";
import { computeDiscoveryBrief, inferTrack } from "./discovery-playbook.js";
import { demoRespond } from "./demo.js";
import { sendEmail } from "./email.js";
import { formatTranscriptEntries, isMeetConfigured } from "./meet-transcript.js";
import { bookGoogleMeet } from "./calendar-book.js";

assert.equal(inferTrack({ text: "busco talento frontend" }), "company");
assert.equal(inferTrack({ text: "tengo una idea y no sé vender" }), "builder");

const brief = computeDiscoveryBrief({
  track: "builder",
  clientName: "Ana",
  objective: "vender mejor mi producto",
  needsContext: "no sé hacer pitch",
  building: "AI wellness app",
  facts: [{ factType: "skill_gap", value: "ventas", slotId: "gap" }],
});
assert.ok(brief.openQuestions.length >= 1);
assert.equal(brief.track, "builder");
assert.ok(brief.slots.some((s) => s.id === "proyecto"));

// Every track reaches the same six spoken questions, including budget and maturity.
for (const [track, trackQuestion] of [["builder", "proyecto"], ["company", "ayuda"]] as const) {
  const ids = computeDiscoveryBrief({ track, clientName: "Ana", lookingFor: "vender mejor" }).openQuestions.map((q) => q.id);
  assert.deepEqual(ids, ["porque_ahora", "dolor", "situacion_actual", trackQuestion, "exito", "cierre"]);
}

const deal: DealBrief = {
  trigger: "Perdí un cliente",
  currentState: "No cierro ventas",
  cost: "2 clientes al mes",
  tried: "Anuncios",
  scope: "App de IA con clientes",
  targetResult: "3 clientes nuevos",
  budget: "500 USD",
  timing: "Este mes",
  decisionMaker: "Yo",
};
assert.equal(assessFit(deal).route, "meeting");
assert.equal(assessFit({ ...deal, decisionMaker: "" }).route, "email");
assert.equal(assessFit({ ...deal, timing: "más adelante" }).route, "email");
assert.equal(assessFit({ ...deal, budget: "No tengo presupuesto" }).route, "nurture");
assert.equal(assessFit({ ...deal, currentState: "" }).route, "nurture");

assert.equal(briefSummary({ ...deal, trigger: "Perdí un cliente." }).includes(".."), false);

delete process.env.RESEND_API_KEY;
assert.equal((await sendEmail({ to: "a@b.co", subject: "x", text: "y" })).status, "not_configured");

const people = matchPeopleLogic({
  goal: "frontend para IA ecommerce",
  offering: "React",
  lookingFor: "founders de IA",
  city: "Medellín",
});
assert.equal(people.matches[0]?.id, "maria_ai_ecommerce");
assert.ok(people.matches[0]?.skills?.includes("product"));

const match = matchCommunityLogic({
  goal: "no sé vender mi producto de IA",
  track: "builder",
  city: "Medellín",
});
assert.ok(match.people.length >= 1);
assert.ok(match.projects.length >= 1);
// Packages are not pushed: only when the user asks for help.
assert.equal(match.packages.length, 0);
assert.ok(matchCommunityLogic({ goal: "vender", track: "builder", includeHelpOptions: true }).packages.length >= 1);
assert.ok(match.people[0]?.howItHelps && match.projects[0]?.howItHelps);

// Roles
assert.equal(inferRole({ text: "tengo una reunión con un cliente para venderle" }), "seller");
assert.equal(inferRole({ clientName: "Acme" }), "seller");
assert.equal(inferRole({ text: "necesitamos talento para un proyecto de IA" }), "client");

// Summary before the plan, with the permission question
const summary = summarizeContextLogic({ role: "seller", situation: "Vendo software", challenges: ["No sé qué preguntar"], success: "", clientName: "Acme" });
assert.equal(summary.challenges.length, 1);
assert.match(summary.askPlan, /Acme/);

// Seller plan: strategy + client questions + support, no package
const sellerPlan = buildStrategyPlanLogic({
  role: "seller",
  goal: "vender mejor en reunión con cliente",
  clientName: "Acme",
  challenges: ["no sabe qué preguntar"],
  extraQuestions: ["¿Usan WhatsApp con sus clientes?"],
  peopleIds: match.people.map((p) => p.id),
  projectIds: match.projects.map((p) => p.id),
});
assert.match(sellerPlan.headline, /Acme/);
assert.ok(sellerPlan.questions.length >= 7);
assert.ok(sellerPlan.objections?.length && sellerPlan.valueAngle && sellerPlan.nextStep);
assert.equal(sellerPlan.helpOptions.length, 0);
assert.ok(sellerPlan.support.projects.length >= 1);
assert.ok(planAsText(sellerPlan).includes("Preguntas clave"));

// Client plan: approaches + phases
const clientPlan = buildStrategyPlanLogic({ role: "client", goal: "automatizar soporte", challenges: ["tickets altos"] });
assert.ok(clientPlan.approaches?.length && clientPlan.phases?.length);
assert.ok(!clientPlan.objections);

// Demo: a sale described → summary (no plan yet); "sí, arma el plan" → plan
const sellFlow = demoRespond("I've a meeting with client so I need prepare to sell better");
assert.equal(sellFlow[0]?.kind, "tool");
assert.ok(sellFlow.some((s) => s.kind === "tool" && s.name === "summarize_context"));
assert.ok(!sellFlow.some((s) => s.kind === "tool" && s.name === "build_strategy_plan"));
const planFlow = demoRespond("sí, arma el plan");
assert.ok(planFlow.some((s) => s.kind === "tool" && s.name === "build_strategy_plan"));
assert.ok(!planFlow.some((s) => s.kind === "tool" && s.name === "approve_plan"));
const approveViaA2ui = demoRespond("Apruebo el plan. Continúa.");
assert.ok(approveViaA2ui.some((s) => s.kind === "tool" && s.name === "confirm_plan"));
const projectsOnly = demoRespond("Muéstrame proyectos de la comunidad para WhatsApp");
const projTool = projectsOnly.find((s) => s.kind === "tool" && s.name === "match_community");
assert.ok(projTool && projTool.kind === "tool");
if (projTool && projTool.kind === "tool") {
  const r = projTool.result as { focus?: string; people?: unknown[]; projects?: unknown[] };
  assert.equal(r.focus, "projects");
  assert.ok((r.projects?.length ?? 0) >= 1);
  assert.equal(r.people?.length ?? 0, 0);
}
const calendar = demoRespond("Agenda la reunión con el cliente");
assert.ok(calendar.some((s) => s.kind === "tool" && s.name === "open_calendar"));
const context = demoRespond("Preparar reunión con Bancolombia");
assert.ok(!context.some((s) => s.kind === "tool" && s.name === "open_calendar"));

const meetDemo = demoRespond("Analiza la transcripción de mi última reunión de Meet");
assert.ok(meetDemo.some((s) => s.kind === "tool" && s.name === "list_meet_transcripts"));

assert.equal(
  formatTranscriptEntries([
    { participant: "conferenceRecords/x/participants/Ana", text: "Hola" },
    { text: "  " },
    { text: "Necesito vender mejor" },
  ]),
  "[Ana] Hola\nNecesito vender mejor",
);
assert.equal(typeof isMeetConfigured(), "boolean");

const badDate = await bookGoogleMeet({ datetime: "not-a-date" });
assert.equal(badDate.status, "invalid_datetime");

console.log("tools OK");

// ─── Context gate + product plan ────────────────────────────────────────────
{
  const { assessContextLogic, computeDiscoveryBrief } = await import("./discovery-playbook.js");
  const { buildProductPlanLogic } = await import("./strategy.js");
  const { buildProductA2uiOperations } = await import("./a2ui-product.js");

  // Full context (who + objective + pain) → skip discovery, straight to summary.
  const full = computeDiscoveryBrief({
    track: "company",
    clientName: "Retail Co",
    objective: "bot de WhatsApp para soporte y ventas",
    needsContext: "no damos abasto con los mensajes",
  });
  assert.equal(assessContextLogic(full).next, "summary");
  // A Deal Brief always counts as full context.
  assert.equal(assessContextLogic(computeDiscoveryBrief({ track: "company" }), true).next, "summary");
  // Nothing known → full discovery.
  assert.equal(assessContextLogic(computeDiscoveryBrief({ track: "company" })).next, "discovery");

  const product = buildProductPlanLogic({
    goal: "bot de WhatsApp",
    skillsNeeded: ["whatsapp", "diseño 3d"],
    peopleIds: ["diego_whatsapp"],
    projectIds: ["proj_support_bot"],
  });
  assert.equal(product.phases.length, 4);
  assert.ok(product.team[0]!.who.includes("Diego"), "skill → matched community person");
  assert.ok(product.team[1]!.who.startsWith("Por definir"), "no invented person for an unmatched skill");
  assert.equal(product.budget, "", "no invented budget");
  const ops = buildProductA2uiOperations(product);
  assert.ok(ops.some((o) => "updateComponents" in o) && ops.some((o) => "updateDataModel" in o));

  const both = demoRespond("Arma ambos planes, la reunión y el de construir el producto");
  assert.ok(both.some((s) => s.kind === "tool" && s.name === "build_strategy_plan"));
  assert.ok(both.some((s) => s.kind === "tool" && s.name === "build_product_plan"));
  const okProduct = demoRespond("Apruebo el plan de producto. Continúa.");
  assert.ok(okProduct.some((s) => s.kind === "tool" && s.name === "confirm_plan" && (s.args as { which?: string }).which === "product"));
  console.log("context gate + product plan OK");
}
