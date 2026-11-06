# Worker de voz LiveKit de NoShy (Python)

Voz de Gemini Live vía **LiveKit Inference**. Aquí no hay Google ADK.

```text
mic → sala LiveKit → este worker (Inference)
         ↓ RPC
navegador CopilotKit → AG-UI → packages/agent (ADK)
```

## Local

```bash
cd packages/livekit
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # o reutiliza el .env que ya tienes
python agent.py dev
```

Desde la raíz del repo: `npm run dev:livekit`

## Desplegar en LiveKit Cloud

```bash
# una vez
brew install livekit-cli   # o mira https://docs.livekit.io/agents/ops/deployment/
lk cloud auth

cd packages/livekit
lk agent create
# actualizaciones después:
lk agent deploy
```

Secretos (Cloud suele inyectar `LIVEKIT_*`; pon `LIVEKIT_AGENT_NAME=noshy_concierge` si hace falta). La web despacha a ese nombre de agente con `POST /api/livekit/session`.
