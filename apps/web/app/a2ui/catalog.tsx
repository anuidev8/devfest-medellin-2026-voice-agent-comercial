"use client";

import { createCatalog } from "@copilotkit/a2ui-renderer";
import { z } from "zod";
import { MatchCards, type CommunityMatch } from "../components/CommunityCards";
import { MasonrySkeletonBoard } from "../components/MasonryCard";

const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  city: z.string().optional(),
  skills: z.array(z.string()).default([]),
  howItHelps: z.string().optional(),
  why: z.string().optional(),
});

const ProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  outcome: z.string().optional().default(""),
  ownerName: z.string().optional(),
  skills: z.array(z.string()).optional(),
  howItHelps: z.string().optional(),
  why: z.string().optional(),
});

/**
 * Concierge A2UI catalog: basic primitives (plan surface) + CommunityBoard
 * for focused match_community results. Catalog id must match agent bridge.
 */
export const CONCIERGE_CATALOG_ID = "commercial/concierge@1";

const definitions = {
  CommunityBoard: {
    description:
      "Community match board. Streams cards one-by-one (status=building then ready). focus=projects|people|all. Not for the strategy plan card.",
    props: z.object({
      focus: z.enum(["projects", "people", "all"]).default("all"),
      goal: z.string().optional().default(""),
      status: z.enum(["building", "ready"]).optional().default("ready"),
      people: z.array(PersonSchema).optional().default([]),
      projects: z.array(ProjectSchema).optional().default([]),
    }),
  },
} as const;

/**
 * CommunityBoard (A2UI catalog component). The agent streams it card-by-card as an
 * a2ui-surface (status=building → ready). Bento masonry + skeletons while building.
 */
function CommunityBoardRenderer({
  props,
}: {
  props: z.infer<(typeof definitions)["CommunityBoard"]["props"]>;
}) {
  const focus = props.focus ?? "all";
  const people = focus === "projects" ? [] : (props.people as CommunityMatch["people"]);
  const projects = focus === "people" ? [] : (props.projects as CommunityMatch["projects"]);
  const building = props.status === "building";
  const empty = !(people?.length || projects?.length);

  return (
    <div className="a2ui-community-board">
      {empty && building ? (
        <MasonrySkeletonBoard count={5} label="Armando resultados" />
      ) : (
        <MatchCards
          layout="mosaic"
          pending={building}
          data={{ goal: props.goal, people, projects, events: [], packages: [] }}
        />
      )}
    </div>
  );
}

export const conciergeCatalog = createCatalog(definitions, {
  CommunityBoard: CommunityBoardRenderer,
}, {
  catalogId: CONCIERGE_CATALOG_ID,
  includeBasicCatalog: true,
});
