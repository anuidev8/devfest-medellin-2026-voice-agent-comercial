# Rating rubric (Phase 2)

Score every reference **1–10** on each criterion after looking at the image. Total = weighted average, one decimal.

| Criterion | Weight | 9–10 means | 1–3 means |
|---|---|---|---|
| **Brief fit** | 30% | Instantly feels like the product in `soul.md` (audience, emotion, tone) | Pretty, but for a different product or mood |
| **Hierarchy** | 15% | One clear focal point, obvious reading order, a clear CTA | Everything shouts; no entry point |
| **Color** | 15% | A palette with clear roles (bg / text / one accent) that could become tokens | Muddy, too many accents, poor contrast |
| **Typography** | 10% | Distinct type voice, a readable scale, good pairing | Generic or unreadable; no visible scale |
| **Originality** | 15% | Has an idea (metaphor, layout, texture) we can borrow without copying | Template look, generic SaaS/"AI purple glow" |
| **Buildability** | 15% | Can be built well in the target stack within the project scope; works responsive | Depends on bespoke illustration/3D/photos we don't have, or breaks on mobile |

```
total = 0.30·fit + 0.15·hierarchy + 0.15·color + 0.10·type + 0.15·originality + 0.15·build
```

## Rules

- Look at the image. A pin's title is not evidence.
- One line of reasoning per pin, naming what to **borrow** ("borrow: the slow radial gradient behind the CTA").
- **Diversity tiebreak:** if two pins are near duplicates, keep the higher one and drop the other, so the top N covers more ideas.
- A pin scoring ≤ 4 on brief fit is rejected regardless of total.
- Rejections need a reason the user can learn from ("neon glow conflicts with 'calm'").
- If fewer than N pins score ≥ 6.5, say so and suggest what to search for on Pinterest (2–3 queries).

## Table to show the user

```
| # | Pin | Fit | Hier | Color | Type | Orig | Build | Total | Borrow |
|---|-----|-----|------|-------|------|------|-------|-------|--------|
| 1 | 03-soft-orb.jpg | 10 | 8 | 9 | 7 | 8 | 8 | 8.7 | slow radial glow behind CTA |
```

Then: `Rejected: 07-neon-dashboard.jpg (neon conflicts with calm), …`
