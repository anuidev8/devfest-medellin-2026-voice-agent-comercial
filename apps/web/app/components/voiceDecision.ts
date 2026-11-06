"use client";

/**
 * Voice → on-screen A2UI button. The LiveKit voice calls decide_plan → RPC plan.decide →
 * requestDecision(). The board switches to that plan's step, the A2UI surface finds its
 * approve / reject button, lights it up and presses it (the normal A2UI action follows).
 */
export type PlanWhich = "meeting" | "product";
export type Decision = { which: PlanWhich; approved: boolean; resolve: (pressed: boolean) => void };

let pending: Decision | null = null;
const listeners = new Set<(d: Decision) => void>();

/** Resolves true when a surface pressed the button, false on timeout (caller falls back to text). */
export function requestDecision(which: PlanWhich, approved: boolean, timeoutMs = 4500): Promise<boolean> {
  return new Promise((resolve) => {
    const decision: Decision = {
      which,
      approved,
      resolve: (pressed) => {
        if (pending === decision) pending = null;
        resolve(pressed);
      },
    };
    pending = decision;
    listeners.forEach((l) => l(decision));
    window.setTimeout(() => {
      if (pending === decision) decision.resolve(false);
    }, timeoutMs);
  });
}

/** Subscribe; the current pending decision (if any) is delivered right away (late mounts). */
export function subscribeDecision(listener: (d: Decision) => void) {
  listeners.add(listener);
  if (pending) listener(pending);
  return () => {
    listeners.delete(listener);
  };
}
