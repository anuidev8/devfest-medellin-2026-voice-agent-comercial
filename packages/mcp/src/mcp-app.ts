import { App } from "@modelcontextprotocol/ext-apps";
import "./mcp-app.css";

type FollowUp = { tool: string; label: string; arguments: Record<string, unknown> };

type Person = { id: string; name: string; role: string; city?: string; skills?: string[]; howItHelps?: string; why?: string };
type Project = { id: string; title: string; outcome: string; ownerName?: string; skills?: string[]; howItHelps?: string; why?: string };
type EventItem = { id: string; name: string; dateLabel?: string; city?: string; why?: string };
type Slot = { id: string; label: string; question: string; why: string; status: string; values: string[] };
type Question = { topic: string; question: string; why: string };

type Payload = {
  view: "community" | "summary" | "discovery" | "strategy" | "product" | "empty";
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
  knownCount?: number;
  totalCount?: number;
  next?: { question?: string; label?: string } | null;
  questions?: Question[];
  valueAngle?: string;
  objections?: { objection: string; answer: string }[];
  hypotheses?: string[];
  nextStep?: string;
  problem?: string;
  outcome?: string;
  scope?: { now: string[]; later: string[] };
  phases?: { name: string; duration?: string; outcome: string }[];
  team?: { skill: string; who: string }[];
  approach?: { name: string; why: string };
  support?: { people?: Person[]; projects?: Project[] };
  followUp?: FollowUp;
};

type ToolResult = {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
};

const titleEl = document.getElementById("title")!;
const statusEl = document.getElementById("status")!;
const board = document.getElementById("board")!;
const actions = document.getElementById("actions")!;

const app = new App({ name: "NoShy Concierge", version: "0.1.0" });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

function clear(node: HTMLElement) {
  node.replaceChildren();
}

function card(opts: {
  size?: "hero" | "square" | "wide" | "tall";
  title: string;
  caption?: string;
  text?: string;
  badge?: string;
  badgeKind?: "good" | "dim";
  avatar?: string;
  avatarTop?: boolean;
  skills?: string[];
  delay?: number;
}) {
  const article = document.createElement("article");
  article.className = `masonry-card masonry-card--${opts.size ?? "square"}`;
  article.style.animationDelay = `${opts.delay ?? 0}ms`;
  article.setAttribute("role", "listitem");

  const body = document.createElement("div");
  body.className = "masonry-card__body";
  const visual = document.createElement("div");
  visual.className = "masonry-card__visual";

  if (opts.badge) {
    const badge = document.createElement("span");
    badge.className = `masonry-card__badge${opts.badgeKind ? ` is-${opts.badgeKind}` : ""}`;
    badge.textContent = opts.badge;
    visual.append(badge);
  }
  if (opts.avatar) {
    const avatar = document.createElement("span");
    avatar.className = `masonry-card__avatar${opts.avatarTop ? " is-top" : ""}`;
    avatar.textContent = opts.avatar;
    visual.append(avatar);
  }
  if (opts.text) {
    const p = document.createElement("p");
    p.className = "masonry-card__visual-text";
    p.textContent = opts.text;
    visual.append(p);
  }
  if (opts.skills?.length) {
    const list = document.createElement("ul");
    list.className = "skills";
    for (const skill of opts.skills.slice(0, 4)) {
      const li = document.createElement("li");
      li.textContent = skill;
      list.append(li);
    }
    visual.append(list);
  }

  body.append(visual);
  const meta = document.createElement("div");
  meta.className = "masonry-card__meta";
  const h = document.createElement("h3");
  h.className = "masonry-card__title";
  h.textContent = opts.title;
  meta.append(h);
  if (opts.caption) {
    const caption = document.createElement("p");
    caption.className = "masonry-card__caption";
    caption.textContent = opts.caption;
    meta.append(caption);
  }
  article.append(body, meta);
  return article;
}

function paint(cards: HTMLElement[], heading: string, status?: string, followUp?: FollowUp) {
  titleEl.textContent = heading;
  if (status) {
    statusEl.hidden = false;
    statusEl.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "dot";
    statusEl.append(dot, document.createTextNode(status));
  } else {
    statusEl.hidden = true;
    statusEl.replaceChildren();
  }
  clear(board);
  cards.forEach((node, i) => {
    node.style.animationDelay = `${i * 70}ms`;
    board.append(node);
  });
  clear(actions);
  if (!followUp) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pill";
  button.textContent = followUp.label;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const result = await app.callServerTool({ name: followUp.tool, arguments: followUp.arguments });
      render(result as ToolResult);
    } catch (error) {
      paint(
        [card({ size: "wide", title: "No pude continuar", text: error instanceof Error ? error.message : "Error" })],
        "Concierge",
      );
    }
  });
  actions.append(button);
}

function renderCommunity(data: Payload) {
  const people = data.people ?? [];
  const projects = data.projects ?? [];
  const events = data.events ?? [];
  const cards: HTMLElement[] = [];
  people.forEach((person, i) => {
    cards.push(
      card({
        size: i === 0 ? "hero" : "square",
        title: person.name,
        caption: [person.role, person.city].filter(Boolean).join(" · "),
        text: person.howItHelps ?? person.why,
        avatar: initials(person.name),
        avatarTop: i === 0,
        badge: i === 0 ? "Más afín" : undefined,
        skills: person.skills,
      }),
    );
  });
  projects.forEach((project, i) => {
    cards.push(
      card({
        size: i === 0 && !people.length ? "hero" : "square",
        title: project.title,
        caption: project.ownerName ? `Proyecto · ${project.ownerName}` : "Proyecto",
        text: project.howItHelps ?? project.outcome,
        skills: project.skills,
      }),
    );
  });
  for (const event of events.slice(0, 1)) {
    cards.push(
      card({
        size: "wide",
        title: event.name,
        caption: [event.city, event.dateLabel].filter(Boolean).join(" · ") || "Evento",
        text: event.why,
      }),
    );
  }
  if (!cards.length) {
    cards.push(card({ size: "wide", title: "Sin coincidencias", text: "No encontré matches en la comunidad." }));
  }
  paint(cards, data.title || "Comunidad", data.goal, data.followUp);
}

function renderSummary(data: Payload) {
  const cards = [
    card({
      size: "hero",
      title: data.headline || "Resumen",
      caption: data.roleLabel,
      text: data.situation,
      badge: data.roleLabel,
    }),
    ...(data.challenges ?? []).map((challenge) =>
      card({ size: "square", title: "Reto", text: challenge }),
    ),
    card({ size: "wide", title: "Éxito", text: data.success || "Por definir juntos", caption: data.askPlan }),
  ];
  paint(cards, "Resumen", data.status, data.followUp);
}

function renderDiscovery(data: Payload) {
  const cards = (data.slots ?? []).map((slot, i) =>
    card({
      size: i === 0 ? "hero" : "square",
      title: slot.label,
      caption: slot.why,
      text: slot.values[0] || slot.question,
      badge: slot.status === "known" ? "Listo" : slot.status === "pending" ? "Pendiente" : "Falta",
      badgeKind: slot.status === "known" ? "good" : "dim",
    }),
  );
  const known = `${data.knownCount ?? 0}/${data.totalCount ?? cards.length}`;
  paint(cards, "Discovery", data.next?.question ? `Siguiente: ${data.next.question}` : known, data.followUp);
}

function renderStrategy(data: Payload) {
  const cards: HTMLElement[] = [
    card({
      size: "hero",
      title: data.headline || "Plan",
      caption: data.goal,
      text: data.valueAngle || data.problem,
    }),
  ];
  for (const hypothesis of (data.hypotheses ?? []).slice(0, 2)) {
    cards.push(card({ title: "Hipótesis", text: hypothesis }));
  }
  for (const question of (data.questions ?? []).slice(0, 5)) {
    cards.push(card({ title: question.topic, text: question.question, caption: question.why }));
  }
  for (const objection of (data.objections ?? []).slice(0, 2)) {
    cards.push(card({ title: objection.objection, text: objection.answer, caption: "Objeción" }));
  }
  for (const person of data.support?.people ?? []) {
    cards.push(card({ title: person.name, caption: person.role, text: person.howItHelps, avatar: initials(person.name), skills: person.skills }));
  }
  for (const project of data.support?.projects ?? []) {
    cards.push(card({ title: project.title, caption: "Caso de la comunidad", text: project.howItHelps || project.outcome }));
  }
  if (data.nextStep) cards.push(card({ size: "wide", title: "Siguiente paso", text: data.nextStep }));
  paint(cards, "Plan", data.roleLabel, data.followUp);
}

function renderProduct(data: Payload) {
  const cards: HTMLElement[] = [
    card({ size: "hero", title: data.headline || "Producto", text: data.outcome, caption: data.problem }),
  ];
  if (data.approach) cards.push(card({ size: "wide", title: data.approach.name, text: data.approach.why, caption: "Camino" }));
  for (const item of data.scope?.now ?? []) cards.push(card({ title: "MVP", text: item }));
  for (const phase of data.phases ?? []) {
    cards.push(card({ title: phase.name, text: phase.outcome, caption: phase.duration }));
  }
  for (const member of data.team ?? []) cards.push(card({ title: member.skill, text: member.who, caption: "Equipo" }));
  if (data.nextStep) cards.push(card({ size: "wide", title: "Siguiente paso", text: data.nextStep }));
  paint(cards, "Producto", data.goal, data.followUp);
}

function render(result: ToolResult) {
  if (result.isError) {
    const text = result.content?.find((part) => part.type === "text")?.text ?? "La herramienta falló.";
    paint([card({ size: "wide", title: "No pude mostrarlo", text })], "Concierge");
    return;
  }
  const data = result.structuredContent as Payload | undefined;
  if (!data?.view) {
    paint([card({ size: "wide", title: "Listo", text: result.content?.find((part) => part.type === "text")?.text })], "Concierge");
    return;
  }
  if (data.view === "community") renderCommunity(data);
  else if (data.view === "summary") renderSummary(data);
  else if (data.view === "discovery") renderDiscovery(data);
  else if (data.view === "strategy") renderStrategy(data);
  else if (data.view === "product") renderProduct(data);
}

app.ontoolresult = (result) => render(result as ToolResult);
void app.connect();

paint(
  [card({ size: "hero", title: "La misma mesa, en el chat", text: "Pide un match de comunidad, el resumen, las preguntas de discovery o un plan." })],
  "Concierge",
);
