# 01 · Google ADK (the brain) — keys, setup, run

Code: `packages/agent` — one ADK `LlmAgent` (`noshy_concierge`, `src/agent.ts`) served over AG-UI by
`src/server.ts` (Express + SSE on `:8000`). Config: `packages/agent/.env`.

You need **one** of two ways to call Gemini. Pick A for production, B for the fastest start.

---

## Option A — Vertex AI (recommended: production, sessions, Cloud Run)

### A1. Create / pick a Google Cloud project
1. Go to https://console.cloud.google.com → project picker → **New project** (or use an existing one).
2. Copy the **Project ID** (e.g. `noshy-prod-123`), not the project name.
3. Make sure **billing** is enabled for the project (Billing → Link a billing account).

### A2. Enable the APIs
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable aiplatform.googleapis.com
# only if you deploy the agent to Cloud Run:
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

### A3. Local credentials (ADC — no key file needed)
```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

### A4. Fill `packages/agent/.env`
```dotenv
GOOGLE_GENAI_USE_VERTEXAI=true        # (ADK also accepts GOOGLE_GENAI_USE_ENTERPRISE=true)
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
GOOGLE_CLOUD_LOCATION=us-central1
ADK_MODEL=gemini-2.5-flash
PORT=8000
```

### A5. (Optional) Persistent sessions with Agent Engine / Agent Runtime
Without this, chat sessions live in memory and reset when the agent restarts.

1. Console → **Vertex AI → Agent Engine** (a.k.a. Agent Runtime) → create/deploy an agent engine
   (any small agent works; it is used only as a session store).
2. Open it → copy the **numeric resource ID** and its **region**.
3. Add to `.env`:
   ```dotenv
   GOOGLE_CLOUD_AGENT_ENGINE_ID=4178447650758066176
   GOOGLE_CLOUD_AGENT_ENGINE_LOCATION=us-west1   # can differ from the model region
   ```
4. `npm run health` should now show `"sessions":"vertex-agent-engine"`.

---

## Option B — Gemini API key (fastest, local dev)

1. Go to https://aistudio.google.com/apikey → **Create API key** (pick or create a project).
2. Fill `packages/agent/.env`:
   ```dotenv
   GOOGLE_GENAI_USE_VERTEXAI=false
   GOOGLE_GENAI_API_KEY=AIza...
   ADK_MODEL=gemini-2.5-flash
   PORT=8000
   ```
   (`GOOGLE_API_KEY` or `GEMINI_API_KEY` also work.)

> **No key at all?** The server starts in `demo-no-key` mode (`src/demo.ts`): it emits the same
> tool events with scripted replies so every UI card still renders.

---

## Optional integrations

| Feature | Env vars | Setup |
|---|---|---|
| Send proposal email | `RESEND_API_KEY`, `EMAIL_FROM`, `SELLER_EMAIL` | https://resend.com → API Keys → create; verify your sending domain under **Domains** |
| Google Meet transcripts + Calendar booking | `packages/agent/.meet-oauth.client.json` → tokens | See below |
| Lead storage path | `DEALS_FILE` | Defaults to `packages/agent/data/deals.json` |
| Real email/calendar vs mock | `MOCK_DELIVERY` | `0` = real delivery; anything else = mock |

### Google Meet + Calendar OAuth
1. Console → **APIs & Services → Library** → enable **Google Meet API** and **Google Calendar API**.
2. **APIs & Services → OAuth consent screen** → External/Internal, add yourself as a test user,
   scopes `meetings.space.readonly` and `calendar.events`.
3. **Credentials → Create credentials → OAuth client ID → Desktop app** → copy client id + secret.
4. Create `packages/agent/.meet-oauth.client.json`:
   ```json
   { "client_id": "xxxx.apps.googleusercontent.com", "client_secret": "GOCSPX-..." }
   ```
5. Run the consent flow (opens the browser, writes `.meet-oauth.tokens.json`):
   ```bash
   npm run auth:meet -w @commercial/agent
   ```
6. Optional: `GOOGLE_CALENDAR_TIMEZONE=America/Bogota`.

Both JSON files are git-ignored. **Never commit them.**

---

## Run

```bash
npm run dev:agent        # tsx watch → http://localhost:8000/ag-ui (auto-reload on save)
npm run health           # {"mode":"adk-gemini", ...}
```

Endpoints of `src/server.ts`:

| Endpoint | Purpose |
|---|---|
| `POST /ag-ui` | AG-UI run (called by CopilotKit runtime in Next.js) — SSE stream |
| `GET /health` | mode (`adk-gemini` / `demo-no-key`), session store |
| `POST /deal` | update a lead |
| `POST /transcript` | analyze a pasted meeting transcript |

### ADK dev UI (inspect the agent without the frontend)
```bash
npm run dev:adk-web      # http://localhost:8100 — chat, see every event, tool call and state
```
Uses Vertex sessions (`--session_service_uri vertexai://`), so it needs Option A + Agent Engine.

### Test tool logic (no key)
```bash
npm run test:tools -w @commercial/agent
```

Deploy: [04 · Deploy → Agent on Cloud Run](./04-deploy-cloud.md#1-agent-brain--google-cloud-run).
Design docs for changing the agent: [01 architecture](../01-agent-architecture.md) · [02 tools](../02-tool-design.md) · [03 prompt](../03-prompt-design.md).
