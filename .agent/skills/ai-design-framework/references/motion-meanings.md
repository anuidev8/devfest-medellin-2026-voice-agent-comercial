# Motion meanings (Phases 4 and 6)

**Rule: every animation answers "what does this tell the user?"** If it tells nothing, remove it.

Each motion in the proposal is one row:

| Field | Example |
|---|---|
| `name` | `breathe-in` |
| `meaning` | "The product is inhaling with you — slow down" |
| `trigger` | orb enters viewport / user presses Start |
| `properties` | `scale 0.85 → 1`, `opacity 0.6 → 1` |
| `duration` | `{duration.breath-in}` = 4000ms |
| `easing` | `{easing.calm}` = cubic-bezier(0.4, 0, 0.2, 1) |
| `reducedMotion` | opacity only, no scale |

## Vocabulary — pick from here, then adapt to the product

| Motion | Typical meaning | Duration | Easing |
|---|---|---|---|
| **Fade up** (8–16px) | "New content, read this next" | 300–500ms | ease-out |
| **Stagger** (40–80ms between items) | "These belong together, in this order" | +60ms/item | ease-out |
| **Scale in** (0.96 → 1) | "This just appeared for you" (dialog, card) | 200–300ms | ease-out / spring |
| **Slide / shared-axis** | "You moved forward/back in a flow" | 300–450ms | ease-in-out |
| **Layout morph** (shared element) | "Same thing, more detail" (card → page) | 350–500ms | spring (no bounce) |
| **Press / squish** (scale 0.97) | "Your tap was received" | 100–150ms | ease-out |
| **Pulse** (one cycle) | "Look here / something changed" | 600–900ms | ease-in-out |
| **Loop / breathe** | "The system is alive / listening / waiting" | 2–6s | sine ease-in-out |
| **Progress fill** | "This is how far along you are" | follows real progress | linear |
| **Shake** (small, 2–3 cycles) | "That didn't work" | 300ms | ease-in-out |
| **Skeleton shimmer** | "Content is loading, layout is stable" | 1.2–1.6s loop | linear |
| **Parallax / scroll-linked** | "Depth; the story is moving" — use sparingly | scroll | linear |

## Easing personality

| Feel | Easing |
|---|---|
| Calm, premium | `cubic-bezier(0.4, 0, 0.2, 1)`, longer durations |
| Snappy, tool-like | `cubic-bezier(0.2, 0, 0, 1)`, 150–250ms |
| Playful | springs with a little bounce (`bounce: 0.25`) |
| Serious / enterprise | ease-out only, no bounce, short |

Bounce and overshoot read as playful — never use them in calm, medical, finance or luxury briefs.

## Duration tokens (default scale)

`instant 100ms · fast 200ms · base 300ms · slow 500ms · slower 800ms` + product-specific ones (e.g. `breath-in 4000ms`).

## Reduced motion (required)

With `prefers-reduced-motion: reduce`:
- Movement (translate/scale/rotate/parallax) → opacity or nothing.
- Loops stop or become a static state.
- Durations collapse (the generated CSS already sets duration tokens to 1ms; JS animations must check the media query too — e.g. `useReducedMotion()` in Motion).

## Implementation rule

One shared motion config (e.g. `lib/motion.ts`) that reads the tokens. Components import named motions (`motions.fadeUp`), never hardcode `duration: 0.4`.
