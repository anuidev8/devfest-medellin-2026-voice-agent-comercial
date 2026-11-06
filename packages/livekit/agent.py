"""NoShy Concierge — LiveKit voice worker (Python).

Two voices, picked with VOICE_PROVIDER:
  elevenlabs (default) — Deepgram STT + Gemini LLM (LiveKit Inference) + ElevenLabs TTS
  livekit              — Gemini Live realtime model with its native voice (LIVEKIT_VOICE)
If ElevenLabs is selected but ELEVEN_API_KEY is missing, it falls back to `livekit`.
Commercial brain stays on CopilotKit → AG-UI → Google ADK in the browser (RPC bridge).

Local:
  cd packages/livekit && python agent.py dev

Deploy to LiveKit Cloud:
  lk cloud auth
  lk agent create
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    AgentServer,
    AgentSession,
    JobContext,
    cli,
    inference,
)
from livekit.agents.voice.turn import TurnHandlingOptions
from livekit.plugins import elevenlabs

from tools import ConciergeAgent

logger = logging.getLogger("noshy-livekit")

ROOT = Path(__file__).resolve().parent


def setup_dev_file_logs() -> None:
    """Dev only: also write logs to packages/livekit/logs/ (on with `agent.py dev` or LOG_TO_FILE=1).
    Never in production (`start`) — there the platform collects stdout."""
    if "dev" in sys.argv[1:2]:
        os.environ["LOG_TO_FILE"] = "1"  # job subprocesses inherit it
    if os.getenv("LOG_TO_FILE") != "1":
        return
    logger.setLevel(logging.INFO)
    # Only the main worker writes the file: job processes forward their records to it over IPC
    # (writing in both doubled every line).
    root = logging.getLogger()
    # Only the worker that first set this up writes the file. Job processes (spawned by LiveKit, not
    # multiprocessing children) inherit the env var and forward their records to it instead.
    owner = os.environ.setdefault("NOSHY_LOG_OWNER_PID", str(os.getpid()))
    if owner != str(os.getpid()) or any(isinstance(h, RotatingFileHandler) for h in root.handlers):
        return
    log_dir = ROOT / "logs"
    log_dir.mkdir(exist_ok=True)
    handler = RotatingFileHandler(log_dir / "livekit-agent.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    handler.setLevel(logging.DEBUG if os.getenv("LOG_LEVEL", "").upper() == "DEBUG" else logging.INFO)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s [%(process)d] %(message)s"))
    # Forked job processes inherit this handler AND forward their records to the main worker,
    # which writes them: only write from the process that created the handler (no doubled lines).
    main_pid = os.getpid()
    handler.addFilter(lambda _record: os.getpid() == main_pid)
    root.addHandler(handler)
    logger.info("file logs → %s", log_dir / "livekit-agent.log")
load_dotenv(ROOT / ".env")
load_dotenv(ROOT.parent.parent / "apps" / "web" / ".env.local")
setup_dev_file_logs()

AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "noshy_concierge")
VOICE = os.getenv("LIVEKIT_VOICE", "Puck")
MODEL = os.getenv("LIVEKIT_VOICE_MODEL", "google/gemini-3.8-live")

VOICE_PROVIDER = os.getenv("VOICE_PROVIDER", "elevenlabs").strip().lower()
ELEVEN_API_KEY = os.getenv("ELEVEN_API_KEY", "").strip()
ELEVEN_VOICE_ID = os.getenv("ELEVEN_VOICE_ID", "sePFppHi7mf6YBG1K6gB").strip()
ELEVEN_TTS_MODEL = os.getenv("ELEVEN_TTS_MODEL", "eleven_flash_v2_5").strip()
STT_MODEL = os.getenv("STT_MODEL", "deepgram/nova-3")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemini-2.5-flash")
LANGUAGE = os.getenv("VOICE_LANGUAGE", "es")
RPC_ASK = "concierge.ask"
RPC_FINALE = "concierge.finale"

FINALE_INSTRUCTIONS = (
    "La animación final terminó: la propuesta quedó lista. Cierra en español, cálido, con energía y profesional "
    "(4–5 frases cortas, como un gran vendedor que despide a un cliente): 1) agradece por el tiempo y por confiar; "
    "2) deséale mucha suerte en su reunión o su próxima venta (usa el nombre del cliente si lo sabes); "
    "3) una frase sobre vender aportando valor: cada conversación con un cliente es una oportunidad de ayudar; "
    "4) invítalo a seguir construyendo con la comunidad; 5) despídete de todos en el Google DevFest Medellín 2026. "
    "No hagas preguntas. No digas 'demo', 'simulado', 'prueba' ni que eres una IA."
)

WELCOME_INSTRUCTIONS = (
    "Da la bienvenida en español, cálido, con energía y en 3 frases cortas (como un gran anfitrión, no como un robot). "
    "1) Bienvenida abierta: si encaja, saluda a la gente del Google DevFest Medellín 2026 y preséntate como NoShy Concierge, "
    "tu compañero comercial. 2) El valor, en una frase: ayudas a llegar a cada cliente con las preguntas correctas y una "
    "propuesta que muestra valor real; y si su empresa tiene una necesidad, a resolverla con proyectos y talento de la comunidad. "
    "3) Una frase corta: si ya tuvo una reunión, puede compartirte el enlace de su Google Meet o pegar la "
    "transcripción en pantalla y la analizas. 4) Termina con UNA pregunta: ¿cómo te llamas? "
    "No digas que eres una IA, no hables de modelos ni de 'tres preguntas'."
)


def build_session() -> AgentSession:
    """ElevenLabs pipeline by default; Gemini Live native voice as the option / fallback."""
    valid_key = ELEVEN_API_KEY.startswith("sk_")  # a 64-char hex value is the key *ID*, not the key
    if VOICE_PROVIDER == "elevenlabs" and valid_key:
        logger.info("voice=elevenlabs model=%s voice=%s… llm=%s", ELEVEN_TTS_MODEL, ELEVEN_VOICE_ID[:8], LLM_MODEL)
        return AgentSession(
            stt=inference.STT(model=STT_MODEL, language=LANGUAGE),
            llm=inference.LLM(model=LLM_MODEL),
            tts=elevenlabs.TTS(
                api_key=ELEVEN_API_KEY,
                voice_id=ELEVEN_VOICE_ID,
                model=ELEVEN_TTS_MODEL,
                language=LANGUAGE,
                voice_settings=elevenlabs.VoiceSettings(stability=0.5, similarity_boost=0.75),
            ),
            turn_handling=TurnHandlingOptions(turn_detection=inference.TurnDetector()),
            use_tts_aligned_transcript=True,  # word-timed transcript → card highlights stay in sync
            max_tool_steps=8,
        )
    if VOICE_PROVIDER == "elevenlabs":
        logger.warning(
            "VOICE_PROVIDER=elevenlabs but ELEVEN_API_KEY is %s → using Gemini Live voice. "
            "Create a key at elevenlabs.io → Settings → API Keys (it starts with sk_).",
            "missing" if not ELEVEN_API_KEY else "not a valid key (looks like the key ID)",
        )
    logger.info("voice=livekit model=%s voice=%s", MODEL, VOICE)
    return AgentSession(llm=inference.RealtimeModel(model=MODEL, voice=VOICE))


def _sentences(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"(?<=[.!?…])\s+", text.strip()) if p.strip()]


def speakable(reply: str, max_sentences: int = 3) -> str:
    """The brain's reply, short: first sentences, keeping the closing question (e.g. "¿Lo entendí bien?")."""
    parts = _sentences(reply)
    if len(parts) <= max_sentences:
        return " ".join(parts)
    head = parts[: max_sentences - 1]
    tail = parts[-1] if parts[-1].endswith("?") else parts[max_sentences - 1]
    return " ".join([*head, tail])


def brain_result_plan(result: object) -> tuple[str, str]:
    """("say", exact text) for anything that must be spoken ONCE and verbatim, or ("reply", LLM instructions)
    when it needs judgement (a send that did not go out)."""
    r = result if isinstance(result, dict) else {}
    reply = str(r.get("reply") or "").strip()
    shown = [s for s in (r.get("shown") or []) if isinstance(s, dict)]
    tools = {str(s.get("tool")) for s in shown}
    delivery = [s for s in shown if s.get("tool") in ("send_plan_email", "book_meeting")]
    if delivery:
        summary = " ".join(str(s.get("summary") or "") for s in delivery)
        if re.search(r'"status":"(sent|booked|ok)"', summary):
            meeting = any(s.get("tool") == "book_meeting" for s in delivery)
            return ("say", "Listo, tu reunión quedó agendada." if meeting else "Listo, tu propuesta va en camino.")
        return (
            "reply",
            f"El envío NO se hizo (resultado: {summary[:240]}). En UNA frase dilo con naturalidad, sin decir que va "
            "en camino ni 'demo'; si falta el correo, pídelo.",
        )
    if "match_community" in tools and not tools & {"build_strategy_plan", "build_product_plan"}:
        question = next((p for p in reversed(_sentences(reply)) if p.endswith("?")), "")
        summary = " ".join(str(s.get("summary") or "") for s in shown if s.get("tool") == "match_community")
        has_people = not re.search(r"personas:\s*(\||$)", summary)
        has_projects = not re.search(r"proyectos:\s*(\||$)", summary)
        lead = (
            "Te dejo en pantalla las personas que te pueden ayudar."
            if has_people and not has_projects
            else "Te dejo en pantalla los productos y proyectos relacionados."
        )
        return ("say", " ".join(filter(None, [lead, question])))
    if "open_calendar" in tools:
        return ("say", "Te abrí el calendario. Dime qué día y hora te queda bien.")
    return ("say", speakable(reply) or "Listo, ya está en pantalla.")


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def noshy_concierge(ctx: JobContext) -> None:
    setup_dev_file_logs()  # job process (dev): same file
    ctx.log_context_fields = {"room": ctx.room.name}
    logger.info("session start room=%s", ctx.room.name)
    await ctx.connect()

    caller = await ctx.wait_for_participant()
    local = ctx.room.local_participant
    assert local is not None

    async def call_browser(method: str, payload: object) -> object:
        logger.info("rpc → %s %s", method, json.dumps(payload, ensure_ascii=False)[:400])
        raw = await local.perform_rpc(
            destination_identity=caller.identity,
            method=method,
            payload=json.dumps(payload),
            response_timeout=90.0,
        )
        return json.loads(raw) if raw else {}

    session = build_session()

    last_said: dict[str, float] = {}

    def say_once(text: str) -> None:
        """Speak a brain result exactly once: identical text within 90 s is dropped (no repeats)."""
        key = re.sub(r"\W+", " ", text.lower()).strip()
        now = time.monotonic()
        if key and now - last_said.get(key, -1e9) < 90:
            logger.info("skip repeated speech: %s", text[:160])
            return
        last_said[key] = now
        if session.tts is not None:
            session.say(text)
        else:  # realtime voice (no separate TTS): ask it to read the line verbatim
            session.generate_reply(instructions=f"Di exactamente esto, sin añadir nada: «{text}»")

    def on_brain_result(ok: bool, result: object, error: str | None) -> None:
        logger.info("brain result ok=%s error=%s result=%s", ok, error, json.dumps(result, ensure_ascii=False)[:600])
        try:
            if ok:
                mode, text = brain_result_plan(result)
                if mode == "say":
                    say_once(text)
                else:
                    session.generate_reply(instructions=text)
            else:
                session.generate_reply(
                    instructions=(
                        f"El cerebro comercial falló: {error}. Dilo en una frase corta y natural (sin leer comandos ni "
                        "detalles técnicos): no pudiste preparar los resultados y en pantalla está cómo arreglarlo. "
                        "Pregunta si reintentas. No inventes resultados."
                    )
                )
        except Exception:  # noqa: BLE001
            logger.warning("brain result dropped", exc_info=True)

    @session.on("conversation_item_added")
    def _log_speech(ev: object) -> None:
        # Everything said (user + agent) → log, to spot repeats.
        try:
            item = getattr(ev, "item", None)
            text = getattr(item, "text_content", None) or ""
            if text:
                logger.info("said %s: %s", getattr(item, "role", "?"), text[:400])
        except Exception:  # noqa: BLE001
            pass

    await session.start(
        room=ctx.room,
        agent=ConciergeAgent(call_browser, on_brain_result),
    )

    session.generate_reply(instructions=WELCOME_INSTRUCTIONS)

    @local.register_rpc_method(RPC_FINALE)
    async def on_finale(data: rtc.RpcInvocationData) -> str:
        # Browser calls this when the finale journey animation ends.
        logger.info("finale done → closing lines")
        handle = session.generate_reply(instructions=FINALE_INSTRUCTIONS)
        await handle.wait_for_playout()
        return "ok"

    @local.register_rpc_method(RPC_ASK)
    async def on_ask(data: rtc.RpcInvocationData) -> str:
        text = (data.payload or "").strip()
        if not text:
            return ""
        logger.info("concierge.ask (typed) %s", text[:300])
        handle = session.generate_reply(user_input=text)
        await handle.wait_for_playout()
        return "ok"


if __name__ == "__main__":
    cli.run_app(server)
