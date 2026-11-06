/** Plan approval detection (A2UI button, voice, chat) → session.state, independent of the model. */

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content.map((p) => (typeof p === "object" && p && "text" in p ? String((p as { text: unknown }).text) : "")).join("");
  return "";
}

/** "Apruebo el plan…" (A2UI button, voice, chat) → plan confirmed in session.state. */
export function approvalDelta(text: string): Record<string, unknown> {
  const t = text.trim().toLowerCase();
  if (/^apruebo el plan de producto/.test(t)) return { product_plan_status: "confirmed", plan_confirmed: true };
  if (/^apruebo el plan|el plan ya est[aá] aprobado|plan aprobado/.test(t)) return { plan_confirmed: true, plan_status: "ready_for_review" };
  return {};
}

export type HistoryMsg = { role?: string; content?: unknown; toolCalls?: { function?: { name?: string } }[] };

/**
 * Approval from the whole history since the latest plan (not only the last message): the A2UI
 * button, the voice ("El plan ya está aprobado…") and chat all count, whatever turn they came in.
 */
export function approvalFromHistory(messages: HistoryMsg[]): Record<string, unknown> {
  let planAt = -1;
  messages.forEach((m, i) => {
    if (m.role === "assistant" && (m.toolCalls ?? []).some((c) => /build_(strategy|product)_plan/.test(c.function?.name ?? ""))) planAt = i;
  });
  const delta: Record<string, unknown> = {};
  for (const m of messages.slice(planAt + 1)) if (m.role === "user") Object.assign(delta, approvalDelta(textOf(m.content)));
  return delta;
}

