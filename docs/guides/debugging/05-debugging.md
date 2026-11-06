# 05 · Depuración

Trabaja **de abajo hacia arriba**: agente → CopilotKit → frontend → voz. Cada capa se puede probar sola.

## 0. Los primeros 60 segundos

```bash
npm run health                                  # 1. ¿el agente vive? mode adk-gemini o demo-no-key
curl -s localhost:3000/api/copilotkit/info      # 2. ¿el runtime de CopilotKit ve el agente "default"?
npm run typecheck                               # 3. sin errores de tipos
npm run test:tools -w @commercial/agent         # 4. la lógica de tools está bien (sin llave)
```

## Agente (Google ADK)

**Logs:** las líneas `[agent]` de `npm run dev` (o `npm run dev:agent`). Al arrancar imprime el modo y el almacén de sesiones:
`ADK AG-UI server on http://localhost:8000/ag-ui (mode: adk-gemini, sessions: memory)`.

**Habla con el agente sin el frontend.** La UI de desarrollo de ADK muestra cada evento, tool call, argumentos, resultado y estado:
```bash
npm run dev:adk-web       # http://localhost:8100
```

**Llama a AG-UI directo** (ves el stream SSE crudo que recibe el frontend):
```bash
curl -N localhost:8000/ag-ui -H 'content-type: application/json' -d '{
  "threadId":"debug-'"$(date +%s)"'","runId":"r1","state":{},"tools":[],"context":[],"forwardedProps":{},
  "messages":[{"id":"m1","role":"user","content":"Hola, vengo a preparar una venta"}]}'
```
Debes ver `RUN_STARTED`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `RUN_FINISHED`. Un `RUN_ERROR` trae el
mensaje. Con sesiones de Agent Engine usa un `threadId` nuevo cada vez (el ejemplo ya lo hace).

**Breakpoints (VS Code / Chrome DevTools):**
```bash
cd packages/agent && node --inspect --import tsx src/server.ts
# VS Code: "Debug: Attach to Node Process"   ·   Chrome: chrome://inspect
```

| Síntoma | Causa / arreglo |
|---|---|
| `mode: demo-no-key` aunque pusiste una llave | el `.env` no está en `packages/agent/`, o `GOOGLE_GENAI_USE_VERTEXAI=true` con `GOOGLE_CLOUD_PROJECT` vacío |
| `Could not load the default credentials` | `gcloud auth application-default login` |
| `403 PERMISSION_DENIED aiplatform` | activa `aiplatform.googleapis.com`; en Cloud Run dale `roles/aiplatform.user` a la cuenta de servicio |
| `404 model not found` | el modelo no está en `GOOGLE_CLOUD_LOCATION`; prueba `us-central1` o cambia `ADK_MODEL` |
| `429 RESOURCE_EXHAUSTED` | cuota; espera, cambia de región o pide más cuota |
| Errores de sesión con Agent Engine | `GOOGLE_CLOUD_AGENT_ENGINE_ID` o la región están mal; quítalo para volver a sesiones en memoria |
| `EADDRINUSE :8000` | `lsof -iTCP:8000 -sTCP:LISTEN` → `kill <pid>` (igual para `:3000`) |
| No llama la herramienta | descripción de la tool / `instruction.ts` — ver [02 diseño de herramientas](../../02-tool-design.md) |

## CopilotKit / frontend

**Logs:** líneas `[web]` (ruta del servidor) + consola de DevTools del navegador (cliente).

- Pestaña **Network** → filtra `copilotkit` → abre el request → **EventStream / Response** muestra los eventos AG-UI que vuelven.
- `npx copilotkit@latest verify` revisa el cableado.
- URL del agente mal puesta: revisa `ADK_AG_UI_URL` en `apps/web/.env.local` y reinicia `next dev` (el env se lee al arrancar).

| Síntoma | Causa / arreglo |
|---|---|
| El chat gira para siempre / `fetch failed` en `[web]` | el agente no está corriendo o `ADK_AG_UI_URL` está mal |
| Sale texto pero **no hay tarjeta** | `useRenderTool({ name })` no coincide exactamente con el nombre de la tool de ADK, o el componente del hook no está montado |
| Falta la tarjeta de aprobar el plan | A2UI: la ruta debe tener `a2ui: {}` y `providers.tsx` el catálogo; busca `ACTIVITY_SNAPSHOT` en el stream |
| La tool de frontend (`open_calendar`) nunca corre | el modelo tiene que verla en `instruction.ts`; revisa que aparezca en `tools` del request AG-UI |
| Error de tipos en `ADKAgent` | `@ag-ui/client` duplicado; deja el cast `as never` o alinea versiones |
| Comportamiento viejo después de editar | `rm -rf apps/web/.next` y reinicia |

## <a id="worker-de-voz-livekit"></a>Worker de voz LiveKit

**Logs:**
```bash
npm run logs:livekit                   # tail de packages/livekit/logs/livekit-agent.log (el modo dev lo escribe)
LOG_LEVEL=DEBUG npm run dev:livekit    # verboso
lk agent logs                          # worker desplegado en LiveKit Cloud
```
Líneas útiles: `rpc → brain.ask {...}`, `brain result ok=True`, `closing agent session due to participant disconnect`.

- **En el navegador:** consola de DevTools para errores de RPC de `VoiceRoom`. En el dashboard de LiveKit Cloud, **Sessions** muestra salas, participantes y si el agente entró.
- **Sin navegador:** `cd packages/livekit && .venv/bin/python agent.py console` (solo el pipeline de voz; el RPC al cerebro no está disponible ahí).

| Síntoma | Causa / arreglo |
|---|---|
| `/api/livekit/session` → **501** | faltan `LIVEKIT_*` en `apps/web/.env.local` |
| `/api/livekit/session` → **502 Agent dispatch failed** | el worker no está corriendo, o `LIVEKIT_AGENT_NAME` no coincide entre la web y el worker |
| El agente entra pero no habla | `ELEVEN_API_KEY` tiene que ser el secreto `sk_…`; o pon `VOICE_PROVIDER=livekit` |
| El agente habla pero nunca muestra tarjetas | el RPC `brain.ask` del navegador falla → revisa la consola y los logs `[agent]` |
| Responden dos agentes / las llamadas llegan a tu laptop | `agent.py dev` local y el worker de la nube comparten proyecto y nombre; usa un proyecto o un nombre de desarrollo |
| Avisos `event loop blocked for …ms` | en dev suelen ser inofensivos; si persisten, hay trabajo síncrono pesado en una tool |
| El micrófono no funciona | permiso del navegador; LiveKit necesita HTTPS o `localhost` |

## Nube

```bash
gcloud run services logs read noshy-agent --region us-central1 --limit 100   # agente
gcloud run services logs tail noshy-agent --region us-central1               # en vivo
lk agent logs                                                               # worker
vercel logs your-app.vercel.app                                             # web (o Dashboard → Logs)
```
Revisa primero `https://<agent>/health`; después los logs de la función de Vercel de `/api/copilotkit`.
