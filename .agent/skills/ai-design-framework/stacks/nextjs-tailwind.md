# Build guide — Next.js (App Router) + Tailwind v4 + Motion

## 1. Tokens

```bash
node <skill>/scripts/tokens-to-css.mjs design/design-tokens.json app/design-tokens.css
```

In `app/globals.css`, right after `@import "tailwindcss";`:

```css
@import "./design-tokens.css";
```

Utilities now exist for every token: `bg-bg`, `bg-surface`, `text-text`, `text-muted`, `bg-accent`, `text-accent-ink`, `border-line`, `font-display`, `text-display`, `rounded-card`, `shadow-float`, `ease-calm`. Durations are plain variables: `duration-(--duration-base)`.

**Project already has tokens?** (e.g. `--bg`, `--surface` in `globals.css`): don't add a second system. Either update those variables' values from the proposal, or alias them (`--bg: var(--color-bg);`). Keep component class names working.

Dark mode: the generated file uses a `.dark` class plus `prefers-color-scheme`. Make sure Tailwind's dark variant matches: `@custom-variant dark (&:where(.dark, .dark *));`

## 2. Fonts

Use `next/font/google` in `app/layout.tsx` with its **own** variable names (not `--font-*`, which the tokens own):

```tsx
import { Fraunces, Inter } from "next/font/google";
const display = Fraunces({ subsets: ["latin"], variable: "--next-font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--next-font-body", display: "swap" });
// <html className={`${display.variable} ${body.variable}`}>
```

Then point the tokens at them in `design/design-tokens.json` and re-run the script:

```json
"font": {
  "$type": "fontFamily",
  "display": { "$value": ["var(--next-font-display)", "Georgia", "serif"] },
  "body": { "$value": ["var(--next-font-body)", "system-ui", "sans-serif"] }
}
```

## 3. Motion config — one file

Install if missing: `npm i motion`. Create `lib/motion.ts` from `proposal.json → motion`:

```ts
import type { Transition, Variants } from "motion/react";

export const ease = { calm: [0.4, 0, 0.2, 1], out: [0.2, 0, 0, 1] } as const;
export const dur = { fast: 0.2, base: 0.3, slow: 0.5, breathIn: 4, breathOut: 6 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: dur.slow, ease: ease.out } },
};

export const stagger = (step = 0.06): Transition => ({ staggerChildren: step });

// meaning: "the product inhales and exhales with you"
export const breathe = {
  animate: { scale: [0.85, 1, 0.85] },
  transition: { duration: dur.breathIn + dur.breathOut, times: [0, 0.4, 1], ease: "easeInOut", repeat: Infinity },
};
```

Components use `motions.fadeUp`, never inline numbers. Respect reduced motion:

```tsx
import { useReducedMotion } from "motion/react";
const reduce = useReducedMotion();
<motion.div {...(reduce ? {} : breathe)} />
```

Wrap client-animated components with `"use client"`; keep pages as server components.

## 4. Build order

1. `components/ui/` primitives with every state from the proposal (`hover`, `focus-visible`, `active`, `disabled`, `aria-busy` loading).
2. First viewport (`app/page.tsx` hero) as one composition.
3. Other sections.
4. Motion meanings → `lib/motion.ts` + usage.
5. Interaction concepts (one component or hook each, named after the concept).
6. Responsive: check 375px, 768px, 1440px.

## 5. Verify

```bash
npm run lint && npx tsc --noEmit && npm run build
```

Then open the dev server and screenshot mobile + desktop. Compare with `design/moodboard.html`; fix drift before reporting done.
