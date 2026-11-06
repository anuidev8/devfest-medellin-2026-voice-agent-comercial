/** What section(s) of community match the user asked to see. */
export type MatchFocus = "projects" | "people" | "all";

/** Infer focus from utterance / tool fields (projects vs people/skills vs full). */
export function inferMatchFocus(input: {
  text?: string;
  goal?: string;
  lookingFor?: string;
  skills?: string;
  focus?: string;
}): MatchFocus {
  const explicit = input.focus?.toLowerCase();
  if (explicit === "projects" || explicit === "people" || explicit === "all") return explicit;

  const blob = [input.text, input.goal, input.lookingFor, input.skills].filter(Boolean).join(" ").toLowerCase();
  const wantsProjects = /(proyecto|project|caso(s)? de |portfolio|caso real|productos? (relacionad|similar|parecid)|soluci[oó]n(es)? (relacionad|similar|parecid))/.test(blob);
  const wantsPeople = /(persona|people|skill|talento|freelancer|alguien|experto|founder|especialista)/.test(blob);

  if (wantsProjects && !wantsPeople) return "projects";
  if (wantsPeople && !wantsProjects) return "people";
  return "all";
}

/** Strip match payload to the requested focus (Stage/A2UI only show what was asked). */
export function applyMatchFocus<T extends { people?: unknown[]; projects?: unknown[]; events?: unknown[]; packages?: unknown[]; speakers?: unknown[] }>(
  result: T,
  focus: MatchFocus,
): T & { focus: MatchFocus } {
  if (focus === "projects") {
    return { ...result, focus, people: [], events: [], packages: [], speakers: [] };
  }
  if (focus === "people") {
    return { ...result, focus, projects: [], events: [], packages: [], speakers: [] };
  }
  return { ...result, focus: "all" };
}
