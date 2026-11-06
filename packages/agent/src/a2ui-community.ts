/**
 * Community board as a real A2UI surface (AG-UI ACTIVITY_SNAPSHOT, activityType "a2ui-surface").
 * Renders through the web catalog's `CommunityBoard` component (apps/web/app/a2ui/catalog.tsx).
 * Streams progressively: one snapshot per card (same messageId, replace: true).
 */

import type { MatchFocus } from "./match-focus.js";

export const COMMUNITY_SURFACE_ID = "community-match";

/** Shared with plan A2UI createSurface + web createCatalog. */
export const CONCIERGE_CATALOG_ID = "commercial/concierge@1";

type Person = { id?: string; name?: string; role?: string; city?: string; skills?: string[]; howItHelps?: string; why?: string };
type Project = { id?: string; title?: string; outcome?: string; ownerName?: string; skills?: string[]; howItHelps?: string; why?: string };

type MatchLike = {
  focus?: MatchFocus;
  people?: Person[];
  projects?: Project[];
  goal?: string;
};

export type CommunityBoardContent = {
  focus: MatchFocus;
  goal: string;
  status: "building" | "ready";
  people: Array<{
    id: string;
    name: string;
    role: string;
    city?: string;
    skills: string[];
    howItHelps?: string;
  }>;
  projects: Array<{
    id: string;
    title: string;
    outcome: string;
    ownerName?: string;
    skills?: string[];
    howItHelps?: string;
  }>;
};

function normalize(match: MatchLike) {
  const focus: MatchFocus = match.focus === "projects" || match.focus === "people" ? match.focus : "all";
  const people =
    focus === "projects"
      ? []
      : (match.people ?? []).slice(0, 5).map((p, i) => ({
          id: String(p.id ?? `person-${i}`),
          name: String(p.name ?? "Persona"),
          role: String(p.role ?? ""),
          city: p.city,
          skills: p.skills ?? [],
          howItHelps: p.howItHelps ?? p.why,
        }));
  const projects =
    focus === "people"
      ? []
      : (match.projects ?? []).slice(0, 4).map((p, i) => ({
          id: String(p.id ?? `proj-${i}`),
          title: String(p.title ?? "Proyecto"),
          outcome: String(p.outcome ?? ""),
          ownerName: p.ownerName,
          skills: p.skills,
          howItHelps: p.howItHelps ?? p.why,
        }));
  return { focus, goal: String(match.goal ?? ""), people, projects };
}

function frame(
  focus: MatchFocus,
  goal: string,
  people: CommunityBoardContent["people"],
  projects: CommunityBoardContent["projects"],
  status: "building" | "ready",
): CommunityBoardContent {
  return { focus, goal, status, people, projects };
}

/** Progressive content frames: empty → each project → each person → ready. */
export function buildCommunityBoardStreamFrames(match: MatchLike): CommunityBoardContent[] {
  const { focus, goal, people, projects } = normalize(match);
  const frames: CommunityBoardContent[] = [frame(focus, goal, [], [], "building")];

  let builtProjects: CommunityBoardContent["projects"] = [];
  let builtPeople: CommunityBoardContent["people"] = [];

  for (const project of projects) {
    builtProjects = [...builtProjects, project];
    frames.push(frame(focus, goal, builtPeople, builtProjects, "building"));
  }
  for (const person of people) {
    builtPeople = [...builtPeople, person];
    frames.push(frame(focus, goal, builtPeople, builtProjects, "building"));
  }

  frames.push(frame(focus, goal, people, projects, "ready"));
  return frames;
}

/** A2UI v0.9 ops for one frame: the whole surface is a single catalog `CommunityBoard` component. */
export function communityFrameToA2uiOperations(frame: CommunityBoardContent, surfaceId = COMMUNITY_SURFACE_ID) {
  return [
    { version: "v0.9", createSurface: { surfaceId, catalogId: CONCIERGE_CATALOG_ID } },
    {
      version: "v0.9",
      updateComponents: {
        surfaceId,
        components: [{ id: "root", component: "CommunityBoard", ...frame }],
      },
    },
  ];
}

/** Progressive A2UI frames (ops per snapshot) for the community board. */
export function buildCommunityA2uiStream(match: MatchLike) {
  return buildCommunityBoardStreamFrames(match).map((f) => communityFrameToA2uiOperations(f));
}
