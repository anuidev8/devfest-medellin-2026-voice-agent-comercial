# 00 · Inicio rápido (local, ~10 min)

Levanta todo el stack en tu máquina con **un comando**.

## 1. Instala las herramientas (una vez)

| Herramienta | Versión | Instalar (macOS) | Para qué |
|---|---|---|---|
| Node.js | ≥ 22 (24 recomendado) | `brew install node@24` o `nvm install 24` | agente + web |
| Python | 3.10 – 3.14 (3.12 recomendado) | `brew install python@3.12` | worker de voz LiveKit |
| gcloud CLI | última | `brew install --cask google-cloud-sdk` | auth de Vertex AI / deploy a Cloud Run |
| LiveKit CLI | última | `brew install livekit-cli` | deploy y logs del worker de voz |

Solo Node es obligatorio: sin llaves el agente corre en **modo demo** (respuestas guionadas, las mismas tarjetas) y la voz usa el Web Speech API del navegador.

## 2. Setup (una vez; se puede repetir)

```bash
cd commercial-voice-agent
npm run setup
```

Esto:
1. Crea `packages/agent/.env`, `apps/web/.env.local` y `packages/livekit/.env` desde los `.env.example` (no pisa los que ya existen).
2. Corre `npm install` en todos los workspaces.
3. Crea `packages/livekit/.venv` e instala las dependencias de Python y los modelos.

## 3. Agrega tus llaves

| Archivo | Qué llenar | Cómo conseguirlo |
|---|---|---|
| `packages/agent/.env` | Gemini: Vertex AI **o** API key | [01 · Google ADK](./google-adk/01-google-adk.md) |
| `apps/web/.env.local` | `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | [02 · LiveKit](./livekit/02-livekit.md) |
| `packages/livekit/.env` | Los mismos `LIVEKIT_*` + `ELEVEN_API_KEY` (o `VOICE_PROVIDER=livekit`) | [02 · LiveKit](./livekit/02-livekit.md) |

CopilotKit **no necesita llave** aquí: el runtime vive dentro de Next.js ([03 · CopilotKit](./copilotkit/03-copilotkit.md)).

## 4. Corre todo

```bash
npm run dev                    # agente :8000 + web :3000 + worker de voz LiveKit
npm run dev -- --no-livekit    # solo chat (agente + web)
```

La salida va con prefijo por proceso (`[agent]`, `[web]`, `[livekit]`). **Ctrl+C los detiene todos.**
Si faltan las llaves de LiveKit o el venv de Python, el worker de voz se salta con un aviso y el resto sigue.

Abre:
- http://localhost:3000 — la app (chat + 🎙️ voz + UI generativa)
- http://localhost:3000/audience — votación del público (para un QR)
- http://localhost:8000/health — estado del agente (`mode: adk-gemini` = modelo real, `demo-no-key` = guion)

### Procesos por separado (una terminal por servicio)

```bash
npm run dev:agent     # terminal 1 → http://localhost:8000/ag-ui
npm run dev:web       # terminal 2 → http://localhost:3000
npm run dev:livekit   # terminal 3 → worker de Python (agent.py dev)
npm run dev:adk-web   # opcional  → UI de desarrollo de ADK en http://localhost:8100
```

## 5. Comprueba que funciona

```bash
npm run health                               # modo del agente + sesiones
npm run test:tools -w @commercial/agent      # lógica de tools, sin llave
npm run typecheck                            # agente + web
```

Sigue los escenarios de chat en [`COPILOTKIT-CHAT-TEST-GUIDELINES.txt`](../COPILOTKIT-CHAT-TEST-GUIDELINES.txt).

Siguiente: [04 · Desplegar en la nube](./deploy/04-deploy-cloud.md) · ¿Problemas? [05 · Depuración](./debugging/05-debugging.md)
