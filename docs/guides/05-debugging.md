# 05 · Debugging

Work **bottom-up**: agent → CopilotKit → frontend → voice. Each layer can be tested alone.

## 0. First 60 seconds

```bash
npm run health                                  # 1. agent alive? mode adk-gemini or demo-no-key?
curl -s localhost:3000/api/copilotkit/info      # 2. CopilotKit runtime sees agent "default"?
npm run typecheck                               # 3. no type errors
npm run test:tools -w @commercial/agent         # 4. tool logic ok (no key)
```

## Agent (Google ADK)

**Logs:** the `[agent]` lines of `npm run dev` (or `npm run dev:agent`). Startup prints mode + session store:
`ADK AG-UI server on http://localhost:8000/ag-ui (mode: adk-gemini, sessions: memory)`.

**Talk to the agent without the frontend** — ADK dev UI shows every event, tool call, args, result and state:
```bash
npm run dev:adk-web       # http://localhost:8100
```

**Call AG-UI directly** (see the raw SSE stream the frontend receives):
```bash
curl -N localhost:8000/ag-ui -H 'content-type: application/json' -d '{
  "threadId":"debug-'"$(date +%s)"'","runId":"r1","state":{},"tools":[],"context":[],"forwardedProps":{},
  "messages":[{"id":"m1","role":"user","content":"Hola, vengo a preparar una venta"}]}'
```
You should see `RUN_STARTED`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `RUN_FINISHED`. A `RUN_ERROR` carries the
message; with Agent Engine sessions use a fresh `threadId` each time (the example does).

**Breakpoints (VS Code / Chrome DevTools):**
```bash
cd packages/agent && node --inspect --import tsx src/server.ts
# VS Code: "Debug: Attach to Node Process"   ·   Chrome: chrome://inspect
```

| Symptom | Cause / fix |
|---|---|
| `mode: demo-no-key` but you set a key | `.env` not in `packages/agent/`, or `GOOGLE_GENAI_USE_VERTEXAI=true` with empty `GOOGLE_CLOUD_PROJECT` |
| `Could not load the default credentials` | `gcloud auth application-default login` |
| `403 PERMISSION_DENIED aiplatform` | enable `aiplatform.googleapis.com`; on Cloud Run grant `roles/aiplatform.user` to the service account |
| `404 model not found` | model not available in `GOOGLE_CLOUD_LOCATION`; try `us-central1` or change `ADK_MODEL` |
| `429 RESOURCE_EXHAUSTED` | quota; wait, switch region, or request quota |
| Session errors with Agent Engine | wrong `GOOGLE_CLOUD_AGENT_ENGINE_ID` or region; remove it to fall back to memory sessions |
| `EADDRINUSE :8000` | `lsof -iTCP:8000 -sTCP:LISTEN` → `kill <pid>` (same for `:3000`) |
| Tool not called | tool description / `instruction.ts` — see [02 tool design](../02-tool-design.md) |

## CopilotKit / frontend

**Logs:** `[web]` lines (server route) + browser DevTools console (client).

- **Network tab** → filter `copilotkit` → open the request → **EventStream / Response** shows AG-UI events coming back.
- `npx copilotkit@latest verify` checks the wiring.
- Wrong agent URL: check `ADK_AG_UI_URL` in `apps/web/.env.local` and restart `next dev` (env is read at boot).

| Symptom | Cause / fix |
|---|---|
| Chat spins forever / `fetch failed` in `[web]` | agent not running or `ADK_AG_UI_URL` wrong |
| Text appears but **no card** | `useRenderTool({ name })` doesn't match the ADK tool name exactly, or the component with the hook isn't mounted |
| Plan approval card missing | A2UI: route must have `a2ui: {}` and `providers.tsx` the catalog; check `ACTIVITY_SNAPSHOT` in the stream |
| Frontend tool (`open_calendar`) never runs | the model must be told about it in `instruction.ts`; check it appears in `tools` of the AG-UI request |
| Type error on `ADKAgent` | duplicated `@ag-ui/client`; keep the `as never` cast or align versions |
| Stale behaviour after edits | `rm -rf apps/web/.next` and restart |

## LiveKit voice worker

**Logs:**
```bash
npm run logs:livekit                   # tail packages/livekit/logs/livekit-agent.log (dev mode writes it)
LOG_LEVEL=DEBUG npm run dev:livekit    # verbose
lk agent logs                          # deployed worker on LiveKit Cloud
```
Useful lines: `rpc → brain.ask {...}`, `brain result ok=True`, `closing agent session due to participant disconnect`.

- **Browser side:** DevTools console for `VoiceRoom` RPC errors; LiveKit Cloud dashboard → **Sessions** shows rooms, participants and whether the agent joined.
- **Without the browser:** `cd packages/livekit && .venv/bin/python agent.py console` (speech pipeline only; RPC to the brain is unavailable there).

| Symptom | Cause / fix |
|---|---|
| `/api/livekit/session` → **501** | `LIVEKIT_*` missing in `apps/web/.env.local` |
| `/api/livekit/session` → **502 Agent dispatch failed** | worker not running, or `LIVEKIT_AGENT_NAME` differs between web and worker |
| Agent joins but is silent | `ELEVEN_API_KEY` must be the `sk_…` secret; or set `VOICE_PROVIDER=livekit` |
| Agent talks but never shows cards | browser RPC `brain.ask` failing → check console + `[agent]` logs |
| Two agents answer / calls go to your laptop | local `agent.py dev` and cloud worker share the same project+name; use a dev project or name |
| `event loop blocked for …ms` warnings | usually harmless in dev; persistent → heavy sync work in a tool |
| Mic not working | browser permission; LiveKit needs HTTPS or `localhost` |

## Cloud

```bash
gcloud run services logs read noshy-agent --region us-central1 --limit 100   # agent
gcloud run services logs tail noshy-agent --region us-central1               # live
lk agent logs                                                               # worker
vercel logs your-app.vercel.app                                             # web (or Dashboard → Logs)
```
Check `https://<agent>/health` first; then the Vercel function logs for `/api/copilotkit`.
