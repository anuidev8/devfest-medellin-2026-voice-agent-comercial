# 03 · CopilotKit (the bridge) — how the frontend talks to the agent

Code: `apps/web` (Next.js 16, React 19). CopilotKit is **self-hosted** inside Next.js:
no CopilotKit Cloud account or public key is needed.

```text
Browser                                    Next.js server                     packages/agent
───────                                    ──────────────                     ──────────────
<CopilotKit runtimeUrl="/api/copilotkit">  /api/copilotkit/[[...slug]]        POST /ag-ui  (SSE)
  <CopilotChat agentId="default"/>   ───▶  CopilotRuntime v2            ───▶  ADK Runner.runAsync
  useAgent / useRenderTool / A2UI    ◀───   └ agents.default = ADKAgent  ◀───  ADK events → AG-UI events
                                              (url = ADK_AG_UI_URL)
```

## The 4 pieces

| File | Role |
|---|---|
| `app/providers.tsx` | `<CopilotKit runtimeUrl="/api/copilotkit" a2ui={{ catalog }}>` wraps the app |
| `app/api/copilotkit/[[...slug]]/route.ts` | `CopilotRuntime` with one agent `default = new ADKAgent({ url: ADK_AG_UI_URL })`, `a2ui: {}` enabled |
| `app/page.tsx` | `<CopilotChat agentId="default" />` + `useAgent()` for state |
| `app/components/*` | Generative UI: `useRenderTool` (render ADK tool calls), `useFrontendTool` (tools that run in the browser), A2UI catalog |

The only env var CopilotKit needs:

```dotenv
# apps/web/.env.local
ADK_AG_UI_URL=http://localhost:8000/ag-ui      # cloud: https://<agent-service>/ag-ui
```

It is read **server-side** in the route, so the agent URL is never exposed to the browser and
you don't need CORS between web and agent.

## Generative UI: how a tool becomes a card

1. ADK calls a tool (e.g. `match_community`).
2. `server.ts` emits AG-UI `TOOL_CALL_START/ARGS/END` + result with `toolCallName: "match_community"`.
3. In the browser, `useRenderTool({ name: "match_community", render })` (`CommunityCards.tsx`) matches
   that name and renders the card.

Rendered ADK tools today: `match_community`, `summarize_context`, `show_discovery_guide`,
`assess_context`, `build_strategy_plan`, `build_product_plan`.

**Frontend tool** (runs in the browser, the model can call it): `open_calendar` in `CalendarTool.tsx`
via `useFrontendTool({ name, parameters: z.object(...), handler })`.

**A2UI surfaces** (plan approval card, community board): `server.ts` emits `ACTIVITY_SNAPSHOT`
with `activityType: "a2ui-surface"`; the runtime's `a2ui: {}` middleware + `app/a2ui/catalog.tsx` render it.

### Add a new card (checklist)
1. Add the tool in `packages/agent/src/tools.ts` (Zod params) and mention it in `instruction.ts`.
2. Add `useRenderTool({ name: "<tool_name>", render: (...) => <YourCard/> })` in a component that is mounted.
3. If voice should react, handle it in `VoiceRoom.tsx`.
4. Restart `npm run dev`, trigger the tool in chat.

## Voice ↔ CopilotKit
`VoiceRoom.tsx` registers LiveKit RPC methods (`brain.ask`, `intake.submit`, `intake.field`,
`discovery.submit`, `plan.decide`, `calendar.open`, `calendar.pick`) and calls the worker with
`concierge.ask` / `concierge.finale`. `brain.ask` sends the user's request to the **same**
CopilotKit agent the chat uses, so chat and voice share one ADK session.

## Run

```bash
npm run dev            # everything
npm run dev:web        # web only (needs the agent on ADK_AG_UI_URL)
npm run build -w web   # production build check
```

## CopilotKit tooling
- `npx copilotkit@latest verify` — checks the project's CopilotKit wiring (run it first when chat doesn't respond).
- Version note: CopilotKit packages pin `@ag-ui/client` 1.0.2 while `@ag-ui/adk` pulls 1.0.3, hence the
  `as never` cast in the route. Keep `@copilotkit/*` versions aligned when upgrading.
- Docs: https://docs.copilotkit.ai

Deploy: [04 · Deploy → Web on Vercel](./04-deploy-cloud.md#3-web--vercel).
