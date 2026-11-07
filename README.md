# Agente comercial de voz

![Demo DevFest](docs/assets/demo-devfest.mp4)

**Google ADK (TypeScript) es el cerebro · LiveKit es la voz · AG-UI/CopilotKit es el puente · la UI generativa es la experiencia comercial.**

LiveKit nunca habla con ADK directo. CopilotKit es dueño de la sesión de ADK.

### Acceso (gate)

| | |
|---|---|
| Email | `devfest@noshy.dev` |
| Password | `noshy-devfest` |

Entra por `/entrar`.

```text
UI Next.js + React (chat / voz / tarjetas generativas)
  └─ cliente CopilotKit + AG-UI (ADKAgent)
        ↓  /api/copilotkit  (CopilotRuntime v2)
Servidor puente AG-UI  packages/agent/src/server.ts   ← TypeScript, Express + SSE
        ↓  ADK Runner.runAsync
Agente Google ADK en TypeScript (LlmAgent + FunctionTool)

Voz (paquete Python aparte — se despliega con `lk agent create`):
  Sala LiveKit del navegador  ←→  packages/livekit (Gemini Live vía Inference)
        ↓ RPC (brain.ask / intake.submit / …)
  CopilotKit del navegador  →  AG-UI  →  cerebro ADK  →  tarjetas de UI generativa
```

## Corrección al plan original

`@ag-ui/adk` (npm, TypeScript) es **solo un cliente**: `ADKAgent extends HttpAgent`.
El middleware de servidor documentado (`ag_ui_adk` / `add_adk_fastapi_endpoint`) es **Python**.
En TypeScript no existe `createAgUiAdkHandler`. Por eso `packages/agent/src/server.ts`
implementa el servidor AG-UI en TS: acepta `RunAgentInput`, corre el `Runner` de ADK
y traduce los `Event` de ADK (partes de texto, `getFunctionCalls`,
`getFunctionResponses`) a eventos SSE de AG-UI (`RUN_*`, `TEXT_MESSAGE_*`,
`TOOL_CALL_*`). CopilotKit hace match de `toolCallName` en `useRenderTool`, y eso
es lo que pinta las tarjetas de UI generativa.

Además: en ADK JS 2.x, `FunctionTool.parameters` es un **objeto Zod** (se valida al
llamar), no un JSON Schema crudo.

## Córrerlo — un comando

Requisitos: Node ≥ 22 (24 recomendado). Python 3.12 para el worker de voz (opcional).

```bash
npm run setup     # una vez: env desde .env.example, npm install, venv de Python
npm run dev       # agente :8000 + web :3000 + worker de voz LiveKit — Ctrl+C detiene todo
```

- `npm run dev -- --no-livekit` → solo chat. El worker de voz también se salta solo si faltan las llaves de LiveKit o el venv.
- Una terminal por servicio sigue sirviendo: `npm run dev:agent` · `npm run dev:web` · `npm run dev:livekit` · `npm run dev:adk-web`.
- Abre http://localhost:3000 (página del público: `/audience`). Estado del agente: `npm run health`.

**¿Sin llave de Gemini?** El agente arranca en modo `demo-no-key`: los mismos eventos de herramientas con respuestas guionadas
(`src/demo.ts`), así que cada tarjeta se puede demostrar. Al poner una llave se usa solo el camino real de `LlmAgent` + Gemini.

## Guías (paso a paso)

| | Guía |
|---|---|
| 🚀 | [00 · Inicio rápido](docs/guides/00-quickstart.md) — herramientas, setup, correr todo |
| 🧠 | [01 · Google ADK](docs/guides/google-adk/01-google-adk.md) — llaves de Gemini (Vertex AI / AI Studio), sesiones, Meet/Calendar, `adk web` |
| 🎙️ | [02 · LiveKit](docs/guides/livekit/02-livekit.md) — llaves de LiveKit + ElevenLabs, correr y desplegar el worker de voz |
| 🔌 | [03 · CopilotKit](docs/guides/copilotkit/03-copilotkit.md) — cómo el frontend se conecta al agente, UI generativa |
| ☁️ | [04 · Desplegar](docs/guides/deploy/04-deploy-cloud.md) — Cloud Run → LiveKit Cloud → Vercel |
| 🐞 | [05 · Depuración](docs/guides/debugging/05-debugging.md) — logs, inspectores, errores comunes |

Docs de diseño del agente (arquitectura, herramientas, prompt): [`docs/`](docs/README.md) · Escenarios de prueba del chat: [`COPILOTKIT-CHAT-TEST-GUIDELINES.txt`](docs/COPILOTKIT-CHAT-TEST-GUIDELINES.txt)

Guion de demo (escríbelo o usa 🎙️ Hablar):
1. “No sé cómo vender mi producto” → coincidencias de la comunidad y propuesta
2. “Muéstrame las preguntas” → preguntas de discovery
3. “Agenda una reunión” → `open_calendar` (tool de frontend) abre el calendario
4. Público: abre `/audience` (ponlo en un QR), vota, y en el panel
   “Público en vivo” pulsa **Enviar al agente**

## MCP (Antigravity, texto)

`packages/mcp` is a separate server. Antigravity calls it over stdio (`.agents/mcp_config.json`) and gets text back: `match_community`, `summarize_context`, `show_discovery_guide`, `build_strategy_plan`, `build_product_plan`. The web app does not call this server. CopilotKit still talks only to the ADK agent at `ADK_AG_UI_URL`.

## Voz

- **Opción A (por defecto):** `VoiceRoom` usa la Web Speech API → texto → CopilotKit, más reproducción con `speechSynthesis`. Cero config.
- **Opción B:** pon `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`; `POST /api/livekit/token` entra a una sala.
- **Opción C — worker de LiveKit Agents** (Python `packages/livekit`, lo arranca `npm run dev`): el cerebro llega por RPC del navegador → CopilotKit. Ver [02 · LiveKit](docs/guides/livekit/02-livekit.md).

## Deploy (resumen — los pasos completos están en [04 · Desplegar](docs/guides/deploy/04-deploy-cloud.md))

| Pieza | Dónde | Cómo |
|---|---|---|
| Agente `packages/agent` | Cloud Run | `gcloud run deploy noshy-agent --source packages/agent …` (el Dockerfile va incluido) |
| Voz `packages/livekit` | LiveKit Cloud | `cd packages/livekit && lk agent create --secrets-file .env`, luego `lk agent deploy` |
| Web `apps/web` | Vercel | Importa el repo, Root Directory `apps/web`, env `ADK_AG_UI_URL=https://<agent>/ag-ui` + `LIVEKIT_*` |

## Estructura

```text
apps/web/app/
  api/copilotkit/[[...slug]]/route.ts   CopilotRuntime v2 -> ADKAgent -> puente
  api/livekit/token/route.ts            JWT de LiveKit
  api/livekit/session/route.ts          sala LiveKit + despacho del agente
  components/ VoiceRoom · CommunityCards · IntakeForm · …
packages/agent/                         cerebro Google ADK + servidor AG-UI (sin LiveKit)
  src/agent.ts · tools.ts · server.ts · demo.ts · Dockerfile (Cloud Run)
packages/mcp/                           MCP Apps del concierge (mismas tarjetas, mismo estilo)
  server.ts · src/mcp-app.ts · mcp-app.html
packages/livekit/                       worker de voz LiveKit en Python (desplegable)
  agent.py · tools.py · playbook.py · Dockerfile
scripts/
  setup.mjs · dev.mjs                   npm run setup / npm run dev (todos los servicios)
docs/guides/                            setup paso a paso, agrupado por producto
  00-quickstart.md
  google-adk/ · livekit/ · copilotkit/ · deploy/ · debugging/
```
