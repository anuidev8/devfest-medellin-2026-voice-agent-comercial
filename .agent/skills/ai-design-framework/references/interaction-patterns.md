# Interaction patterns (Phases 4 and 6)

An interaction concept = **trigger → feedback → end state**, plus the motion it uses.

```json
{
  "name": "Hover-to-breathe CTA",
  "trigger": "pointer enters primary CTA (or focus via keyboard)",
  "feedback": "orb behind the CTA pulses once; CTA lifts 2px",
  "endState": "CTA stays highlighted until pointer leaves",
  "motion": "pulse",
  "why": "Connects the action to the core breathing metaphor"
}
```

Propose **4–8** per product. Make them specific to the brief; generic ones ("button has hover state") belong to component states, not here.

## Pattern library (pick, then make specific)

| Pattern | Trigger | Feedback | Good for |
|---|---|---|---|
| **Signature hero interaction** | load / pointer move | the hero reacts to the user (follows cursor, responds to voice, breathes) | first viewport memorability |
| **Scroll story** | scroll position | sections reveal in order; a sticky element changes state | narrative landings |
| **Progressive disclosure** | click "more" / expand | content expands in place with layout morph | dense info, pricing, FAQs |
| **Direct manipulation** | drag / swipe | element follows the finger, snaps to a value | sliders, cards, carousels |
| **Live preview** | typing / selecting options | result updates instantly next to the control | configurators, onboarding |
| **State machine stage** | user action or agent event | one stage morphs into the next (idle → listening → result) | voice/AI products |
| **Optimistic action** | submit | UI shows success immediately, rolls back on error | forms, likes, saves |
| **Empty → first value** | first visit | empty state teaches the one action that creates value | dashboards, apps |
| **Guided focus** | step change | dim everything except the current step | onboarding, checkout |
| **Micro-confirmation** | completion | small success motion + text, no modal | everywhere |

## Every interactive element needs these states

`default · hover · focus-visible · active/pressed · disabled · loading · error/success (if applicable)`

- Focus must be visible (2px ring using `accent`, offset 2px) — never `outline: none` without a replacement.
- Touch targets ≥ 44×44px.
- Hover effects must have a focus equivalent; nothing important can be hover-only (mobile has no hover).
