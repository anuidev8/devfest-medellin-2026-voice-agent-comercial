import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CSS = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "src", "mcp-app.css"), "utf8");

type Person = { name: string; role?: string; city?: string; skills?: string[]; howItHelps?: string; why?: string };
type Project = { title: string; outcome?: string; ownerName?: string; skills?: string[]; howItHelps?: string };
type EventItem = { name: string; dateLabel?: string; city?: string; why?: string };
type Slot = { label: string; question: string; why?: string; status?: string; values?: string[] };
type Question = { topic: string; question: string; why?: string };

export type WidgetPayload = {
  view?: string;
  title?: string;
  status?: string;
  goal?: string;
  headline?: string;
  roleLabel?: string;
  situation?: string;
  challenges?: string[];
  success?: string;
  askPlan?: string;
  people?: Person[];
  projects?: Project[];
  events?: EventItem[];
  slots?: Slot[];
  questions?: Question[];
  valueAngle?: string;
  objections?: { objection: string; answer: string }[];
  hypotheses?: string[];
  nextStep?: string;
  problem?: string;
  outcome?: string;
  scope?: { now?: string[] };
  phases?: { name: string; duration?: string; outcome: string }[];
  team?: { skill: string; who: string }[];
  approach?: { name: string; why: string };
  support?: { people?: Person[]; projects?: Project[] };
  next?: { question?: string } | null;
  [key: string]: unknown;
};

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

function card(opts: {
  size?: string;
  title: string;
  caption?: string;
  text?: string;
  badge?: string;
  badgeKind?: string;
  avatar?: string;
  avatarTop?: boolean;
  skills?: string[];
}) {
  const skills = (opts.skills ?? [])
    .slice(0, 4)
    .map((skill) => `<li>${esc(skill)}</li>`)
    .join("");
  return `<article class="masonry-card masonry-card--${opts.size ?? "square"}" role="listitem">
    <div class="masonry-card__body"><div class="masonry-card__visual">
      ${opts.badge ? `<span class="masonry-card__badge${opts.badgeKind ? ` is-${opts.badgeKind}` : ""}">${esc(opts.badge)}</span>` : ""}
      ${opts.avatar ? `<span class="masonry-card__avatar${opts.avatarTop ? " is-top" : ""}">${esc(opts.avatar)}</span>` : ""}
      ${opts.text ? `<p class="masonry-card__visual-text">${esc(opts.text)}</p>` : ""}
      ${skills ? `<ul class="skills">${skills}</ul>` : ""}
    </div></div>
    <div class="masonry-card__meta">
      <h3 class="masonry-card__title">${esc(opts.title)}</h3>
      ${opts.caption ? `<p class="masonry-card__caption">${esc(opts.caption)}</p>` : ""}
    </div>
  </article>`;
}

function cardsFor(data: WidgetPayload): { heading: string; status?: string; cards: string[] } {
  if (data.view === "community") {
    const people = data.people ?? [];
    const projects = data.projects ?? [];
    const cards = [
      ...people.map((person, index) =>
        card({
          size: index === 0 ? "hero" : "square",
          title: person.name,
          caption: [person.role, person.city].filter(Boolean).join(" · "),
          text: person.howItHelps ?? person.why,
          avatar: initials(person.name),
          avatarTop: index === 0,
          badge: index === 0 ? "Más afín" : undefined,
          skills: person.skills,
        }),
      ),
      ...projects.map((project, index) =>
        card({
          size: index === 0 && !people.length ? "hero" : "square",
          title: project.title,
          caption: project.ownerName ? `Proyecto · ${project.ownerName}` : "Proyecto",
          text: project.howItHelps ?? project.outcome,
          skills: project.skills,
        }),
      ),
      ...(data.events ?? []).slice(0, 1).map((event) =>
        card({
          size: "wide",
          title: event.name,
          caption: [event.city, event.dateLabel].filter(Boolean).join(" · ") || "Evento",
          text: event.why,
        }),
      ),
    ];
    return { heading: data.title || "Comunidad", status: data.goal, cards: cards.length ? cards : [card({ size: "wide", title: "Sin coincidencias", text: "No encontré matches en la comunidad." })] };
  }

  if (data.view === "summary") {
    return {
      heading: "Resumen",
      status: data.roleLabel,
      cards: [
        card({ size: "hero", title: data.headline || "Resumen", caption: data.roleLabel, text: data.situation, badge: data.roleLabel }),
        ...(data.challenges ?? []).map((challenge) => card({ title: "Reto", text: challenge })),
        card({ size: "wide", title: "Éxito", text: data.success || "Por definir juntos", caption: data.askPlan }),
      ],
    };
  }

  if (data.view === "discovery") {
    return {
      heading: "Discovery",
      status: data.next?.question,
      cards: (data.slots ?? []).map((slot, index) =>
        card({
          size: index === 0 ? "hero" : "square",
          title: slot.label,
          caption: slot.why,
          text: slot.values?.[0] || slot.question,
          badge: slot.status === "known" ? "Listo" : "Falta",
          badgeKind: slot.status === "known" ? "good" : "dim",
        }),
      ),
    };
  }

  if (data.view === "strategy") {
    return {
      heading: "Plan",
      status: data.roleLabel,
      cards: [
        card({ size: "hero", title: data.headline || "Plan", caption: data.goal, text: data.valueAngle || data.problem }),
        ...(data.hypotheses ?? []).slice(0, 2).map((hypothesis) => card({ title: "Hipótesis", text: hypothesis })),
        ...(data.questions ?? []).slice(0, 5).map((question) => card({ title: question.topic, text: question.question, caption: question.why })),
        ...(data.objections ?? []).slice(0, 2).map((item) => card({ title: item.objection, text: item.answer, caption: "Objeción" })),
        ...(data.support?.people ?? []).map((person) => card({ title: person.name, caption: person.role, text: person.howItHelps, avatar: initials(person.name), skills: person.skills })),
        ...(data.support?.projects ?? []).map((project) => card({ title: project.title, caption: "Caso de la comunidad", text: project.howItHelps || project.outcome })),
        ...(data.nextStep ? [card({ size: "wide", title: "Siguiente paso", text: data.nextStep })] : []),
      ],
    };
  }

  return {
    heading: "Producto",
    status: data.goal,
    cards: [
      card({ size: "hero", title: data.headline || "Producto", text: data.outcome, caption: data.problem }),
      ...(data.approach ? [card({ size: "wide", title: data.approach.name, text: data.approach.why, caption: "Camino" })] : []),
      ...(data.scope?.now ?? []).map((item) => card({ title: "MVP", text: item })),
      ...(data.phases ?? []).map((phase) => card({ title: phase.name, text: phase.outcome, caption: phase.duration })),
      ...(data.team ?? []).map((member) => card({ title: member.skill, text: member.who, caption: "Equipo" })),
      ...(data.nextStep ? [card({ size: "wide", title: "Siguiente paso", text: data.nextStep })] : []),
    ],
  };
}

/** Self-contained page Antigravity can drop into an inline generative UI widget. */
export function renderWidgetHtml(data: WidgetPayload): string {
  const view = cardsFor(data);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(view.heading)}</title>
  <style>${CSS}</style>
</head>
<body>
  <main class="stage">
    <header class="app-head">
      <p class="eyebrow">NoShy Concierge</p>
      <h1>${esc(view.heading)}</h1>
      ${view.status ? `<p class="status"><span class="dot"></span>${esc(view.status)}</p>` : ""}
    </header>
    <div class="masonry-board" role="list">${view.cards.join("")}</div>
  </main>
</body>
</html>`;
}
