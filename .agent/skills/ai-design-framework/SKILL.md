---
name: ai-design-framework
description: Turn Pinterest links (or any reference images) into a rated top-5, a visual mood board, a design proposal (colors, type, motion meanings, interaction concepts), design tokens, and implemented UI code with animations. Use when the user pastes Pinterest pins/links, asks for a mood board, a design direction or proposal, design tokens from references, or wants to go from visual inspiration to a built interface. Works in Claude Code, Antigravity, Codex and Cursor.
---

# AI Design Framework v2 — Pinterest links → built UI

The user gives you **reference links + a short brief**. You run 6 phases, stop at **2 checkpoints**, and leave every decision on disk so the next phase (or another agent) can continue.

```
links + brief
 → 1 Collect   → 2 Rate (top 5) ⏸ → 3 Mood board → 4 Proposal ⏸ → 5 Tokens → 6 Build
```

All paths below are relative to this skill folder (`<skill>/`). All outputs go to `design/` in the user's project root unless they name another folder.

## Inputs — parse these first

| Input | Required | Default |
|---|---|---|
| `links` — Pinterest pin URLs, `pin.it` short links, direct image URLs, or local image paths | yes | — |
| `brief` — what is being designed, for whom, the feel | yes (ask once if missing) | — |
| `stack` | no | detect from `package.json`; else `nextjs-tailwind` |
| `top` — how many references to keep | no | 5 |
| `out` | no | `design/` |

Modes (the user may say them in plain words):
- **full** (default) — phases 1–6.
- **moodboard-only** — stop after phase 3.
- **proposal-only** — stop after phase 4.
- **build** — start at phase 5 from an existing approved `design/proposal.json`.
- **resume** — look at which files exist in `design/` and continue from the first missing phase.

If `design/` already has outputs, say which phases are done and continue from there instead of redoing them.

---

## Phase 1 — Collect (automatic)

```bash
node <skill>/scripts/fetch-pins.mjs --out design/pins <link1> <link2> ...
node <skill>/scripts/extract-palette.mjs design/pins
```

- `fetch-pins.mjs` resolves short links, reads each pin's `og:image`, downloads the largest version, and writes `design/pins/sources.json`.
- `extract-palette.mjs` adds the 6 dominant colors per image into `sources.json`.
- Links that fail (private pin, login wall) are listed in `sources.json` under `failed`. Tell the user how many failed; do not stop unless fewer than 3 images succeeded. If the script cannot reach Pinterest at all, fall back to the agent's browser tool (open each pin, screenshot the main image into `design/pins/`) or ask the user to drop the images into `design/pins/`.
- Write `design/soul.md` from the brief using `templates/soul.md`. Keep it short; mark guesses with `(assumed)`.

## Phase 2 — Rate and pick the top N (⏸ checkpoint 1)

1. **Look at every image** (open the files; do not rate from titles).
2. Score each with `references/rating-rubric.md` — six weighted criteria, 1–10 each, a one-line reason per pin.
3. Keep the top N (default 5). Reject the rest with one reason each.
4. Write `design/ratings.json` (shape: `templates/ratings.json`).
5. **Stop and show** a table: rank, file, each score, total, one-line reason; then the rejected list. Ask:
   > Keep this top 5? You can swap ("replace 4 with pin 9"), change the count, or say ok.

Do not continue until the user answers. Apply swaps to `ratings.json` (`selected` + `swaps`).

## Phase 3 — Mood board (automatic)

1. From the selected pins, extract the shared taste. Do **not** average all pins into a mushy middle — name one primary direction and at most one accent (see `references/moodboard-guide.md`).
2. Write `design/moodboard.json` (shape: `templates/moodboard.json`): direction name, blend, palette (merged from the pins' palettes, 5–8 colors with roles), type suggestions, texture/shape notes, 5–8 feel keywords, motion keywords, rejected looks.
3. Render it:
   ```bash
   node <skill>/scripts/render.mjs <skill>/templates/moodboard.html design/moodboard.json design/moodboard.html
   ```
4. Show it — see **Showing pages** below.

`moodboard-only` mode stops here.

## Phase 4 — Proposal (⏸ checkpoint 2)

Write `design/proposal.json` (shape: `templates/proposal.json`), then render `templates/proposal.html` → `design/proposal.html` with `render.mjs`. The proposal must contain:

- **Direction** — name + 2-sentence story tied to `soul.md`.
- **Color tokens** — semantic names (`bg`, `surface`, `text`, `muted`, `accent`, `accent-ink`, `line`, status colors), hex values, usage, and a contrast check (body text ≥ 4.5:1, large text/UI ≥ 3:1). Include dark mode if the brief or project needs it.
- **Typography** — display/body/mono roles, families (Google Fonts or system), scale, weights, line heights.
- **Spacing, radius, elevation.**
- **Motion meanings** — every motion has a *meaning*, a trigger, duration, easing and a reduced-motion fallback. Use `references/motion-meanings.md`. No decorative motion without a meaning.
- **Interaction concepts** — 4–8 trigger → feedback → state patterns from `references/interaction-patterns.md`, specific to this product.
- **Components** — the inventory to build, each with states.
- **Screens** — 2–3 key layouts described in words (first viewport first).
- **Do / Don't** — 3–5 each, so later agents don't drift.

**Stop and show** the proposal page. Ask:
> Approve this direction, or tell me what to change (e.g. warmer accent, less motion)?

Apply changes, re-render, and repeat until approved. Then set `"approved": true` in `proposal.json` and append the locked direction to `design/soul.md` under **Locked Direction**.

`proposal-only` mode stops here.

**Optional — variants.** If the user wants to explore before locking ("show me options"), generate 3–6 distinct directions with `references/one-shot-variants.md` *before* writing the proposal, show them side by side, and write the proposal for the one they pick.

## Phase 5 — Tokens (automatic)

1. Write `design/design-tokens.json` in W3C Design Tokens (DTCG) format — shape: `templates/design-tokens.json`. Colors, typography, spacing, radius, shadow, and **motion** (`duration.*`, `easing.*`).
2. Generate stack output:
   ```bash
   node <skill>/scripts/tokens-to-css.mjs design/design-tokens.json <css-output-path>
   ```
   It writes CSS custom properties (`:root` + `.dark`/`prefers-color-scheme`) and a Tailwind v4 `@theme` block. See the stack guide for where the file goes.
3. **Existing projects:** if the project already has tokens (e.g. `globals.css` with `--bg`, `--surface`…), map the new values onto the existing token names instead of inventing a parallel system. Report what changed.

## Phase 6 — Build (automatic)

1. Read the stack guide: `stacks/nextjs-tailwind.md` (default). For other stacks, follow the same order with the stack's idioms.
2. Order of work:
   1. Tokens wired in (fonts loaded, CSS imported).
   2. Primitives (button, card, input…) with all states from the proposal.
   3. The first viewport as one composition.
   4. Remaining sections/screens.
   5. Motion — implement each motion meaning from `proposal.json`; one shared motion config, never magic numbers in components.
   6. Interactions — each interaction concept from the proposal.
   7. Reduced motion, keyboard focus, responsive pass (mobile 375px, desktop 1440px).
3. Verify: run the project's typecheck/lint/build. If a browser tool is available, open the dev server and screenshot mobile + desktop; compare against the mood board and fix drift.
4. Finish with a summary: files created/changed, which motion meanings and interactions are implemented, anything simulated, what to polish next.

---

## Showing pages

- **Claude Code** with the Artifact tool: publish `design/moodboard.html` / `design/proposal.html` as artifacts so the user gets a shareable link (images are referenced relatively — publish `design/pins/*` as supporting files, or upload them as assets).
- **Antigravity / Codex / Cursor:** open the HTML file in the built-in browser if available; otherwise tell the user the absolute path to open.

## Rules

- References are for taste only. Never ship Pinterest images in production UI or copy a pin's layout 1:1.
- Name one direction. Don't average.
- Every color is a token; every animation has a meaning; every interaction has a trigger, feedback and end state.
- Avoid generic "AI purple glow" unless the brief explicitly asks for it.
- Respect `soul.md` non-goals and what the user locked at each checkpoint.
- Keep files small and readable — later agents load them as context.

## Files in this skill

| Path | Use |
|---|---|
| `scripts/fetch-pins.mjs` | Phase 1 — download pins |
| `scripts/extract-palette.mjs` | Phase 1 — dominant colors |
| `scripts/render.mjs` | Phases 3–4 — JSON → HTML page |
| `scripts/tokens-to-css.mjs` | Phase 5 — tokens → CSS / Tailwind |
| `references/rating-rubric.md` | Phase 2 |
| `references/moodboard-guide.md` | Phase 3 |
| `references/motion-meanings.md` | Phase 4, 6 |
| `references/interaction-patterns.md` | Phase 4, 6 |
| `references/master-orchestrator.md` | One-prompt version for tools without skills |
| `templates/` | Output shapes and page templates |
| `stacks/nextjs-tailwind.md` | Phase 6 build guide |
