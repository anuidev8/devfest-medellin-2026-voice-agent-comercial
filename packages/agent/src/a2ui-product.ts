/**
 * A2UI v0.9 surface for the PRODUCT build plan (build_product_plan).
 * Same pattern as a2ui-plan.ts: path-bound components + updateDataModel. Lines are
 * pre-formatted in the data model so empty slots render blank (no stray "·" / "—").
 * Approve / reject buttons send a userMessage back to the agent (A2UI action over AG-UI).
 */

import { CONCIERGE_CATALOG_ID } from "./a2ui-community.js";
import type { ProductPlan } from "./strategy.js";

export const PRODUCT_SURFACE_ID = "product-plan";

type Comp = Record<string, unknown>;

const text = (id: string, path: string, variant = "body"): Comp => ({ id, component: "Text", text: { path }, variant });
const label = (id: string, value: string, variant = "h4"): Comp => ({ id, component: "Text", text: value, variant });

const SCOPE = [0, 1, 2, 3];
const PHASES = [0, 1, 2, 3];
const TEAM = [0, 1, 2, 3];
const RISKS = [0, 1, 2];

const PRODUCT_COMPONENTS: Comp[] = [
  { id: "root", component: "Column", children: ["card-root"] },
  { id: "card-root", component: "Card", child: "main-column" },
  {
    id: "main-column",
    component: "Column",
    children: [
      "eyebrow",
      "headline",
      "problem",
      "outcome",
      "divider1",
      "scope-title",
      ...SCOPE.map((i) => `scope${i}`),
      "later",
      "approach",
      "divider2",
      "phases-title",
      ...PHASES.flatMap((i) => [`phase${i}`, `phase${i}-done`]),
      "divider3",
      "team-title",
      ...TEAM.map((i) => `team${i}`),
      "value-title",
      "value-dream",
      "value-likelihood",
      "value-time",
      "value-effort",
      "risks-title",
      ...RISKS.map((i) => `risk${i}`),
      "budget",
      "next-step",
      "divider4",
      "approval-text",
      "buttons-row",
    ],
  },
  label("eyebrow", "Plan para construir el producto", "caption"),
  text("headline", "/headline", "h3"),
  text("problem", "/problemLine"),
  text("outcome", "/outcomeLine"),
  { id: "divider1", component: "Divider", axis: "horizontal" },
  label("scope-title", "Alcance del MVP (ahora)"),
  ...SCOPE.map((i) => text(`scope${i}`, `/scope/${i}`)),
  text("later", "/laterLine", "caption"),
  text("approach", "/approachLine"),
  { id: "divider2", component: "Divider", axis: "horizontal" },
  label("phases-title", "Fases"),
  ...PHASES.flatMap((i) => [text(`phase${i}`, `/phases/${i}/line`), text(`phase${i}-done`, `/phases/${i}/done`, "caption")]),
  { id: "divider3", component: "Divider", axis: "horizontal" },
  label("team-title", "Equipo y skills (comunidad)"),
  ...TEAM.map((i) => text(`team${i}`, `/team/${i}`)),
  label("value-title", "Ecuación de valor (Hormozi)"),
  text("value-dream", "/value/dream"),
  text("value-likelihood", "/value/likelihood"),
  text("value-time", "/value/time"),
  text("value-effort", "/value/effort"),
  label("risks-title", "Riesgos a validar primero"),
  ...RISKS.map((i) => text(`risk${i}`, `/risks/${i}`)),
  text("budget", "/budgetLine", "caption"),
  text("next-step", "/nextStepLine"),
  { id: "divider4", component: "Divider", axis: "horizontal" },
  label("approval-text", "¿Apruebas este plan de producto?"),
  { id: "buttons-row", component: "Row", children: ["reject-button", "approve-button"], justify: "end", align: "center" },
  { id: "reject-button-text", component: "Text", text: "Rechazar" },
  {
    id: "reject-button",
    component: "Button",
    child: "reject-button-text",
    variant: "default",
    action: {
      event: {
        name: "reject_product_plan",
        userMessage: "Rechazo el plan de producto: necesito ajustar. Ajustémoslo.",
        context: { source: "a2ui-product" },
      },
    },
  },
  { id: "approve-button-text", component: "Text", text: "Aprobar plan de producto" },
  {
    id: "approve-button",
    component: "Button",
    child: "approve-button-text",
    variant: "primary",
    action: {
      event: {
        name: "approve_product_plan",
        userMessage: "Apruebo el plan de producto. Continúa.",
        context: { source: "a2ui-product" },
      },
    },
  },
];

const pad = (list: string[], n: number) => [...list, ...Array(Math.max(0, n - list.length)).fill("")].slice(0, n);

/** ProductPlan → flat, pre-formatted data model. */
export function productToA2uiData(plan: ProductPlan) {
  return {
    headline: plan.headline,
    problemLine: `Problema: ${plan.problem}`,
    outcomeLine: `Resultado a 90 días: ${plan.outcome}`,
    scope: pad(plan.scope.now.map((s) => `• ${s}`), SCOPE.length),
    laterLine: plan.scope.later.length ? `Después: ${plan.scope.later.join(" · ")}` : "",
    approachLine: `Camino: ${plan.approach.name} — ${plan.approach.why}`,
    phases: PHASES.map((i) => {
      const p = plan.phases[i];
      return p
        ? { line: `${p.name}${p.duration ? ` (${p.duration})` : ""}: ${p.outcome}`, done: p.doneWhen ? `Listo cuando: ${p.doneWhen}` : "" }
        : { line: "", done: "" };
    }),
    team: pad(
      plan.team.length ? plan.team.map((t) => `${t.skill}: ${t.who}`) : plan.support.people.map((p) => `${p.name} · ${p.role} — ${p.howItHelps}`),
      TEAM.length,
    ),
    value: {
      dream: `Resultado soñado: ${plan.value.dreamOutcome}`,
      likelihood: `Probabilidad de éxito: ${plan.value.likelihood}`,
      time: `Tiempo: ${plan.value.timeDelay}`,
      effort: `Esfuerzo: ${plan.value.effort}`,
    },
    risks: pad(plan.risks.map((r) => `• ${r}`), RISKS.length),
    budgetLine: plan.budget ? `Presupuesto: ${plan.budget}` : "",
    nextStepLine: `Siguiente paso: ${plan.nextStep}`,
  };
}

export function buildProductA2uiOperations(plan: ProductPlan, surfaceId = PRODUCT_SURFACE_ID) {
  return [
    { version: "v0.9", createSurface: { surfaceId, catalogId: CONCIERGE_CATALOG_ID } },
    { version: "v0.9", updateComponents: { surfaceId, components: PRODUCT_COMPONENTS } },
    { version: "v0.9", updateDataModel: { surfaceId, path: "/", value: productToA2uiData(plan) } },
  ];
}
