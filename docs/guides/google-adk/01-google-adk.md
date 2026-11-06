# 01 · Google ADK (the brain) — keys, setup, run

Code: `packages/agent` — one ADK `LlmAgent` (`noshy_concierge`, `src/agent.ts`) served over AG-UI by
`src/server.ts` (Express + SSE on `:8000`). Config: `packages/agent/.env`.

You need **one** of two ways to call Gemini. Pick A for production, B for the fastest start. Both call the same models and run the same concierge. The difference is how you sign in and which project features turn on.

| Setup step | Vertex (`GOOGLE_GENAI_USE_VERTEXAI=true`) | Gemini API key from AI Studio |
|---|---|---|
| What you create | A Cloud project, billing, and the Vertex AI API | One key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| What goes in `.env` | Project ID and region. No key string | `GOOGLE_GENAI_USE_VERTEXAI=false` and `GOOGLE_GENAI_API_KEY` |
| How the agent signs in | `gcloud auth application-default login` on your machine. On Cloud Run, a service account | The key in `.env` |
| Local chat (`npm run dev:agent`) | Yes | Yes |
| Same tools, prompt, and UI | Yes | Yes |
| Chat history that survives a restart | Yes, if you set `GOOGLE_CLOUD_AGENT_ENGINE_ID` | No. History stays in memory and clears when the process stops |
| ADK debug UI (`npm run dev:adk-web`) | Yes. That command is wired to Vertex sessions | No. That script always uses `vertexai://` |
| Deploy path in the Cloud Run guide | Yes. The service account calls Vertex. No key in the container | Possible only if you store `GOOGLE_GENAI_API_KEY` as a secret. Agent Engine sessions stay off |
| Mic / Live model this repo picks | `gemini-live-2.5-flash-native-audio` | `gemini-3.1-flash-live-preview` |

Email (Resend), Google Meet, and Calendar are separate setup. They do not come from the Vertex login or the AI Studio key. With neither Vertex nor a Gemini key, the server still starts, in `demo-no-key` mode, with scripted replies.

---

## Option A — Vertex AI (recommended: production, sessions, Cloud Run)

### A1. Project and billing
1. Open [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project picker at the top, then **New project** (or pick an existing one).
3. Copy the **Project ID** (for example `noshy-prod-123`), not the display name. That value goes in `GOOGLE_CLOUD_PROJECT`.
4. Open **Billing**, then **Link a billing account**, and attach one to this project.

### A2. Enable APIs in the UI
Open [APIs & Services → Library](https://console.cloud.google.com/apis/library) with that project selected. Search each API, open it, and click **Enable**.

For local Vertex use, enable only:

- **Vertex AI API** (`aiplatform.googleapis.com`)

Enable these three only if you later deploy the agent to Cloud Run:

- **Cloud Run Admin API** (`run.googleapis.com`)
- **Cloud Build API** (`cloudbuild.googleapis.com`)
- **Artifact Registry API** (`artifactregistry.googleapis.com`)

`gcloud auth login` and `gcloud config set project` are not needed if you stay in the console and the correct project is selected in the picker.

Same thing from the CLI:

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
Uses Vertex sessions (`--session_service_uri vertexai://`), so it needs Option A + Agent Engine. This UI loads `src/agent.ts`. It does not create a console agent.

### Agent Studio and session logs
Same concierge, pasted into the console designer, plus the page where chat sessions show up. Full steps and the paste blocks: [07 · Agent Studio](./07-agent-studio.md).

| What | Link |
|---|---|
| Designer already open for this project | [Agent designer](https://console.cloud.google.com/agent-platform/studio/agent-designer/edit/agent_1793720119088?project=unique-nebula-509615-m5) |
| New agent | [Agent Studio](https://console.cloud.google.com/agent-platform/studio?project=unique-nebula-509615-m5) → **Create agent** |
| Chat sessions for `unique-nebula-509615-m5` | [Sessions](https://console.cloud.google.com/agent-platform/sessions?project=unique-nebula-509615-m5) |

### Test tool logic (no key)
```bash
npm run test:tools -w @commercial/agent
```

Deploy: [04 · Deploy → Agent on Cloud Run](../deploy/04-deploy-cloud.md#1-agent-brain--google-cloud-run).
Design docs for changing the agent: [01 architecture](../../01-agent-architecture.md) · [02 tools](../../02-tool-design.md) · [03 prompt](../../03-prompt-design.md).
