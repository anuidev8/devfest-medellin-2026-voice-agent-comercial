# 04 · Desplegar en la nube

Tres piezas, en este orden (cada una necesita la URL de la anterior):

| # | Pieza | Dónde | Qué corre | URL pública |
|---|---|---|---|---|
| 1 | Cerebro `packages/agent` | **Google Cloud Run** (o Railway / Fly) | `node dist/server.js` | `https://noshy-agent-xxxx.run.app/ag-ui` |
| 2 | Worker de voz `packages/livekit` | **LiveKit Cloud** (`lk agent create`) | `python agent.py start` | ninguna (sale hacia LiveKit) |
| 3 | Web `apps/web` | **Vercel** | `next build && next start` | `https://your-app.vercel.app` |

```text
Navegador ──▶ Vercel (Next.js + runtime de CopilotKit) ──ADK_AG_UI_URL──▶ Cloud Run (ADK + AG-UI)
   │                    │ despacho (LIVEKIT_AGENT_NAME)
   └── WebRTC ──▶ LiveKit Cloud ◀──── worker (LiveKit Cloud Agents)
```

---

## <a id="1-agente-en-google-cloud-run"></a>1. Agente (cerebro) → Google Cloud Run

Requisitos: [01 · Google ADK → Opción A](../google-adk/01-google-adk.md#opcion-a), pasos A1–A2.
`packages/agent/Dockerfile` compila TypeScript y corre `node dist/server.js` en `$PORT`.

> ¿Por qué no `adk deploy cloud_run`? Ese comando despliega el servidor de API propio de ADK. La web necesita
> **nuestro puente AG-UI** (`src/server.ts`, endpoint `/ag-ui`), así que desplegamos nuestro contenedor.

### 1a. Cuenta de servicio (acceso a Vertex AI sin llaves)
```bash
PROJECT=YOUR_PROJECT_ID
gcloud iam service-accounts create noshy-agent --project $PROJECT
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:noshy-agent@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### 1b. Secretos (solo los que uses)
```bash
printf '%s' 're_xxx' | gcloud secrets create RESEND_API_KEY --data-file=- --project $PROJECT
gcloud secrets add-iam-policy-binding RESEND_API_KEY --project $PROJECT \
  --member="serviceAccount:noshy-agent@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
# ¿Usas una llave de AI Studio en vez de Vertex? Guarda GOOGLE_GENAI_API_KEY igual.
```

### 1c. Deploy (un comando; construye desde el código con Cloud Build)
```bash
gcloud run deploy noshy-agent \
  --source packages/agent \
  --project $PROJECT --region us-central1 \
  --service-account noshy-agent@$PROJECT.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --timeout 3600 --min-instances 1 \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=us-central1,ADK_MODEL=gemini-2.5-flash,CORS_ORIGINS=https://your-app.vercel.app" \
  --set-env-vars "GOOGLE_CLOUD_AGENT_ENGINE_ID=YOUR_ENGINE_ID,GOOGLE_CLOUD_AGENT_ENGINE_LOCATION=us-west1" \
  --set-secrets "RESEND_API_KEY=RESEND_API_KEY:latest"
```

- `--timeout 3600`: las respuestas de AG-UI son streams SSE; no las cortes en el default de 5 minutos.
- `--min-instances 1`: evita el arranque en frío en una demo en vivo; también mantiene vivas las sesiones en memoria si no usas Agent Engine.
- Para redesplegar después de cambiar código, corre el mismo comando otra vez.

Comprueba:
```bash
URL=$(gcloud run services describe noshy-agent --region us-central1 --format='value(status.url)')
curl $URL/health      # {"ok":true,"mode":"adk-gemini","sessions":"vertex-agent-engine",...}
```

**Ojo en la nube**
- El disco es efímero: `DEALS_FILE` (el JSON de leads) se pierde al reiniciar. Sirve para demos; para datos reales usa una base.
- El OAuth de Meet/Calendar usa **archivos** de token (`.meet-oauth.*.json`, fuera de la imagen). En Cloud Run
  deja `MOCK_DELIVERY` sin definir (reserva simulada), o hospeda el agente donde puedas montar un volumen
  (Railway / Fly) y deja los dos archivos junto a `package.json`.

### Alternativa: Railway / Fly
Apunta el servicio a `packages/agent` (detecta el Dockerfile) y pon las mismas variables. Para Vertex
fuera de Google Cloud necesitas una llave de cuenta de servicio: `GOOGLE_APPLICATION_CREDENTIALS` apuntando a un JSON montado. O usa `GOOGLE_GENAI_API_KEY` (opción B).

---

## 2. Worker de voz → LiveKit Cloud

El detalle está en [02 · LiveKit → Desplegar](../livekit/02-livekit.md#desplegar-el-worker). Versión corta:
```bash
cd packages/livekit
lk cloud auth
lk agent create --secrets-file .env     # la primera vez (crea livekit.toml — súbelo al repo)
lk agent deploy                         # actualizaciones
lk agent logs
```
El worker **no depende de una URL** del agente ni de la web: habla con el cerebro a través del navegador.

---

## <a id="3-web-en-vercel"></a>3. Web → Vercel

### 3a. Clic a clic (dashboard)
1. Sube el repo a GitHub.
2. https://vercel.com/new → **Import** del repo.
3. **Root Directory:** `apps/web` (el framework se detecta: Next.js). Deja "Include files outside the root directory" **activado** (monorepo).
4. **Environment Variables:**
   | Nombre | Valor |
   |---|---|
   | `ADK_AG_UI_URL` | `https://noshy-agent-xxxx.run.app/ag-ui` (del paso 1) |
   | `NEXT_PUBLIC_LIVEKIT_URL` | `wss://your-project.livekit.cloud` |
   | `LIVEKIT_API_KEY` | de LiveKit |
   | `LIVEKIT_API_SECRET` | de LiveKit |
   | `LIVEKIT_AGENT_NAME` | `noshy_concierge` (tiene que coincidir con el worker) |
5. **Deploy.** Cada push a `main` redespliega; los PR reciben URLs de preview.

### 3b. CLI
```bash
npm i -g vercel
cd apps/web
vercel link
vercel env add ADK_AG_UI_URL production      # repite por cada variable de arriba
vercel --prod
```

### 3c. Después del primer deploy
- Pon el dominio de Vercel en `CORS_ORIGINS` del agente y redespliega el paso 1 (solo hace falta si el navegador llama al agente directo; la ruta de CopilotKit llama al agente desde el servidor).
- Las variables `NEXT_PUBLIC_*` se hornean en el build → **redespliega** si las cambias.
- Las funciones de Vercel tienen una duración máxima; las corridas largas del agente van por SSE en `/api/copilotkit`.
  Si las respuestas se cortan, sube **Max Duration** en Project → Settings → Functions.

---

## 4. Prueba de humo del stack en la nube

```bash
curl https://noshy-agent-xxxx.run.app/health     # agente arriba, mode adk-gemini
lk agent status                                  # worker corriendo
open https://your-app.vercel.app                 # chat → se ven las tarjetas; 🎙️ → entra la voz
```

## Referencia de variables de entorno

| Variable | Pieza | Obligatoria | Notas |
|---|---|---|---|
| `GOOGLE_GENAI_USE_VERTEXAI` | agente | sí* | `true` = Vertex, `false` = API key |
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` | agente | Vertex | |
| `GOOGLE_GENAI_API_KEY` | agente | modo API key | |
| `GOOGLE_CLOUD_AGENT_ENGINE_ID` / `_LOCATION` | agente | no | sesiones persistentes |
| `ADK_MODEL` | agente | no | default `gemini-2.5-flash` |
| `PORT` | agente | no | Cloud Run la asigna |
| `CORS_ORIGINS` | agente | no | separadas por coma; default `http://localhost:3000` |
| `RESEND_API_KEY` / `EMAIL_FROM` / `SELLER_EMAIL` | agente | no | correo de la propuesta |
| `MOCK_DELIVERY` | agente | no | `0` = correo y calendario reales |
| `ADK_AG_UI_URL` | web | sí | URL `/ag-ui` del agente |
| `NEXT_PUBLIC_LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | web + worker | voz | |
| `LIVEKIT_AGENT_NAME` | web + worker | no | default `noshy_concierge`; tienen que coincidir |
| `VOICE_PROVIDER` / `ELEVEN_API_KEY` / `ELEVEN_VOICE_ID` | worker | voz | |

\* Sin ninguna credencial de Gemini el agente corre en modo `demo-no-key`.
