# NoShy LiveKit voice worker (Python)

Gemini Live speech via **LiveKit Inference**. No Google ADK here.

```text
mic → LiveKit room → this worker (Inference)
         ↓ RPC
browser CopilotKit → AG-UI → packages/agent (ADK)
```

## Local

```bash
cd packages/livekit
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # or reuse existing .env
python agent.py dev
```

From repo root: `npm run dev:livekit`

## Deploy to LiveKit Cloud

```bash
# once
brew install livekit-cli   # or see https://docs.livekit.io/agents/ops/deployment/
lk cloud auth

cd packages/livekit
lk agent create
# later updates:
lk agent deploy
```

Secrets (`LIVEKIT_*` are usually injected by Cloud; set `LIVEKIT_AGENT_NAME=noshy_concierge` if needed). The web app dispatches to that agent name via `POST /api/livekit/session`.
