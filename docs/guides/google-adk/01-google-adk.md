# 01 · Google ADK (el cerebro) — llaves, setup, correr

Código: `packages/agent` — un `LlmAgent` de ADK (`noshy_concierge`, `src/agent.ts`) servido por AG-UI en
`src/server.ts` (Express + SSE en `:8000`). Config: `packages/agent/.env`.

La forma del agente (un solo agente, herramientas, sin multi-agente) sigue [Building effective agents](https://www.anthropic.com/research/building-effective-agents). El detalle está en [Arquitectura → Configuración correcta en Google ADK](../../01-agent-architecture.md#configuracion-correcta).

Necesitas **una** de dos formas de llamar a Gemini. La A es para producción. La B es el arranque más rápido. Las dos llaman a los mismos modelos y corren el mismo concierge. Cambia cómo inicias sesión y qué funciones del proyecto se encienden.

| Paso de setup | Vertex (`GOOGLE_GENAI_USE_VERTEXAI=true`) | API key de Gemini en AI Studio |
|---|---|---|
| Qué creas | Un proyecto de Cloud, facturación y la API de Vertex AI | Una llave en [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Qué va en `.env` | ID del proyecto y región. Sin string de llave | `GOOGLE_GENAI_USE_VERTEXAI=false` y `GOOGLE_GENAI_API_KEY` |
| Cómo inicia sesión el agente | `gcloud auth application-default login` en tu máquina. En Cloud Run, una cuenta de servicio | La llave en `.env` |
| Chat local (`npm run dev:agent`) | Sí | Sí |
| Mismas herramientas, prompt y UI | Sí | Sí |
| Historial que sobrevive un reinicio | Sí, si pones `GOOGLE_CLOUD_AGENT_ENGINE_ID` | No. El historial queda en memoria y se borra al parar el proceso |
| UI de depuración de ADK (`npm run dev:adk-web`) | Sí. Ese comando usa sesiones de Vertex | No. El script siempre usa `vertexai://` |
| Camino de deploy en la guía de Cloud Run | Sí. La cuenta de servicio llama a Vertex. Sin llave en el contenedor | Solo si guardas `GOOGLE_GENAI_API_KEY` como secreto. Las sesiones de Agent Engine siguen apagadas |
| Modelo de micrófono / Live que elige este repo | `gemini-live-2.5-flash-native-audio` | `gemini-3.1-flash-live-preview` |

El correo (Resend), Google Meet y Calendar son otro setup. No salen del login de Vertex ni de la llave de AI Studio. Sin Vertex y sin llave de Gemini, el servidor igual arranca, en modo `demo-no-key`, con respuestas guionadas.

---

## <a id="opcion-a"></a>Opción A — Vertex AI (recomendado: producción, sesiones, Cloud Run)

### A1. Proyecto y facturación
1. Abre [console.cloud.google.com](https://console.cloud.google.com).
2. Clic en el selector de proyecto de arriba, luego **New project** (o elige uno que ya exista).
3. Copia el **Project ID** (por ejemplo `noshy-prod-123`), no el nombre visible. Ese valor va en `GOOGLE_CLOUD_PROJECT`.
4. Abre **Billing**, luego **Link a billing account**, y vincula una cuenta a este proyecto.

### A2. Activar las APIs en la UI
Abre [APIs y servicios → Biblioteca](https://console.cloud.google.com/apis/library) con ese proyecto seleccionado. Busca cada API, ábrela y pulsa **Enable**.

Para usar Vertex en local, activa solo:

- **Vertex AI API** (`aiplatform.googleapis.com`)

Activa estas tres solo si después despliegas el agente en Cloud Run:

- **Cloud Run Admin API** (`run.googleapis.com`)
- **Cloud Build API** (`cloudbuild.googleapis.com`)
- **Artifact Registry API** (`artifactregistry.googleapis.com`)

`gcloud auth login` y `gcloud config set project` no hacen falta si te quedas en la consola y el proyecto correcto está seleccionado.

Lo mismo desde la CLI:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable aiplatform.googleapis.com
# solo si despliegas el agente en Cloud Run:
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

### A3. Credenciales locales (ADC — sin archivo de llave)
```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

### A4. Llena `packages/agent/.env`
```dotenv
GOOGLE_GENAI_USE_VERTEXAI=true        # (ADK también acepta GOOGLE_GENAI_USE_ENTERPRISE=true)
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
GOOGLE_CLOUD_LOCATION=us-central1
ADK_MODEL=gemini-2.5-flash
PORT=8000
```

### A5. (Opcional) Sesiones persistentes con Agent Engine / Agent Runtime
Sin esto, las sesiones del chat viven en memoria y se reinician cuando el agente se reinicia.

1. Consola → **Vertex AI → Agent Engine** (también Agent Runtime) → crea o despliega un agent engine
   (cualquier agente pequeño sirve; solo se usa como almacén de sesiones).
2. Ábrelo → copia el **ID numérico** del recurso y su **región**.
3. Agrégalo al `.env`:
   ```dotenv
   GOOGLE_CLOUD_AGENT_ENGINE_ID=4178447650758066176
   GOOGLE_CLOUD_AGENT_ENGINE_LOCATION=us-west1   # puede ser distinta de la región del modelo
   ```
4. `npm run health` debe mostrar `"sessions":"vertex-agent-engine"`.

---

## Opción B — API key de Gemini (lo más rápido, desarrollo local)

1. Ve a https://aistudio.google.com/apikey → **Create API key** (elige o crea un proyecto).
2. Llena `packages/agent/.env`:
   ```dotenv
   GOOGLE_GENAI_USE_VERTEXAI=false
   GOOGLE_GENAI_API_KEY=AIza...
   ADK_MODEL=gemini-2.5-flash
   PORT=8000
   ```
   (`GOOGLE_API_KEY` o `GEMINI_API_KEY` también sirven.)

> **¿Sin ninguna llave?** El servidor arranca en modo `demo-no-key` (`src/demo.ts`): emite los mismos
> eventos de herramientas con respuestas guionadas, así que cada tarjeta de la UI se sigue viendo.

---

## Integraciones opcionales

| Función | Variables | Setup |
|---|---|---|
| Enviar el correo de la propuesta | `RESEND_API_KEY`, `EMAIL_FROM`, `SELLER_EMAIL` | https://resend.com → API Keys → crear; verifica el dominio de envío en **Domains** |
| Transcripciones de Google Meet + reserva en Calendar | `packages/agent/.meet-oauth.client.json` → tokens | Abajo |
| Ruta de los leads | `DEALS_FILE` | Por defecto `packages/agent/data/deals.json` |
| Correo y calendario reales o simulados | `MOCK_DELIVERY` | `0` = entrega real; cualquier otro valor = simulado |

### OAuth de Google Meet + Calendar
1. Consola → **APIs y servicios → Biblioteca** → activa **Google Meet API** y **Google Calendar API**.
2. **APIs y servicios → Pantalla de consentimiento de OAuth** → External o Internal, agrégate como usuario de prueba,
   scopes `meetings.space.readonly` y `calendar.events`.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → App de escritorio** → copia el client id y el secret.
4. Crea `packages/agent/.meet-oauth.client.json`:
   ```json
   { "client_id": "xxxx.apps.googleusercontent.com", "client_secret": "GOCSPX-..." }
   ```
5. Corre el consentimiento (abre el navegador y escribe `.meet-oauth.tokens.json`):
   ```bash
   npm run auth:meet -w @commercial/agent
   ```
6. Opcional: `GOOGLE_CALENDAR_TIMEZONE=America/Bogota`.

Los dos JSON están en `.gitignore`. **No los subas al repo.**

---

## Correr

```bash
npm run dev:agent        # tsx watch → http://localhost:8000/ag-ui (recarga al guardar)
npm run health           # {"mode":"adk-gemini", ...}
```

Endpoints de `src/server.ts`:

| Endpoint | Para qué |
|---|---|
| `POST /ag-ui` | Corrida AG-UI (la llama el runtime de CopilotKit en Next.js) — stream SSE |
| `GET /health` | modo (`adk-gemini` / `demo-no-key`), almacén de sesiones |
| `POST /deal` | actualiza un lead |
| `POST /transcript` | analiza una transcripción de reunión pegada |

### UI de desarrollo de ADK (inspeccionar el agente sin el frontend)
```bash
npm run dev:adk-web      # http://localhost:8100 — chat, cada evento, tool call y estado
```
Usa sesiones de Vertex (`--session_service_uri vertexai://`), así que necesita la opción A y Agent Engine. Esta UI carga `src/agent.ts`. No crea un agente en la consola.

### Agent Studio y logs de sesión
El mismo concierge, pegado en el diseñador de la consola, y la página donde aparecen las sesiones de chat. Pasos y bloques para pegar: [07 · Agent Studio](./07-agent-studio.md).

| Qué | Enlace |
|---|---|
| Diseñador ya abierto de este proyecto | [Agent designer](https://console.cloud.google.com/agent-platform/studio/agent-designer/edit/agent_1793720119088?project=unique-nebula-509615-m5) |
| Agente nuevo | [Agent Studio](https://console.cloud.google.com/agent-platform/studio?project=unique-nebula-509615-m5) → **Create agent** |
| Sesiones de chat de `unique-nebula-509615-m5` | [Sessions](https://console.cloud.google.com/agent-platform/sessions?project=unique-nebula-509615-m5) |

### Probar la lógica de las herramientas (sin llave)
```bash
npm run test:tools -w @commercial/agent
```

Deploy: [04 · Desplegar → Agente en Cloud Run](../deploy/04-deploy-cloud.md#1-agente-en-google-cloud-run).
Docs de diseño para cambiar el agente: [01 arquitectura](../../01-agent-architecture.md) · [02 herramientas](../../02-tool-design.md) · [03 prompt](../../03-prompt-design.md).
