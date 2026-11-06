/**
 * Builds A2UI v0.9 operations for a seller recommend surface.
 * Layout from A2UI Composer export → createSurface + updateComponents + updateDataModel.
 * Spec: https://a2ui.org/ — CopilotKit renders via a2ui over AG-UI.
 */

import { CONCIERGE_CATALOG_ID } from "./a2ui-community.js";

/** Same catalog as web `createCatalog` (basic + CommunityBoard). */
const CATALOG_ID = CONCIERGE_CATALOG_ID;

type PlanLike = {
  headline?: string;
  objective?: string;
  spoken?: string;
  valueAngle?: string;
  nextStep?: string;
  role?: string;
  hypotheses?: string[];
  questions?: Array<{ topic?: string; question?: string; why?: string }>;
  support?: {
    projects?: Array<{ title?: string; howItHelps?: string; outcome?: string; ownerName?: string }>;
    people?: Array<{ name?: string; role?: string; howItHelps?: string; skills?: string[] }>;
  };
};

type A2UIOp = Record<string, unknown>;
type Comp = Record<string, unknown>;

/** Composer template: path-bound components (data filled via updateDataModel). */
const PLAN_COMPONENTS: Comp[] = [
  { id: "root", component: "Column", children: ["card-root"] },
  { id: "card-root", component: "Card", child: "main-column" },
  {
    id: "main-column",
    component: "Column",
    children: [
      "eyebrow",
      "headline",
      "objective",
      "value-angle",
      "hypothesis1",
      "hypothesis2",
      "next-step",
      "divider1",
      "questions-title",
      "question1",
      "question1-why",
      "question2",
      "question2-why",
      "question3",
      "question3-why",
      "question4",
      "question4-why",
      "question5",
      "question5-why",
      "divider2",
      "projects-title",
      "project1",
      "project2",
      "people-title",
      "person1",
      "person2",
      "divider3",
      "approval-text",
      "buttons-row",
    ],
  },
  { id: "eyebrow", component: "Text", text: "Recomendación para vender", variant: "caption" },
  { id: "headline", component: "Text", text: { path: "/headline" }, variant: "h3" },
  { id: "objective", component: "Text", text: { path: "/objective" }, variant: "body" },
  { id: "value-angle", component: "Text", text: { path: "/valueAngle" }, variant: "body" },
  { id: "hypothesis1", component: "Text", text: { path: "/hypotheses/0" }, variant: "caption" },
  { id: "hypothesis2", component: "Text", text: { path: "/hypotheses/1" }, variant: "caption" },
  {
    id: "next-step",
    component: "Text",
    text: { call: "formatString", args: { value: "Foco del cierre: ${/nextStep}" }, returnType: "string" },
    variant: "body",
  },
  { id: "divider1", component: "Divider", axis: "horizontal" },
  { id: "questions-title", component: "Text", text: "Preguntas para hacerle al cliente", variant: "h4" },
  {
    id: "question1",
    component: "Text",
    text: {
      call: "formatString",
      args: { value: "1. [${/questions/0/topic}] ${/questions/0/question}" },
      returnType: "string",
    },
    variant: "body",
  },
  { id: "question1-why", component: "Text", text: { path: "/questions/0/why" }, variant: "caption" },
  {
    id: "question2",
    component: "Text",
    text: {
      call: "formatString",
      args: { value: "2. [${/questions/1/topic}] ${/questions/1/question}" },
      returnType: "string",
    },
    variant: "body",
  },
  { id: "question2-why", component: "Text", text: { path: "/questions/1/why" }, variant: "caption" },
  {
    id: "question3",
    component: "Text",
    text: {
      call: "formatString",
      args: { value: "3. [${/questions/2/topic}] ${/questions/2/question}" },
      returnType: "string",
    },
    variant: "body",
  },
  { id: "question3-why", component: "Text", text: { path: "/questions/2/why" }, variant: "caption" },
  {
    id: "question4",
    component: "Text",
    text: {
      call: "formatString",
      args: { value: "4. [${/questions/3/topic}] ${/questions/3/question}" },
      returnType: "string",
    },
    variant: "body",
  },
  { id: "question4-why", component: "Text", text: { path: "/questions/3/why" }, variant: "caption" },
  {
    id: "question5",
    component: "Text",
    text: {
      call: "formatString",
      args: { value: "5. [${/questions/4/topic}] ${/questions/4/question}" },
      returnType: "string",
    },
    variant: "body",
  },
  { id: "question5-why", component: "Text", text: { path: "/questions/4/why" }, variant: "caption" },
  { id: "divider2", component: "Divider", axis: "horizontal" },
  { id: "projects-title", component: "Text", text: "Proyectos que puedes mostrar", variant: "h4" },
  {
    id: "project1",
    component: "Text",
    text: {
      call: "formatString",
      args: { value: "${/projects/0/title} · ${/projects/0/ownerName} — ${/projects/0/howItHelps}" },
      returnType: "string",
    },
    variant: "body",
  },
  {
    id: "project2",
    component: "Text",
    text: {
      call: "formatString",
      args: { value: "${/projects/1/title} · ${/projects/1/ownerName} — ${/projects/1/howItHelps}" },
      returnType: "string",
    },
    variant: "body",
  },
  { id: "people-title", component: "Text", text: "Personas y skills de apoyo", variant: "h4" },
  {
    id: "person1",
    component: "Text",
    text: {
      call: "formatString",
      args: { value: "${/people/0/name} · ${/people/0/role} (${/people/0/skills}) — ${/people/0/howItHelps}" },
      returnType: "string",
    },
    variant: "body",
  },
  {
    id: "person2",
    component: "Text",
    text: {
      call: "formatString",
      args: { value: "${/people/1/name} · ${/people/1/role} (${/people/1/skills}) — ${/people/1/howItHelps}" },
      returnType: "string",
    },
    variant: "body",
  },
  { id: "divider3", component: "Divider", axis: "horizontal" },
  { id: "approval-text", component: "Text", text: "¿Apruebas esta recomendación?", variant: "h4" },
  {
    id: "buttons-row",
    component: "Row",
    children: ["reject-button", "approve-button"],
    justify: "end",
    align: "center",
  },
  { id: "reject-button-text", component: "Text", text: "Rechazar" },
  {
    id: "reject-button",
    component: "Button",
    child: "reject-button-text",
    variant: "default",
    action: {
      event: {
        name: "reject_plan",
        userMessage: "Rechazo el plan: necesito ajustar. Ajustémoslo.",
        context: { source: "a2ui-plan" },
      },
    },
  },
  { id: "approve-button-text", component: "Text", text: "Aprobar recomendación" },
  {
    id: "approve-button",
    component: "Button",
    child: "approve-button-text",
    variant: "primary",
    action: {
      event: {
        name: "approve_plan",
        userMessage: "Apruebo el plan. Continúa.",
        context: { source: "a2ui-plan" },
      },
    },
  },
];

function padQuestion(q?: { topic?: string; question?: string; why?: string }) {
  return {
    topic: String(q?.topic ?? ""),
    question: String(q?.question ?? ""),
    why: String(q?.why ?? ""),
  };
}

function padProject(p?: { title?: string; ownerName?: string; howItHelps?: string; outcome?: string }) {
  return {
    title: String(p?.title ?? ""),
    ownerName: String(p?.ownerName ?? ""),
    howItHelps: String(p?.howItHelps ?? p?.outcome ?? ""),
  };
}

function padPerson(p?: { name?: string; role?: string; howItHelps?: string; skills?: string[] }) {
  return {
    name: String(p?.name ?? ""),
    role: String(p?.role ?? ""),
    skills: (p?.skills ?? []).slice(0, 4).join(", "),
    howItHelps: String(p?.howItHelps ?? ""),
  };
}

/** Map strategy-plan tool result → Composer data model. */
export function planToA2uiData(plan: PlanLike) {
  const valueRaw = String(plan.valueAngle ?? "");
  const valueAngle = valueRaw && !/^cómo contar el valor/i.test(valueRaw) ? `Cómo contar el valor: ${valueRaw}` : valueRaw;

  const questions = [...(plan.questions ?? [])];
  while (questions.length < 5) questions.push({ topic: "", question: "", why: "" });

  const projects = [...(plan.support?.projects ?? [])];
  while (projects.length < 2) projects.push({});

  const people = [...(plan.support?.people ?? [])];
  while (people.length < 2) people.push({});

  const hypotheses = [...(plan.hypotheses ?? [])].map((h) => (h ? `• ${h}` : ""));
  while (hypotheses.length < 2) hypotheses.push("");

  return {
    headline: String(plan.headline ?? "Recomendación para tu reunión"),
    objective: String(plan.objective ?? plan.spoken ?? ""),
    valueAngle,
    nextStep: String(plan.nextStep ?? ""),
    hypotheses: hypotheses.slice(0, 2),
    questions: questions.slice(0, 5).map(padQuestion),
    projects: projects.slice(0, 2).map(padProject),
    people: people.slice(0, 2).map(padPerson),
  };
}

/** Flat A2UI ops from Composer layout + live plan data. */
export function buildPlanA2uiOperations(plan: PlanLike, surfaceId = "seller-recommend"): A2UIOp[] {
  const data = planToA2uiData(plan);
  return [
    {
      version: "v0.9",
      createSurface: { surfaceId, catalogId: CATALOG_ID },
    },
    {
      version: "v0.9",
      updateComponents: { surfaceId, components: PLAN_COMPONENTS },
    },
    {
      version: "v0.9",
      updateDataModel: { surfaceId, path: "/", value: data },
    },
  ];
}
