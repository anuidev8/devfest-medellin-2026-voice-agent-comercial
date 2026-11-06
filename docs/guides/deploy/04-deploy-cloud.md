# 04 · Deploy to the cloud

Three deployable pieces, deployed in this order (each one needs the URL of the previous):

| # | Piece | Where | Runs | Public URL |
|---|---|---|---|---|
| 1 | Agent brain `packages/agent` | **Google Cloud Run** (or Railway / Fly) | `node dist/server.js` | `https://noshy-agent-xxxx.run.app/ag-ui` |
| 2 | Voice worker `packages/livekit` | **LiveKit Cloud** (`lk agent create`) | `python agent.py start` | none (connects out to LiveKit) |
| 3 | Web `apps/web` | **Vercel** | `next build && next start` | `https://your-app.vercel.app` |

```text
Browser ──▶ Vercel (Next.js + CopilotKit runtime) ──ADK_AG_UI_URL──▶ Cloud Run (ADK + AG-UI)
   │                    │ dispatch (LIVEKIT_AGENT_NAME)
   └── WebRTC ──▶ LiveKit Cloud ◀──── worker (LiveKit Cloud Agents)
```

---

## 1. Agent (brain) → Google Cloud Run

Prereqs: [01 · Google ADK → Option A](../google-adk/01-google-adk.md#option-a--vertex-ai-recommended-production-sessions-cloud-run) steps A1–A2.
`packages/agent/Dockerfile` builds TypeScript and runs `node dist/server.js` on `$PORT`.

> Why not `adk deploy cloud_run`? That command deploys ADK's own API server. The web app needs our
> **AG-UI bridge** (`src/server.ts`, endpoint `/ag-ui`), so we deploy our own container.

### 1a. Service account (Vertex AI access without keys)
```bash
PROJECT=YOUR_PROJECT_ID
gcloud iam service-accounts create noshy-agent --project $PROJECT
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:noshy-agent@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### 1b. Secrets (only what you use)
```bash
printf '%s' 're_xxx' | gcloud secrets create RESEND_API_KEY --data-file=- --project $PROJECT
gcloud secrets add-iam-policy-binding RESEND_API_KEY --project $PROJECT \
  --member="serviceAccount:noshy-agent@$PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
# Using an AI Studio key instead of Vertex? Store GOOGLE_GENAI_API_KEY the same way.
```

### 1c. Deploy (one command, builds from source with Cloud Build)
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

- `--timeout 3600`: AG-UI responses are SSE streams; don't cut them at the 5-min default.
- `--min-instances 1`: avoids cold starts during a live demo; also keeps in-memory sessions alive if
  you don't use Agent Engine sessions.
- Redeploy after code changes: run the same command again.

Verify:
```bash
URL=$(gcloud run services describe noshy-agent --region us-central1 --format='value(status.url)')
curl $URL/health      # {"ok":true,"mode":"adk-gemini","sessions":"vertex-agent-engine",...}
```

**Cloud caveats**
- Filesystem is ephemeral: `DEALS_FILE` (leads JSON) is lost on restart. Fine for demos; use a DB for real data.
- Meet/Calendar OAuth uses token **files** (`.meet-oauth.*.json`, excluded from the image). On Cloud Run
  leave `MOCK_DELIVERY` unset (mock booking), or host the agent where you can attach a volume
  (Railway / Fly) and place both files next to `package.json`.

### Alternative: Railway / Fly
Point the service at `packages/agent` (Dockerfile is detected), set the same env vars. For Vertex
outside Google Cloud you need a service-account key: set `GOOGLE_APPLICATION_CREDENTIALS` to a mounted
JSON file — or just use `GOOGLE_GENAI_API_KEY` (Option B).

---

## 2. Voice worker → LiveKit Cloud

Full details in [02 · LiveKit → Deploy](../livekit/02-livekit.md#5-deploy-the-worker-to-livekit-cloud). Short version:
```bash
cd packages/livekit
lk cloud auth
lk agent create --secrets-file .env     # first time (creates livekit.toml — commit it)
lk agent deploy                         # updates
lk agent logs
```
The worker has **no URL dependency** on the agent or the web — it talks to the brain through the browser.

---

## 3. Web → Vercel

### 3a. Click-through (dashboard)
1. Push the repo to GitHub.
2. https://vercel.com/new → **Import** the repo.
3. **Root Directory:** `apps/web` (framework auto-detected: Next.js). Keep "Include files outside the root directory" **on** (monorepo).
4. **Environment Variables:**
   | Name | Value |
   |---|---|
   | `ADK_AG_UI_URL` | `https://noshy-agent-xxxx.run.app/ag-ui` (from step 1) |
   | `NEXT_PUBLIC_LIVEKIT_URL` | `wss://your-project.livekit.cloud` |
   | `LIVEKIT_API_KEY` | from LiveKit |
   | `LIVEKIT_API_SECRET` | from LiveKit |
   | `LIVEKIT_AGENT_NAME` | `noshy_concierge` (must match the worker) |
5. **Deploy.** Every push to `main` redeploys; PRs get preview URLs.

### 3b. CLI
```bash
npm i -g vercel
cd apps/web
vercel link
vercel env add ADK_AG_UI_URL production      # repeat for each var above
vercel --prod
```

### 3c. After the first deploy
- Put the Vercel domain in the agent's `CORS_ORIGINS` and redeploy step 1 (only needed for direct browser calls; the CopilotKit route calls the agent server-side).
- `NEXT_PUBLIC_*` vars are baked at build time → **redeploy** after changing them.
- Vercel functions have a max duration; long agent runs stream over SSE through `/api/copilotkit`.
  If you see cut-off replies, raise the function **Max Duration** in Project → Settings → Functions.

---

## 4. Smoke test the cloud stack

```bash
curl https://noshy-agent-xxxx.run.app/health     # agent up, mode adk-gemini
lk agent status                                  # worker running
open https://your-app.vercel.app                 # chat → cards render; 🎙️ → voice joins
```

## Environment variables reference

| Var | Piece | Required | Notes |
|---|---|---|---|
| `GOOGLE_GENAI_USE_VERTEXAI` | agent | yes* | `true` = Vertex, `false` = API key |
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` | agent | Vertex | |
| `GOOGLE_GENAI_API_KEY` | agent | API-key mode | |
| `GOOGLE_CLOUD_AGENT_ENGINE_ID` / `_LOCATION` | agent | no | persistent sessions |
| `ADK_MODEL` | agent | no | default `gemini-2.5-flash` |
| `PORT` | agent | no | Cloud Run sets it |
| `CORS_ORIGINS` | agent | no | comma-separated, default `http://localhost:3000` |
| `RESEND_API_KEY` / `EMAIL_FROM` / `SELLER_EMAIL` | agent | no | proposal email |
| `MOCK_DELIVERY` | agent | no | `0` = real email/calendar |
| `ADK_AG_UI_URL` | web | yes | agent `/ag-ui` URL |
| `NEXT_PUBLIC_LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | web + worker | voice | |
| `LIVEKIT_AGENT_NAME` | web + worker | no | default `noshy_concierge`, must match |
| `VOICE_PROVIDER` / `ELEVEN_API_KEY` / `ELEVEN_VOICE_ID` | worker | voice | |

\* Without any Gemini credential the agent runs in `demo-no-key` mode.
