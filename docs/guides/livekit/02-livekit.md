# 02 · LiveKit (la voz) — llaves, setup, correr, desplegar

Código: `packages/livekit` (Python, `livekit-agents ~1.8`). El worker solo **habla y escucha**.
Nunca llama a ADK: cuando necesita el cerebro manda un RPC al navegador, y el navegador pregunta
a CopilotKit → AG-UI → ADK.

```text
mic ─▶ sala LiveKit ─▶ worker (STT → LLM → TTS vía LiveKit Inference / ElevenLabs)
                        │  RPC  brain.ask · intake.submit · plan.decide · calendar.* …
                        ▼
              navegador (VoiceRoom.tsx) ─▶ CopilotKit ─▶ /ag-ui ─▶ cerebro ADK ─▶ tarjetas
```

El frontend tiene tres modos de voz:
- **A — Web Speech (por defecto, cero config):** STT/TTS del navegador → texto → CopilotKit.
- **B — solo sala LiveKit:** `POST /api/livekit/token`.
- **C — worker de LiveKit Agents (voz completa):** `POST /api/livekit/session` crea una sala y **despacha** al worker por nombre.

---

## 1. Consigue las llaves de LiveKit

1. Regístrate en https://cloud.livekit.io → crea un **proyecto**.
2. **Settings → API Keys → Create key** → copia:
   - **WebSocket URL** `wss://<project>.livekit.cloud`
   - **API Key** `APIxxxx`
   - **API Secret**
3. O por CLI:
   ```bash
   brew install livekit-cli
   lk cloud auth            # abre el navegador y vincula la CLI a tu proyecto
   lk app env -w            # opcional: escribe LIVEKIT_* en un .env local
   ```

## 2. Llave del proveedor de voz (elige una)

| `VOICE_PROVIDER` | Necesita | Notas |
|---|---|---|
| `elevenlabs` (por defecto) | `ELEVEN_API_KEY` (empieza con `sk_`), `ELEVEN_VOICE_ID` | https://elevenlabs.io → Profile → API Keys. Usa el **secreto** `sk_…`, no el ID de la llave. |
| `livekit` | nada extra | Voz nativa de Gemini Live vía LiveKit Inference (`LIVEKIT_VOICE_MODEL`, `LIVEKIT_VOICE=Puck`) |

STT y LLM salen por defecto de LiveKit Inference (`STT_MODEL=deepgram/nova-3`, `LLM_MODEL=google/gemini-2.5-flash`).
Se cobran en tu proyecto de LiveKit, sin llaves extra.

## 3. Llena los env

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

`apps/web/.env.local` (la web emite tokens y despacha al worker)
```dotenv
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxx
LIVEKIT_API_SECRET=xxxx
LIVEKIT_AGENT_NAME=noshy_concierge      # tiene que coincidir con el worker
```

> El worker también lee `apps/web/.env.local` como respaldo, así que en local puedes dejar
> los `LIVEKIT_*` en un solo sitio.

## 4. Instalar y correr en local

`npm run setup` ya hizo esto. A mano:
```bash
cd packages/livekit
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m livekit.agents download-files   # modelos de VAD / detector de turno
python agent.py dev                # o desde la raíz: npm run dev:livekit
```

El modo `dev` registra el worker en LiveKit Cloud bajo `LIVEKIT_AGENT_NAME` y recarga al guardar.
Luego, en la app (http://localhost:3000), inicia la voz → la web llama a `/api/livekit/session`
y LiveKit mete tu worker local en la sala.

Otros modos:
```bash
python agent.py console    # habla con el agente en la terminal (sin navegador) — el RPC al cerebro no funciona aquí
python agent.py start      # modo producción (lo que corre la imagen de Docker)
```

## <a id="desplegar-el-worker"></a>5. Desplegar el worker en LiveKit Cloud

La CLI despliega en el **proyecto por defecto**, no en el de `packages/livekit/.env`.
Confírmalo antes de `create` o `deploy`. En esta máquina el default puede ser `app-voice`;
la voz de este repo es **comercial-agent** (`wss://comercial-agent-3jbhm68y.livekit.cloud`).

```bash
# 1. Proyecto al que apunta el .env (no imprime secretos)
awk -F= '/^LIVEKIT_URL=/ {print}' packages/livekit/.env

# 2. Proyectos que la CLI tiene vinculados. La fila con * es el default.
lk project list

# 3. Si comercial-agent no aparece, vincula la cuenta (abre el navegador) y vuelve a listar
lk cloud auth
lk project list

# 4. Agentes de ESE proyecto. Tiene que decir "Using project [comercial-agent]".
cd packages/livekit
lk --project comercial-agent agent list
```

Para dejar comercial-agent como default (el resto de comandos `lk` irán ahí):

```bash
lk project set-default comercial-agent
```

Primera vez, si `agent list` no tiene un agente Cloud y no existe `livekit.toml`.
Cloud inyecta `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET`; pasa solo el resto.
La región del dashboard es `us-east`.

```bash
cd packages/livekit
lk --project comercial-agent agent create --region us-east \
  --secrets LIVEKIT_AGENT_NAME=noshy_concierge \
  --secrets VOICE_PROVIDER=elevenlabs \
  --secrets ELEVEN_API_KEY=sk_... \
  --secrets ELEVEN_VOICE_ID=... \
  --secrets ELEVEN_TTS_MODEL=eleven_flash_v2_5
```

El mismo alta con un archivo de secretos (sin las tres `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`):

```bash
lk --project comercial-agent agent create --region us-east --secrets-file .env.cloud
```

Si el agente ya existe, `agent list` muestra su id (`CA_...`). Ata este directorio a ese id y publica una versión nueva:

```bash
cd packages/livekit
lk --project comercial-agent agent config --id CA_...
lk --project comercial-agent agent deploy
```

`lk agent config` escribe `livekit.toml`. **Súbelo al repo**: a partir de ahí `deploy` encuentra el agente sin `--id`. Cada actualización:

```bash
cd packages/livekit
lk agent deploy
```

Secretos después (reinicio gradual), estado, logs y rollback. `rollback` pide la versión que lista `versions`:

```bash
lk agent update-secrets --secrets-file .env.cloud
lk agent status
lk agent logs
lk agent versions
lk agent rollback --version VERSION
```

La web de producción sigue despachando por nombre (`LIVEKIT_AGENT_NAME`), así que el worker desplegado
reemplaza al local. **Para `agent.py dev` en tu máquina** o el worker local y el de la nube tomarán llamadas los dos.

> Tip: usa un proyecto de LiveKit aparte (o otro `LIVEKIT_AGENT_NAME`, por ejemplo `noshy_concierge_dev`)
> para desarrollar, y así no te llevas las llamadas de producción.

Alternativa self-host: el mismo `Dockerfile` corre en cualquier lado como proceso largo
(Railway / Fly / Cloud Run con min-instances=1) con todas las variables `LIVEKIT_*`; el comando es `python agent.py start`.

La misma voz, pegada en el Agent Builder de LiveKit Cloud (sin worker de Python): [06 · Agent Builder](./06-livekit-cloud-builder.md).

Depurar la voz: [05 · Depuración → LiveKit](../debugging/05-debugging.md#worker-de-voz-livekit).
