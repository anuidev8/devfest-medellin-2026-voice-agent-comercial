# Commercial Voice Agent

**Google ADK (TypeScript) is the brain · LiveKit is the voice · AG-UI/CopilotKit is the bridge · Generative UI is the commercial experience.**

LiveKit never talks to ADK directly. CopilotKit owns the ADK session.

```text
Next.js + React UI (chat / voice / generative cards)
  └─ CopilotKit + AG-UI client (ADKAgent)
        ↓  /api/copilotkit  (CopilotRuntime v2)
AG-UI bridge server  packages/agent/src/server.ts   ← TypeScript, Express + SSE
        ↓  ADK Runner.runAsync
Google ADK TypeScript agent (LlmAgent + FunctionTool)

Voice (separate Python package — deploy with `lk agent create`):
  Browser LiveKit room  ←→  packages/livekit (Gemini Live via Inference)
        ↓ RPC (brain.ask / intake.submit / …)
  Browser CopilotKit  →  AG-UI  →  ADK brain  →  Generative UI cards
```

## ⚠️ Correction to the original plan

`@ag-ui/adk` (npm, TypeScript) is **only a client**: `ADKAgent extends HttpAgent`.
The documented server middleware (`ag_ui_adk` / `add_adk_fastapi_endpoint`) is **Python**.
There is no `createAgUiAdkHandler` in TypeScript. So `packages/agent/src/server.ts`
implements the AG-UI server in TS: it accepts `RunAgentInput`, runs the ADK
`Runner`, and translates ADK `Event`s (text parts, `getFunctionCalls`,
`getFunctionResponses`) into AG-UI SSE events (`RUN_*`, `TEXT_MESSAGE_*`,
`TOOL_CALL_*`). CopilotKit matches `toolCallName` in `useRenderTool`, which is
what makes the Generative UI cards render.

Also: ADK JS 2.x `FunctionTool.parameters` is a **Zod object** (validated at
call time), not a raw JSON-Schema object.

## Run it — one command

Requirements: Node ≥ 22 (24 recommended), Python 3.12 for the voice worker (optional).

```bash
npm run setup     # once: env files from .env.example, npm install, Python venv
npm run dev       # agent :8000 + web :3000 + LiveKit voice worker — Ctrl+C stops all
```

- `npm run dev -- --no-livekit` → chat only. Voice worker is also skipped automatically if LiveKit keys or the venv are missing.
- One terminal per service still works: `npm run dev:agent` · `npm run dev:web` · `npm run dev:livekit` · `npm run dev:adk-web`.
- Open http://localhost:3000 (audience page: `/audience`). Agent status: `npm run health`.

**No Gemini key?** The agent starts in `demo-no-key` mode: same tool events with scripted replies
(`src/demo.ts`), so every card still demos. Add a key and the real `LlmAgent` + Gemini path is used automatically.

## Guides (step by step)

| | Guide |
|---|---|
| 🚀 | [00 · Quickstart](docs/guides/00-quickstart.md) — tools, setup, run everything |
| 🧠 | [01 · Google ADK](docs/guides/google-adk/01-google-adk.md) — get Gemini keys (Vertex AI / AI Studio), sessions, Meet/Calendar, `adk web` |
| 🎙️ | [02 · LiveKit](docs/guides/livekit/02-livekit.md) — LiveKit + ElevenLabs keys, run & deploy the voice worker |
| 🔌 | [03 · CopilotKit](docs/guides/copilotkit/03-copilotkit.md) — how the frontend connects to the agent, Generative UI |
| ☁️ | [04 · Deploy](docs/guides/deploy/04-deploy-cloud.md) — Cloud Run → LiveKit Cloud → Vercel |
| 🐞 | [05 · Debugging](docs/guides/debugging/05-debugging.md) — logs, inspectors, common errors |

Agent design docs (architecture, tools, prompt): [`docs/`](docs/README.md) · Chat test scenarios: [`COPILOTKIT-CHAT-TEST-GUIDELINES.txt`](COPILOTKIT-CHAT-TEST-GUIDELINES.txt)

Demo script (type or use 🎙️ Hablar):
1. “No sé cómo vender mi producto” → community matches and proposal
2. “Muéstrame las preguntas” → discovery questions
3. “Agenda una reunión” → `open_calendar` (frontend tool) abre el calendario
4. Público: abre `/audience` (ponlo en un QR), vota, y en el panel
   “Público en vivo” pulsa **Enviar al agente**

## Voice

- **Option A (default):** `VoiceRoom` uses Web Speech API → text → CopilotKit, plus `speechSynthesis` playback. Zero config.
- **Option B:** set `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`; `POST /api/livekit/token` joins a room.
- **Option C — LiveKit Agents worker** (Python `packages/livekit`, started by `npm run dev`): brain via browser RPC → CopilotKit. See [02 · LiveKit](docs/guides/livekit/02-livekit.md).

## Deploy (summary — full steps in [04 · Deploy](docs/guides/deploy/04-deploy-cloud.md))

| Piece | Where | How |
|---|---|---|
| Agent `packages/agent` | Cloud Run | `gcloud run deploy noshy-agent --source packages/agent …` (Dockerfile included) |
| Voice `packages/livekit` | LiveKit Cloud | `cd packages/livekit && lk agent create --secrets-file .env`, then `lk agent deploy` |
| Web `apps/web` | Vercel | Import repo, Root Directory `apps/web`, env `ADK_AG_UI_URL=https://<agent>/ag-ui` + `LIVEKIT_*` |

## Layout

```text
apps/web/app/
  api/copilotkit/[[...slug]]/route.ts   CopilotRuntime v2 -> ADKAgent -> bridge
  api/livekit/token/route.ts            LiveKit JWT
  api/livekit/session/route.ts          LiveKit room + agent dispatch
  components/ VoiceRoom · CommunityCards · IntakeForm · …
packages/agent/                         Google ADK brain + AG-UI server (no LiveKit)
  src/agent.ts · tools.ts · server.ts · demo.ts · Dockerfile (Cloud Run)
packages/livekit/                       Python LiveKit voice worker (deployable)
  agent.py · tools.py · playbook.py · Dockerfile
scripts/
  setup.mjs · dev.mjs                   npm run setup / npm run dev (all services)
docs/guides/                            step-by-step setup, grouped by product
  00-quickstart.md
  google-adk/ · livekit/ · copilotkit/ · deploy/ · debugging/
```
