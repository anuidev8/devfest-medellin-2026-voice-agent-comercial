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

## Run it

Requirements: Node ≥ 22 (ADK quickstart lists 24+; use Node 24/25 if available).

```bash
cp packages/agent/.env.example packages/agent/.env   # add GOOGLE_GENAI_API_KEY (optional, see below)
cp packages/livekit/.env.example packages/livekit/.env
cp apps/web/.env.example apps/web/.env.local

npm install
npm run dev:agent   # terminal 1 -> http://localhost:8000/ag-ui  (GET /health)
npm run dev:web     # terminal 2 -> http://localhost:3000
```

**No Gemini key?** The agent server starts in `demo-no-key` mode: it emits the
exact same tool events with scripted replies (see `src/demo.ts`), so
community cards, proposal and calendar still demo in development. Add the key and
the real `LlmAgent` + Gemini path is used automatically.

Demo script (type or use 🎙️ Hablar):
1. “No sé cómo vender mi producto” → community matches and proposal
2. “Muéstrame las preguntas” → discovery questions
3. “Agenda una reunión” → `open_calendar` (frontend tool) abre el calendario
4. Público: abre `/audience` (ponlo en un QR), vota, y en el panel
   “Público en vivo” pulsa **Enviar al agente**

Other checks:

```bash
npm run test:tools -w @commercial/agent   # pure tool logic, no key needed
npx adk web                                # in packages/agent, ADK dev UI (with key)
curl localhost:8000/health
```

## Voice

- **Option A (default):** `VoiceRoom` uses Web Speech API → text → CopilotKit,
  plus `speechSynthesis` playback. Zero config, ideal for the talk.
- **Option B:** set `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`,
  `LIVEKIT_API_SECRET`; LiveKit tab → `POST /api/livekit/token` joins a room.
- **Option C — LiveKit Agents worker** (Python `packages/livekit`; Inference; brain via CopilotKit):

  ```bash
  npm run dev:agent      # AG-UI chat brain :8000
  npm run dev:livekit    # python agent.py dev
  npm run dev:web        # UI :3000
  ```

  Deploy voice worker: `cd packages/livekit && lk agent create`  
  (see `packages/livekit/README.md`).

## Deploy

- Agent (`packages/agent`): Cloud Run / Railway / Fly — env `GOOGLE_GENAI_API_KEY`, `PORT=8000`.
- LiveKit worker (`packages/livekit`): same host as a long-running process — `LIVEKIT_*` + Gemini key.
- Web (`apps/web`): Vercel — env `ADK_AG_UI_URL=https://<agent>/ag-ui`, `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY/SECRET`.

## Layout

```text
apps/web/app/
  api/copilotkit/[[...slug]]/route.ts   CopilotRuntime v2 -> ADKAgent -> bridge
  api/livekit/token/route.ts            LiveKit JWT
  api/livekit/session/route.ts          LiveKit room + agent dispatch
  components/ VoiceRoom · CommunityCards · IntakeForm · …
packages/agent/                         Google ADK brain + AG-UI server (no LiveKit)
  src/agent.ts · tools.ts · server.ts · demo.ts
packages/livekit/                       Python LiveKit voice worker (deployable)
  agent.py · tools.py · playbook.py · Dockerfile
```
