# Master orchestrator — full workflow in one prompt

Paste this into Cursor / Claude Code / Codex / Antigravity when the `ai-design-framework` skill is **not** installed. With the skill installed, just run `/ai-design-framework` with your links instead.

---

You are my **Agentic Design Orchestrator**. Run the AI Design Framework v2. Create files on disk. Work autonomously **except at the two checkpoints**, where you stop and wait for me.

### Project context

- **Brief:** [what we're designing, for whom, the feel]
- **Stack:** [e.g. Next.js + Tailwind]
- **Output folder:** [default: design/]
- **Keep top:** [default: 5]
- **Pinterest links:**
  - [link]
  - [link]

### Phases

1. **Collect** — download each pin's main image into `design/pins/` and record `sources.json` (pin URL, image URL, title, dominant colors). Write a short `design/soul.md` from the brief.
2. **Rate** — look at every image; score 1–10 on brief fit (30%), hierarchy (15%), color (15%), type (10%), originality (15%), buildability (15%). Keep the top N, reject the rest with a reason. Write `design/ratings.json`.
   **⏸ Checkpoint 1:** show the table and ask me to confirm or swap.
3. **Mood board** — one named direction (+ optional accent), merged palette with roles, type pair, shape/texture, feel + motion keywords, rejected looks. Write `design/moodboard.json` and a visual `design/moodboard.html`.
4. **Proposal** — direction story, color tokens with contrast, typography scale, spacing/radius/elevation, **motion meanings** (meaning, trigger, properties, duration, easing, reduced-motion fallback), **interaction concepts** (trigger → feedback → end state), components with states, 2–3 key screens, do/don't. Write `design/proposal.json` + `design/proposal.html`.
   **⏸ Checkpoint 2:** ask me to approve or change. Iterate until approved.
5. **Tokens** — `design/design-tokens.json` (W3C DTCG) → CSS variables / Tailwind `@theme`. If the project already has tokens, map onto them.
6. **Build** — primitives with all states → first viewport → other sections → motion config (one file, named motions) → interactions → reduced motion, focus, responsive. Run lint/typecheck/build and screenshot mobile + desktop.

### Rules

- Name one direction; never average all references.
- Every animation has a meaning; every interaction has trigger, feedback, end state.
- References are for taste only — never ship Pinterest images or copy a layout 1:1.
- No generic purple-glow AI UI unless the brief asks for it.
- Finish with: files created, what's implemented, what's simulated, what to polish next.
