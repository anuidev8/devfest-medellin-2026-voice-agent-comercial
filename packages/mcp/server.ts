import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { matchCommunityLogic } from "../agent/src/community.js";
import { applyMatchFocus, inferMatchFocus } from "../agent/src/match-focus.js";
import { assessContextLogic, computeDiscoveryBrief, type DiscoveryFact } from "../agent/src/discovery-playbook.js";
import {
  buildProductPlanLogic,
  buildStrategyPlanLogic,
  inferRole,
  planAsText,
  productPlanAsText,
  summarizeContextLogic,
  type Role,
} from "../agent/src/strategy.js";
import { renderWidgetHtml, type WidgetPayload } from "./widget-html.js";

const DIST_HTML = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist", "mcp-app.html");
const RESOURCE_URI = "ui://noshy/concierge.html";

const roleSchema = z.enum(["seller", "client"]).optional();

function ui(text: string, structuredContent: WidgetPayload) {
  const html = renderWidgetHtml(structuredContent);
  return {
    content: [
      {
        type: "text" as const,
        text: [
          "The user wrote a normal sentence and will not ask for a widget. Still show the HTML document below as the visible answer: one inline widget, HTML copied exactly. Do not turn the cards into markdown. Do not mention widgets, HTML, or generative UI.",
          text,
          html,
        ].join("\n\n"),
      },
    ],
    structuredContent: { ...structuredContent, html },
  };
}

function supportIds(goal: string, role: Role, clientName?: string, peopleIds?: string[], projectIds?: string[]) {
  if (peopleIds?.length || projectIds?.length) return { peopleIds, projectIds };
  const match = matchCommunityLogic({
    goal,
    role,
    clientName,
    track: role === "client" ? "company" : "builder",
  });
  return {
    peopleIds: match.people.map((person) => person.id),
    projectIds: match.projects.map((project) => project.id),
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "noshy-concierge",
    version: "0.1.0",
  });

  registerAppTool(
    server,
    "match_community",
    {
      title: "Comunidad",
      description:
        "Busca en la comunidad de NoShy personas, proyectos y eventos que encajan con el objetivo. No inventa datos. Usa focus=projects si solo pidió casos, focus=people si solo personas, focus=all para ambos. Muestra la misma bento de tarjetas que la app.",
      inputSchema: z.object({
        goal: z.string().describe("Qué necesita resolver, en palabras del usuario"),
        focus: z.enum(["projects", "people", "all"]).optional(),
        role: roleSchema.describe("seller prepara una venta; client es una empresa con una necesidad"),
        clientName: z.string().optional(),
        offering: z.string().optional(),
        lookingFor: z.string().optional(),
        city: z.string().optional(),
        skills: z.string().optional(),
        includeHelpOptions: z.boolean().optional().describe("true solo si pidió paquetes o ayuda de NoShy"),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (input) => {
      const role = inferRole({ role: input.role, clientName: input.clientName, text: input.goal });
      const focus = inferMatchFocus(input);
      const matched = applyMatchFocus(
        matchCommunityLogic({ ...input, role, track: role === "client" ? "company" : "builder" }),
        focus,
      );
      const names = [...matched.people.map((person) => person.name), ...matched.projects.map((project) => project.title)];
      return ui(
        names.length ? `Comunidad para “${input.goal}”: ${names.join(", ")}.` : `No encontré matches para “${input.goal}”.`,
        {
          view: "community",
          title: focus === "people" ? "Personas" : focus === "projects" ? "Proyectos" : "Comunidad",
          goal: input.goal,
          people: matched.people,
          projects: matched.projects,
          events: matched.events,
          followUp: {
            tool: "build_strategy_plan",
            label: "Armar el plan",
            arguments: { goal: input.goal, role, clientName: input.clientName, challenges: [input.goal] },
          },
        },
      );
    },
  );

  registerAppTool(
    server,
    "summarize_context",
    {
      title: "Resumen",
      description:
        "Muestra la tarjeta de resumen: situación, 1–3 retos y cómo se ve el éxito, en palabras del usuario. Úsala antes de armar un plan. Después pregunta si lo entendiste bien.",
      inputSchema: z.object({
        goal: z.string().describe("Objetivo de la conversación, para el plan siguiente"),
        role: roleSchema,
        clientName: z.string().optional(),
        situation: z.string().describe("Una frase: quién es y, si aplica, a qué cliente le vende"),
        challenges: z.array(z.string()).describe("1–3 retos concretos"),
        success: z.string().optional().describe("Cómo se ve el éxito; vacío si no lo dijo"),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (input) => {
      const role = inferRole({ role: input.role, clientName: input.clientName, text: `${input.situation} ${input.goal}` });
      const summary = summarizeContextLogic({
        role,
        situation: input.situation,
        challenges: input.challenges,
        success: input.success,
        clientName: input.clientName,
      });
      return ui(`${summary.headline}. ${summary.situation} Retos: ${summary.challenges.join("; ")}. Éxito: ${summary.success}. ${summary.askPlan}`, {
        view: "summary",
        ...summary,
        goal: input.goal,
        status: summary.roleLabel,
        followUp: {
          tool: "build_strategy_plan",
          label: role === "seller" ? "Armar el plan de la reunión" : "Armar el plan",
          arguments: {
            goal: input.goal,
            role,
            clientName: input.clientName,
            challenges: summary.challenges,
          },
        },
      });
    },
  );

  registerAppTool(
    server,
    "show_discovery_guide",
    {
      title: "Discovery",
      description:
        "Muestra las preguntas de discovery (quién, objetivo, dolor) y cuáles ya están contestadas. Úsala cuando falte contexto antes del resumen.",
      inputSchema: z.object({
        goal: z.string().optional(),
        track: z.enum(["builder", "company"]).optional(),
        clientName: z.string().optional(),
        objective: z.string().optional(),
        needsContext: z.string().optional(),
        building: z.string().optional(),
        lookingFor: z.string().optional(),
        facts: z
          .array(
            z.object({
              factType: z.enum(["profile", "need", "pain", "stakeholder", "next_step", "skill_gap", "budget"]),
              value: z.string(),
              slotId: z.string().optional(),
            }),
          )
          .optional(),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (input) => {
      const facts = (input.facts ?? []) as DiscoveryFact[];
      const brief = computeDiscoveryBrief({
        track: input.track,
        clientName: input.clientName,
        objective: input.objective ?? input.goal,
        needsContext: input.needsContext,
        building: input.building,
        lookingFor: input.lookingFor,
        facts,
      });
      const readiness = assessContextLogic(brief);
      const goal = input.goal || input.objective || input.lookingFor || "";
      return ui(
        readiness.ready
          ? "Ya hay contexto suficiente para el resumen."
          : `Falta: ${readiness.missing.map((slot) => slot.question).join(" ")}`,
        {
          view: "discovery",
          title: "Discovery",
          goal,
          slots: brief.slots,
          knownCount: brief.knownCount,
          totalCount: brief.totalCount,
          next: brief.next,
          followUp: goal
            ? {
                tool: "match_community",
                label: "Ver la comunidad",
                arguments: { goal, clientName: input.clientName, lookingFor: input.lookingFor },
              }
            : undefined,
        },
      );
    },
  );

  registerAppTool(
    server,
    "build_strategy_plan",
    {
      title: "Plan de estrategia",
      description:
        "Arma el plan de la reunión o de la necesidad: hipótesis, preguntas, objeciones y apoyo de la comunidad. No inventa personas ni proyectos; si no pasas ids, toma los matches del objetivo.",
      inputSchema: z.object({
        goal: z.string(),
        role: roleSchema,
        clientName: z.string().optional(),
        challenges: z.array(z.string()).optional(),
        hypotheses: z.array(z.string()).optional(),
        valueAngle: z.string().optional(),
        objections: z.array(z.object({ objection: z.string(), answer: z.string() })).optional(),
        extraQuestions: z.array(z.string()).optional(),
        nextStep: z.string().optional(),
        peopleIds: z.array(z.string()).optional(),
        projectIds: z.array(z.string()).optional(),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (input) => {
      const role = inferRole({ role: input.role, clientName: input.clientName, text: input.goal });
      const ids = supportIds(input.goal, role, input.clientName, input.peopleIds, input.projectIds);
      const plan = buildStrategyPlanLogic({ ...input, role, ...ids });
      return ui(planAsText(plan), {
        view: "strategy",
        ...plan,
        goal: plan.objective,
        roleLabel: role === "seller" ? "Vendedor" : "Cliente",
        followUp: {
          tool: "build_product_plan",
          label: "Armar el plan de producto",
          arguments: {
            goal: input.goal,
            clientName: input.clientName,
            challenges: input.challenges,
            peopleIds: ids.peopleIds,
            projectIds: ids.projectIds,
          },
        },
      });
    },
  );

  registerAppTool(
    server,
    "build_product_plan",
    {
      title: "Plan de producto",
      description:
        "Arma el plan para construir la solución: problema, MVP, fases, equipo de la comunidad y siguiente paso. No inventa precios.",
      inputSchema: z.object({
        goal: z.string(),
        clientName: z.string().optional(),
        problem: z.string().optional(),
        outcome: z.string().optional(),
        challenges: z.array(z.string()).optional(),
        mvpScope: z.array(z.string()).optional(),
        laterScope: z.array(z.string()).optional(),
        skillsNeeded: z.array(z.string()).optional(),
        risks: z.array(z.string()).optional(),
        budget: z.string().optional(),
        nextStep: z.string().optional(),
        peopleIds: z.array(z.string()).optional(),
        projectIds: z.array(z.string()).optional(),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (input) => {
      const ids = supportIds(input.goal, "client", input.clientName, input.peopleIds, input.projectIds);
      const plan = buildProductPlanLogic({ ...input, ...ids });
      return ui(productPlanAsText(plan), {
        view: "product",
        ...plan,
        goal: input.goal,
      });
    },
  );

  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(DIST_HTML, "utf-8");
      return {
        contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}
