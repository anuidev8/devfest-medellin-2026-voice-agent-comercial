---
name: ai-design-framework
description: Turn Pinterest links (or any reference images) into a rated top-5, a visual mood board, a design proposal (colors, type, motion meanings, interaction concepts), a working HTML preview, design tokens, and implemented UI code with animations. Visual-first — every step is shown as an HTML page before any app code changes. Use when the user pastes Pinterest pins/links, asks for a mood board, a design direction or proposal, a design preview, design tokens from references, or wants to go from visual inspiration to a built interface. Works in Antigravity, Claude Code, Codex and Cursor.
---

# AI Design Framework v2 — Pinterest links → visual preview → built UI

## ⛔ Hard rules — read before doing anything

1. **Visual first.** Never create or edit app source code (`app/`, `src/`, `components/`, styles…) until the user has **seen and approved `design/preview.html`**. Everything before that lives in `design/`.
2. **Show every page.** Right after you write or update any HTML in `design/`, run `scripts/serve.mjs` and show it (see **Showing pages**). Writing an HTML file the user never sees does not count as done.
3. **Two gates — only the user opens them.**
   - Gate 1 (after rating): the user confirms the top N.
   - Gate 2 (after proposal + preview): the user approves the design.
   A reply like "continue" / "ok" / "next" approves **only the gate you are currently waiting at**. You may **never** set `"approved": true` yourself, and never pass two gates on one reply.
4. **End your turn at each gate.** Ask the question, then stop. Do not keep working "while waiting".
5. **Network commands** (`fetch-pins.mjs`) need internet. In Antigravity, if the sandbox blocks the command, re-run it outside the sandbox.

## The flow

```
links + brief
 → 1 Collect → 2 Rate ⛔gate 1 → 3 Mood board → 4 Proposal → 5 Preview ⛔gate 2 → 6 Tokens → 7 Build
              (show table)     (show page)     (show page)   (show page)
```

Paths are relative to this skill folder (`<skill>/`). Outputs go to `design/` in the project root unless the user names another folder.

## Inputs — parse these first

| Input | Required | Default |
|---|---|---|
| `links` — Pinterest pin URLs (any country domain, e.g. `co.pinterest.com`), `pin.it` short links, image URLs, or local image paths | yes | — |
| `brief` — what is being designed, for whom, the feel | yes (ask once if missing) | — |
| `name` — page/feature name | no | from brief |
| `stack` | no | detect from `package.json`; else `nextjs-tailwind` |
| `top` — references to keep | no | 5 (or all, if fewer links) |

Modes (plain words are fine):
- **full** (default) — phases 1–7.
- **moodboard only** — stop after 3. **preview only** — stop after 5 (no app code).
- **build** — start at 6 from an approved `design/proposal.json` + `design/preview.html`.
- **resume** — check which files exist in `design/` and continue from the first missing phase; re-show the latest page first.

---

## Phase 1 — Collect

```bash
node <skill>/scripts/fetch-pins.mjs --out design/pins <link1> <link2> ...
node <skill>/scripts/extract-palette.mjs design/pins
```

- Report how many downloaded / failed. Continue if ≥ 1 succeeded (with fewer than 3, warn that the direction will be thin).
- If Pinterest blocks the script entirely: use your browser tool to open each pin and save the main image into `design/pins/`, or ask the user to drop the images there.
- Write `design/soul.md` from the brief (`templates/soul.md`). Short; mark guesses `(assumed)`.

## Phase 2 — Rate → ⛔ Gate 1

1. **Open and look at every image.** Don't rate from titles.
2. Score with `references/rating-rubric.md`; write `design/ratings.json` (`templates/ratings.json`), `"approved": false`.
3. Show the table (rank, file, six scores, total, what to borrow) and thumbnails if your tool can show images.
4. Ask: **"Keep this top N? Swap any (e.g. 'replace 4 with 9') or say ok."** — then **end your turn**.

On the reply: apply swaps, set `ratings.json → approved: true`. Continue to phase 3 only.

## Phase 3 — Mood board → show

1. Follow `references/moodboard-guide.md`: one named direction (+ optional accent), merged palette with roles, type pair, shape/texture, feel + motion keywords, rejected looks.
2. Write `design/moodboard.json`; render and show:
   ```bash
   node <skill>/scripts/render.mjs <skill>/templates/moodboard.html design/moodboard.json design/moodboard.html
   node <skill>/scripts/serve.mjs design moodboard
   ```
3. Continue straight to phase 4 (no gate here) unless mode is *moodboard only*.

## Phase 4 — Proposal → show

Write `design/proposal.json` (`templates/proposal.json`, `"approved": false`):

- **Direction** — name + 2-sentence story tied to `soul.md`.
- **Colors** — semantic tokens, hex, usage, contrast (text ≥ 4.5:1, large/UI ≥ 3:1); dark mode if relevant.
- **Typography** — display/body roles, families, scale, weights.
- **Spacing, radius, elevation.**
- **Motion meanings** — meaning, trigger, properties, duration, easing, reduced-motion fallback (`references/motion-meanings.md`). No decorative motion.
- **Interaction concepts** — 4–8 trigger → feedback → end state (`references/interaction-patterns.md`).
- **Components** with states, **screens** (2–3, first viewport first), **do / don't**.

Also write `design/design-tokens.json` (`templates/design-tokens.json`) now — the preview needs it.

```bash
node <skill>/scripts/render.mjs <skill>/templates/proposal.html design/proposal.json design/proposal.html
node <skill>/scripts/serve.mjs design proposal
```

## Phase 5 — Preview → ⛔ Gate 2

Build the design as a **working HTML page** — the user's "artifact". It is what they approve, and what you (or another agent) build from.

```bash
node <skill>/scripts/tokens-to-css.mjs design/design-tokens.json design/tokens.css --plain
cp <skill>/templates/preview.html design/preview.html   # then replace every [ ] section
```

Requirements (the starter's header comment repeats them):
- The real first viewport + the key sections from `proposal.screens`, with real copy from `soul.md`.
- Only token variables (`var(--color-accent)`, `var(--text-display)`, `var(--ease-calm)`…), no raw hex.
- **Every motion** from `proposal.motion` implemented (CSS or Web Animations API) and tagged `data-motion="name"`.
- **Every interaction concept** working and tagged `data-interaction="name"`; component states (hover, focus-visible, pressed, disabled) visible.
- `data-note="…"` on anything a reviewer should know. Keep the toolbar (dark, reduced motion, design notes, mobile/tablet/desktop, replay) and the `#design-spec` JSON block.
- Works at 390px. Reduced motion swaps movement for opacity.

Show it:
```bash
node <skill>/scripts/serve.mjs design preview
```
In Antigravity / any tool with a browser: open the printed URL, take a **desktop and a mobile screenshot**, and include them in your message. Look at them yourself and fix obvious problems before asking.

Ask: **"Here's the design (hub: http://localhost:46xx/). Approve it, or tell me what to change — colors, motion, layout, copy?"** — then **end your turn**.

On change requests: update `proposal.json`, tokens, and `preview.html`; re-render; show again; ask again. On approval: set `"approved": true` in `proposal.json` and in the preview's `#design-spec`, and append the locked direction to `design/soul.md`.

*Optional — variants:* if the user wants options before locking, build 2–3 alternative previews (`design/preview-a.html`, `-b`, `-c`) from `references/one-shot-variants.md` and let them pick.

## Phase 6 — Tokens into the app

1. Generate app CSS: `node <skill>/scripts/tokens-to-css.mjs design/design-tokens.json <app-css-path>` (Tailwind v4 `@theme`; add `--plain` for non-Tailwind). See the stack guide for the path.
2. **Existing token system** (e.g. `--bg`, `--surface` in `globals.css`): map the approved values onto the existing names instead of adding a parallel system. List what changed.

## Phase 7 — Build from the preview

`design/preview.html` is the spec. Read it (markup, CSS, `data-motion`, `data-interaction`, `#design-spec`) and reproduce it in the stack:

1. Stack guide: `stacks/nextjs-tailwind.md` (default). Other stacks: same order, their idioms.
2. Order: tokens wired + fonts → primitives with all states → first viewport → other sections → one shared motion config with named motions → interaction concepts → reduced motion, focus, responsive.
3. Verify: lint/typecheck/build; open the dev server; screenshot mobile + desktop **next to the preview** and fix drift.
4. Summary: files changed, which motions/interactions are implemented, anything simulated, what to polish next.

---

## Showing pages

`scripts/serve.mjs` serves `design/` on `http://localhost:4600` (next free port if busy), writes a **hub page** linking mood board / proposal / preview with their status, opens the browser, and returns immediately (server keeps running). Re-running reuses the same server. `--stop` stops it.

| Tool | After `serve.mjs` |
|---|---|
| **Antigravity** | Open the URL with the browser tool; screenshot the page (desktop + mobile for the preview) so it appears in the conversation. Link the URL in your message. |
| **Claude Code** with the Artifact tool | Also publish the page as an artifact (pins as supporting files) and give the link. |
| **Codex / Cursor / others** | Use the built-in browser if available; always print the URL. |

## Rules

- References are for taste only — never ship Pinterest images or copy a pin's layout 1:1.
- One named direction; never average all references.
- Every color is a token; every motion has a meaning; every interaction has trigger, feedback, end state.
- No generic purple-glow AI UI unless the brief asks for it.
- Respect `soul.md` non-goals and everything locked at the gates.

## Files in this skill

| Path | Use |
|---|---|
| `scripts/fetch-pins.mjs` | 1 — download pins |
| `scripts/extract-palette.mjs` | 1 — dominant colors |
| `scripts/render.mjs` | 3, 4 — JSON → HTML page |
| `scripts/tokens-to-css.mjs` | 5, 6 — tokens → CSS / Tailwind |
| `scripts/serve.mjs` | every page — localhost hub + open browser |
| `references/rating-rubric.md` | 2 |
| `references/moodboard-guide.md` | 3 |
| `references/motion-meanings.md` | 4, 5, 7 |
| `references/interaction-patterns.md` | 4, 5, 7 |
| `references/one-shot-variants.md` | 5 (optional variants) |
| `references/master-orchestrator.md` | one-prompt version for tools without skills |
| `templates/` | output shapes, page templates, `preview.html` starter |
| `stacks/nextjs-tailwind.md` | 7 |
