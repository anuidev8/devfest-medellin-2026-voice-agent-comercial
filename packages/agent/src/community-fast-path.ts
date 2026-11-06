/**
 * Fast path for "muéstrame los productos / personas relacionados": the answer is a deterministic
 * community match, so server.ts serves it without the two Gemini round-trips (~5–10 s → <1 s).
 * Anything that also asks for a plan, an email or a booking still goes through ADK.
 */

import type { MatchFocus } from "./match-focus.js";

export type CommunityShowRequest = { goal: string; focus: MatchFocus };

const OPENER = /^\s*(mu[eé]strame|ens[eé][ñn]ame|quiero ver|dame)\b/i;
const ABOUT_COMMUNITY = /(relacionad|proyecto|producto|persona|skill|talento|soluci[oó]n|caso|comunidad)/i;
// Requests that need the brain (plans, delivery) — checked on the request head only, not the user's case.
const NEEDS_BRAIN = /\b(plan(es)?|correo|email|e-mail|agend\w*|calendario|env[ií]a\w*)\b/i;
const PEOPLE = /(persona|people|skill|talento|freelancer|experto|especialista|equipo)/i;
const PROJECTS = /(proyecto|producto|soluci[oó]n|caso)/i;

/** The voice sends "Muéstrame … relacionados con mi caso: <caso>". Returns null when ADK should handle it. */
export function communityShowRequest(text: string): CommunityShowRequest | null {
  const t = text.trim();
  if (!t || t.length > 600) return null;
  const colon = t.indexOf(":");
  const head = colon >= 0 ? t.slice(0, colon) : t;
  if (!OPENER.test(head) || !ABOUT_COMMUNITY.test(head) || NEEDS_BRAIN.test(head)) return null;
  const goal = (colon >= 0 ? t.slice(colon + 1) : t).trim() || t;
  // Only people/skills → people; otherwise show both, as the board did with ADK.
  const focus: MatchFocus = PEOPLE.test(head) && !PROJECTS.test(head) ? "people" : "all";
  return { goal, focus };
}

type Named = { name?: string; title?: string };

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

/** Short reply for the chat + session history (the voice reads its closing question). */
export function communityShowReply(
  result: { people?: Named[]; projects?: Named[] },
  opts: { planShown: boolean },
): string {
  const people = (result.people ?? []).slice(0, 3).map((p) => p.name).filter((n): n is string => !!n);
  const projects = (result.projects ?? []).slice(0, 2).map((p) => (p.title ? `"${p.title}"` : "")).filter(Boolean);
  const parts: string[] = [];
  if (projects.length) parts.push(`proyectos como ${list(projects)}`);
  if (people.length) parts.push(`personas como ${list(people)}`);
  const found = parts.length
    ? `Te muestro de la comunidad ${parts.join(", y ")}.`
    : "No encontré coincidencias claras en la comunidad para tu caso.";
  const next = opts.planShown
    ? "¿Quieres que los sume a tu plan?"
    : "¿Te armo el plan para la reunión, el plan para construir el producto, o ambos?";
  return `${found} ${next}`;
}
