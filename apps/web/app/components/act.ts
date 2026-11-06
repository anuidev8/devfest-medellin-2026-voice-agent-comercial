"use client";

import { INTAKE_FIELDS, useConcierge } from "./concierge";

/** The seven-act story from the mood board (audience votes reuse the current act). */
export type Act = "intro" | "context" | "community" | "proposal" | "send" | "booked";

const TOOL_ACT: Record<string, Act> = {
  show_discovery_guide: "context",
  save_meeting_fact: "context",
  summarize_context: "context",
  match_community: "community",
  build_strategy_plan: "proposal",
  send_plan_email: "send",
  confirm_plan: "send",
  open_calendar: "booked",
  book_meeting: "booked",
};

export const ACT_LABEL: Record<Act, string> = {
  intro: "Intro",
  context: "Contexto",
  community: "Comunidad",
  proposal: "Plan",
  send: "Envío",
  booked: "Reunión",
};

/** Read-only: derives the act from what the agent has already done. No new state, no logic changes. */
export function useAct(): Act {
  const { items, discovery, intake } = useConcierge();
  // `items` is newest first.
  const latest = items.find((i) => TOOL_ACT[i.name]);
  if (latest) return TOOL_ACT[latest.name]!;
  if (discovery || INTAKE_FIELDS.some((f) => intake[f.id])) return "context";
  return "intro";
}
