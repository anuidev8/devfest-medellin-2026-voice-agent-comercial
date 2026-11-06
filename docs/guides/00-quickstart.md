# 00 · Quickstart (local, ~10 min)

Get the whole stack running on your machine with **one command**.

## 1. Install the tools (once)

| Tool | Version | Install (macOS) | Needed for |
|---|---|---|---|
| Node.js | ≥ 22 (24 recommended) | `brew install node@24` or `nvm install 24` | agent + web |
| Python | 3.10 – 3.14 (3.12 recommended) | `brew install python@3.12` | LiveKit voice worker |
| gcloud CLI | latest | `brew install --cask google-cloud-sdk` | Vertex AI auth / Cloud Run deploy |
| LiveKit CLI | latest | `brew install livekit-cli` | voice worker deploy + logs |

Only Node is strictly required: without keys the agent runs in **demo mode** (scripted replies,
same UI cards) and voice falls back to the browser's Web Speech API.

## 2. Setup (once, safe to re-run)

```bash
cd commercial-voice-agent
npm run setup
```

This:
1. Creates `packages/agent/.env`, `apps/web/.env.local`, `packages/livekit/.env` from the `.env.example` files (never overwrites).
2. Runs `npm install` for all workspaces.
3. Creates `packages/livekit/.venv` and installs the Python deps + model files.

## 3. Add your keys

| File | What to fill | How to get it |
|---|---|---|
| `packages/agent/.env` | Gemini: Vertex AI **or** API key | [01 · Google ADK](./01-google-adk.md) |
| `apps/web/.env.local` | `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | [02 · LiveKit](./02-livekit.md) |
| `packages/livekit/.env` | Same `LIVEKIT_*` + `ELEVEN_API_KEY` (or `VOICE_PROVIDER=livekit`) | [02 · LiveKit](./02-livekit.md) |

CopilotKit needs **no key** here: the runtime is self-hosted inside Next.js ([03 · CopilotKit](./03-copilotkit.md)).

## 4. Run everything

```bash
npm run dev                    # agent :8000 + web :3000 + LiveKit voice worker
npm run dev -- --no-livekit    # chat only (agent + web)
```

Output is prefixed per process (`[agent]`, `[web]`, `[livekit]`). **Ctrl+C stops all of them.**
If LiveKit keys or the Python venv are missing, the voice worker is skipped with a warning and the rest still runs.

Open:
- http://localhost:3000 — the app (chat + 🎙️ voice + generative UI)
- http://localhost:3000/audience — audience voting page (put it on a QR)
- http://localhost:8000/health — agent status (`mode: adk-gemini` = real model, `demo-no-key` = scripted)

### Run processes separately (when you need one terminal per service)

```bash
npm run dev:agent     # terminal 1 → http://localhost:8000/ag-ui
npm run dev:web       # terminal 2 → http://localhost:3000
npm run dev:livekit   # terminal 3 → Python worker (agent.py dev)
npm run dev:adk-web   # optional  → ADK dev UI on http://localhost:8100
```

## 5. Check it works

```bash
npm run health                               # agent mode + sessions
npm run test:tools -w @commercial/agent      # pure tool logic, no key needed
npm run typecheck                            # agent + web
```

Then follow the chat scenarios in [`COPILOTKIT-CHAT-TEST-GUIDELINES.txt`](../../COPILOTKIT-CHAT-TEST-GUIDELINES.txt).

Next: [04 · Deploy to the cloud](./04-deploy-cloud.md) · Problems? [05 · Debugging](./05-debugging.md)
