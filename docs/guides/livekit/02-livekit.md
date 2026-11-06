# 02 · LiveKit (the voice) — keys, setup, run, deploy

Code: `packages/livekit` (Python, `livekit-agents ~1.8`). The worker only **speaks and listens**.
It never calls ADK: when it needs the brain it sends an RPC to the browser, and the browser asks
CopilotKit → AG-UI → ADK.

```text
mic ─▶ LiveKit room ─▶ worker (STT → LLM → TTS via LiveKit Inference / ElevenLabs)
                        │  RPC  brain.ask · intake.submit · plan.decide · calendar.* …
                        ▼
              browser (VoiceRoom.tsx) ─▶ CopilotKit ─▶ /ag-ui ─▶ ADK brain ─▶ UI cards
```

The frontend has three voice modes:
- **A — Web Speech (default, zero config):** browser STT/TTS → text → CopilotKit.
- **B — LiveKit room only:** `POST /api/livekit/token`.
- **C — LiveKit Agents worker (full voice):** `POST /api/livekit/session` creates a room and **dispatches** the worker by name.

---

## 1. Get LiveKit keys

1. Sign up at https://cloud.livekit.io → create a **project**.
2. **Settings → API Keys → Create key** → copy:
   - **WebSocket URL** `wss://<project>.livekit.cloud`
   - **API Key** `APIxxxx`
   - **API Secret**
3. Or via CLI:
   ```bash
   brew install livekit-cli
   lk cloud auth            # opens the browser, links the CLI to your project
   lk app env -w            # optional: writes LIVEKIT_* into a local .env
   ```

## 2. Voice provider key (pick one)

| `VOICE_PROVIDER` | Needs | Notes |
|---|---|---|
| `elevenlabs` (default) | `ELEVEN_API_KEY` (starts with `sk_`), `ELEVEN_VOICE_ID` | https://elevenlabs.io → Profile → API Keys. Use the **secret** `sk_…`, not the key ID. |
| `livekit` | nothing extra | Gemini Live native voice via LiveKit Inference (`LIVEKIT_VOICE_MODEL`, `LIVEKIT_VOICE=Puck`) |

STT/LLM default to LiveKit Inference (`STT_MODEL=deepgram/nova-3`, `LLM_MODEL=google/gemini-2.5-flash`) —
billed through your LiveKit project, no extra keys.

## 3. Fill the env files

`packages/livekit/.env`
```dotenv
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxx
LIVEKIT_API_SECRET=xxxx
LIVEKIT_AGENT_NAME=noshy_concierge
VOICE_PROVIDER=elevenlabs
ELEVEN_API_KEY=sk_...
ELEVEN_VOICE_ID=sePFppHi7mf6YBG1K6gB
ELEVEN_TTS_MODEL=eleven_flash_v2_5
# VOICE_LANGUAGE=es
```

`apps/web/.env.local` (the web app mints tokens and dispatches the worker)
```dotenv
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxx
LIVEKIT_API_SECRET=xxxx
LIVEKIT_AGENT_NAME=noshy_concierge      # must match the worker
```

> The worker also reads `apps/web/.env.local` as a fallback, so locally you can keep the
> `LIVEKIT_*` values in one place.

## 4. Install & run locally

`npm run setup` already did this. Manually:
```bash
cd packages/livekit
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m livekit.agents download-files   # VAD / turn-detector models
python agent.py dev                # or from the root: npm run dev:livekit
```

`dev` mode registers the worker with LiveKit Cloud under `LIVEKIT_AGENT_NAME` and hot-reloads on save.
Then in the app (http://localhost:3000) start voice → the web app calls `/api/livekit/session`,
LiveKit dispatches your local worker into the room.

Other modes:
```bash
python agent.py console    # talk to the agent in the terminal (no browser) — RPC to the brain won't work here
python agent.py start      # production mode (what the Docker image runs)
```

## 5. Deploy the worker to LiveKit Cloud

```bash
cd packages/livekit
lk cloud auth                                   # once
lk agent create --secrets-file .env             # first time: registers + builds the Dockerfile + deploys
lk agent deploy                                 # every later update
```

- LiveKit Cloud **injects `LIVEKIT_URL/API_KEY/API_SECRET`** automatically; the secrets file only
  needs to carry the others (`ELEVEN_*`, `VOICE_PROVIDER`, `LIVEKIT_AGENT_NAME`, …).
- `lk agent create` writes a `livekit.toml` with the agent id — **commit it**, `deploy` needs it.
- Change secrets later (rolling restart):
  ```bash
  lk agent update-secrets --secrets-file .env
  ```
- Status / logs / rollback:
  ```bash
  lk agent status
  lk agent logs              # live logs of the deployed worker
  lk agent rollback
  ```

The production web app keeps dispatching by name (`LIVEKIT_AGENT_NAME`), so the deployed worker
replaces your local one — **stop `agent.py dev` locally** or local and cloud workers will both take jobs.

> Tip: use a separate LiveKit project (or a different `LIVEKIT_AGENT_NAME`, e.g. `noshy_concierge_dev`)
> for local development so you never steal production calls.

Self-host alternative: the same `Dockerfile` runs anywhere as a long-running process
(Railway / Fly / Cloud Run with min-instances=1) with all `LIVEKIT_*` vars set; command `python agent.py start`.

The same voice, pasted into the LiveKit Cloud Agent Builder (no Python worker): [06 · Agent Builder](./06-livekit-cloud-builder.md).

Debugging voice: [05 · Debugging → LiveKit](../debugging/05-debugging.md#livekit-voice-worker).
