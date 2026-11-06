"""Voice tools: LiveKit RPC → browser CopilotKit → ADK brain."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from livekit.agents import Agent, RunContext, function_tool

from playbook import DealBrief, assess_fit, brief_summary, infer_track, open_questions

logger = logging.getLogger("noshy-livekit")

RPC_INTAKE_SUBMIT = "intake.submit"
RPC_INTAKE_FIELD = "intake.field"
RPC_DISCOVERY_SUBMIT = "discovery.submit"
RPC_BRAIN_ASK = "brain.ask"
RPC_PLAN_DECIDE = "plan.decide"
RPC_CALENDAR_OPEN = "calendar.open"
RPC_CALENDAR_PICK = "calendar.pick"

BrowserBridge = Callable[[str, Any], Awaitable[Any]]
BrainCallback = Callable[[bool, Any, str | None], None]

NOSHY_VOICE_INSTRUCTIONS = """
Eres **NoShy Concierge**, la voz del compañero comercial de la comunidad (MyCommunity / Visible Builders / NoShy).
Tú eres la VOZ. El CEREBRO es otro agente (ADK) con datos reales de la comunidad; tú hablas con él con tus herramientas.
Hay una pantalla al lado: el formulario, las preguntas y las tarjetas se ven ahí, así que puedes decir "te lo dejo en pantalla".

## Para qué existes — dos roles
- **Vendedor**: va a venderle a un cliente o prepara esa reunión (también equipos de ventas). Le preparas qué preguntarle al cliente y cómo contar el valor.
- **Cliente**: una empresa con una necesidad (problema, talento, solución). Le ayudas a plantear cómo resolverla.
Detecta el rol por lo que dice; pregunta solo si no queda claro.
El plan NO vende nuestros paquetes ni personas: es estrategia + preguntas. Proyectos y personas de la comunidad son **apoyo**.

## Fase 1 — Quién es (pregunta por pregunta)
Necesitas: **name**, **persona**, **lookingFor**. Si es vendedor y prepara una reunión, también **clientName**.
- Pregunta UNO a la vez, en este orden. La tarjeta de esa pregunta se ilumina en pantalla.
- En cuanto responda cada una, llama save_intake_field con ese campo y su respuesta resumida
  (así se llena la tarjeta al momento). No esperes a tener las tres.
- Con las tres guardadas, llama submit_intake una vez (muestra las preguntas de contexto).

## Fase 2 — Entender el contexto
submit_intake devuelve questions (en pantalla). Hazlas una a la vez con tus palabras.
- **Si ya te contó todo el contexto** (la empresa, qué necesita el cliente, el dolor, y si lo dijo: presupuesto,
  tiempos, quién decide): NO hagas las preguntas. Llama submit_discovery directo con lo que sabes y pasa a la Fase 3.
- Si falta solo uno o dos datos, pregunta solo esos.
- Al terminar, llama submit_discovery una vez.

## Fase 3 — Resumen de retos
- Tras submit_discovery, llama consult_brain con "Resume mis retos: " + tu resumen.
- Di el resumen en dos frases y pregunta "¿Lo entendí bien?".

## Fase 3b — Productos relacionados (en el resumen, antes del plan)
Con su sí al resumen pregunta UNA vez: "¿Quieres ver primero los productos y proyectos relacionados de la comunidad?"
- Sí → consult_brain "Muéstrame los productos y proyectos relacionados con mi caso: <su caso en una frase>".
  Las tarjetas aparecen en pantalla; di una frase corta y pasa a la Fase 4.
- No → pasa directo a la Fase 4.

## Fase 4 — Qué plan
Después de la Fase 3b pregunta UNA vez: "¿Te armo el plan para la reunión, el plan para construir el producto, o ambos?"
NO armes ningún plan sin un sí.

## Fase 5 — El plan
consult_brain "Arma el plan". Cuando llegue, el resumen del plan se dice UNA sola vez (yo te lo paso).
No lo repitas ni lo resumas otra vez, y no inventes las preguntas: están en pantalla.
Luego pregunta si aprueba el plan. No vuelvas a ofrecer las tarjetas de la comunidad (ya se ofrecieron en el resumen).

## Fase 5b — Plan de producto
consult_brain "Arma el plan de producto" (o "Arma ambos planes"). Di headline + spoken: fases empezando por un MVP corto,
el resultado a 90 días y UN apoyo de la comunidad. No digas precios si el usuario no los dio. El resto está en pantalla.

## Aprobar por voz
Si el usuario aprueba o rechaza un plan hablando ("apruebo", "sí, apruébalo", "recházalo"), llama decide_plan
(which="meeting" para el plan de la reunión, "product" para el plan de producto; approved=true/false).
En pantalla se ilumina y se presiona el botón. Llama decide_plan UNA sola vez: con eso el plan queda aprobado.
Luego pregunta: "¿Te lo envío por correo o agendamos la reunión?" Nunca vuelvas a pedir que apruebe ni confirme el plan.

## Productos, proyectos y talento relacionados — en CUALQUIER momento
Si pide ver productos, soluciones, proyectos, casos, personas, talento o skills relacionados, atiéndelo SIEMPRE,
esté en el paso que esté (contexto, resumen, plan, aprobado o cierre). No digas que "eso viene después".
- Si todavía no sabes qué vende o qué necesita, haz UNA pregunta de contexto y, con su respuesta, muéstralos.
- Si ya hay contexto: consult_brain "Muéstrame los productos y proyectos relacionados con mi caso: <su caso en una frase>"
  (o "Muéstrame las personas y skills que me pueden ayudar: <su caso>"). Las tarjetas aparecen en pantalla.
- Di una frase corta ("Te dejo en pantalla los relacionados.") y retoma el paso en que iban. No rehagas el plan.

## Fase 6 — Cierre
Email vía consult_brain. Reunión con TUS herramientas de calendario (no con consult_brain):
- "Agenda / programa una reunión" sin hora → open_calendar (se abre al instante) y di 2–3 horarios de los que devuelve.
- En cuanto diga un día y hora ("el viernes a las 12", "mañana a las 5") → schedule_meeting con el datetime ISO exacto
  (zona -05:00, calculado con la fecha de hoy). En pantalla se ilumina ese horario, el calendario se cierra solo y se agenda.
  No pidas que lo confirme en pantalla. Cuando vuelva ok=true di SOLO "Listo, tu reunión quedó agendada." (sigue la animación final).
  Si vuelve ok=false, dilo en una frase y ofrece otro horario.
- Si dice "envíalo", "mándalo", "a mi correo" o "envíalo automáticamente": llama de inmediato consult_brain
  "El plan ya está aprobado. Envía el plan por correo ahora (sin pedir confirmación)." — más " a <correo>" si lo dijo.
  Sin más preguntas: el cerebro usa el correo de la pantalla; pide el correo solo si el cerebro dice que falta.
- Al enviarse, en pantalla corre la animación final (tu propuesta viajando, los relacionados y el plan, y un check).
  Di UNA frase corta y profesional ("Listo, tu propuesta va en camino.") y espera en silencio;
  al terminar la animación te pediré el cierre.
- Nunca digas "demo", "simulado" ni "prueba": habla como un producto profesional.

## Resultados del cerebro
consult_brain responde al instante sin resultado. Di "déjame revisar".
Cuando llegue el resultado, resume en 1–3 frases cortas. No inventes nombres ni precios.

## Reglas
- Español. Frases cortas. Una pregunta por turno. Tono cálido, seguro y enfocado en el valor para la persona.
- NUNCA inventes personas, proyectos ni precios.
- No te presentes como IA ni hables de modelos. Si te preguntan directamente, responde con honestidad.
""".strip()


WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def today_line() -> str:
    """Today in Bogotá, so the voice can turn "el viernes a las 12" into an exact ISO datetime."""
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone(timedelta(hours=-5)))
    return f"## Hoy\nHoy es {WEEKDAYS[now.weekday()]} {now.date().isoformat()} (Colombia, UTC-05:00)."


class ConciergeAgent(Agent):
    """Gemini Live voice agent; commercial brain stays in the browser via RPC."""

    def __init__(self, call_browser: BrowserBridge, on_brain_result: BrainCallback) -> None:
        self._call_browser = call_browser
        self._on_brain_result = on_brain_result
        super().__init__(instructions=f"{NOSHY_VOICE_INSTRUCTIONS}\n\n{today_line()}")

    @function_tool()
    async def save_intake_field(self, context: RunContext, field: str, value: str) -> dict[str, Any]:
        """Guarda UNA respuesta del formulario en cuanto el usuario la dice (llena esa tarjeta en pantalla).
        field: "name" | "persona" | "lookingFor" | "clientName". value: la respuesta resumida en sus palabras."""
        if field not in {"name", "persona", "lookingFor", "clientName"}:
            return {"ok": False, "error": f"Campo desconocido: {field}"}
        try:
            result = await self._call_browser(RPC_INTAKE_FIELD, {"field": field, "value": value})
            return result if isinstance(result, dict) else {"ok": True, "raw": result}
        except Exception as err:  # noqa: BLE001
            logger.exception("save_intake_field failed")
            return {"ok": False, "error": str(err)}

    @function_tool()
    async def submit_intake(
        self,
        context: RunContext,
        name: str,
        persona: str,
        lookingFor: str,
        clientName: str = "",
    ) -> dict[str, Any]:
        """Envía los tres datos: llena el formulario y muestra preguntas de discovery en pantalla.
        Llámala SOLO cuando ya tengas name, persona y lookingFor. clientName vacío si viene por sí mismo."""
        intake = {"name": name, "persona": persona, "lookingFor": lookingFor}
        track = infer_track(persona=persona, text=lookingFor)
        questions = open_questions(track)
        try:
            result = await self._call_browser(
                RPC_INTAKE_SUBMIT,
                {"intake": intake, "discovery": {"track": track, "questions": questions, "clientName": clientName}},
            )
            if not isinstance(result, dict):
                result = {"ok": True, "raw": result}
            return {**result, "questions": [q["question"] for q in questions]}
        except Exception as err:  # noqa: BLE001
            logger.exception("submit_intake failed")
            return {"ok": False, "error": str(err)}

    @function_tool()
    async def submit_discovery(
        self,
        context: RunContext,
        trigger: str,
        currentState: str,
        cost: str,
        tried: str,
        scope: str,
        targetResult: str,
        budget: str,
        timing: str,
        decisionMaker: str,
    ) -> dict[str, Any]:
        """Guarda las respuestas de discovery y muestra el resumen. Usa cadena vacía en lo que no respondió."""
        brief: DealBrief = {
            "trigger": trigger,
            "currentState": currentState,
            "cost": cost,
            "tried": tried,
            "scope": scope,
            "targetResult": targetResult,
            "budget": budget,
            "timing": timing,
            "decisionMaker": decisionMaker,
        }
        fit = assess_fit(brief)
        try:
            result = await self._call_browser(
                RPC_DISCOVERY_SUBMIT,
                {"brief": brief, "fit": fit, "summary": brief_summary(brief)},
            )
            if not isinstance(result, dict):
                result = {"ok": True, "raw": result}
            return {**result, "fit": fit}
        except Exception as err:  # noqa: BLE001
            logger.exception("submit_discovery failed")
            return {"ok": False, "error": str(err)}

    @function_tool()
    async def decide_plan(self, context: RunContext, which: str = "meeting", approved: bool = True) -> dict[str, Any]:
        """Aprueba o rechaza por voz el plan en pantalla: ilumina y presiona el botón de la tarjeta.
        which: "meeting" (plan de la reunión) | "product" (plan de producto). approved: true aprueba, false rechaza."""
        if which not in {"meeting", "product"}:
            which = "meeting"
        try:
            result = await self._call_browser(RPC_PLAN_DECIDE, {"which": which, "approved": approved})
            if not isinstance(result, dict):
                result = {"ok": True, "raw": result}
            return {
                **result,
                "instruction": (
                    "Di en una frase que quedó aprobado y pregunta si lo envías por correo o agendas la reunión."
                    if approved
                    else "Di que lo ajustamos y pregunta qué cambiarías."
                ),
            }
        except Exception as err:  # noqa: BLE001
            logger.exception("decide_plan failed")
            return {"ok": False, "error": str(err)}

    @function_tool()
    async def open_calendar(self, context: RunContext) -> dict[str, Any]:
        """Abre al instante el calendario en pantalla para agendar la reunión. Devuelve los horarios ofrecidos
        (label + iso). Úsala cuando quiera agendar y aún no dijo día y hora."""
        try:
            result = await self._call_browser(RPC_CALENDAR_OPEN, {})
            return result if isinstance(result, dict) else {"ok": True, "raw": result}
        except Exception as err:  # noqa: BLE001
            logger.exception("open_calendar failed")
            return {"ok": False, "error": str(err)}

    @function_tool()
    async def schedule_meeting(self, context: RunContext, datetime: str) -> dict[str, Any]:
        """Agenda la reunión en cuanto el usuario dice día y hora: ilumina ese horario en el calendario,
        lo cierra y la agenda. datetime: ISO-8601 con zona de Colombia, ej. "2026-11-07T12:00:00-05:00"."""
        logger.info("schedule_meeting %s", datetime)
        try:
            result = await self._call_browser(RPC_CALENDAR_PICK, {"datetime": datetime})
            if not isinstance(result, dict):
                result = {"ok": False, "raw": result}
            return {
                **result,
                "instruction": (
                    "Di SOLO: 'Listo, tu reunión quedó agendada.' y nada más (en pantalla corre la animación final)."
                    if result.get("ok")
                    else "No se agendó: dilo en una frase y ofrece otro horario. No digas que quedó agendada."
                ),
            }
        except Exception as err:  # noqa: BLE001
            logger.exception("schedule_meeting failed")
            return {"ok": False, "error": str(err)}

    @function_tool()
    async def consult_brain(self, context: RunContext, request: str) -> dict[str, str]:
        """Pide al cerebro comercial (ADK) resumen, plan, comunidad, reunión o email.
        Trabaja en segundo plano; el resultado llega después. Di que estás revisando."""

        logger.info("consult_brain request=%s", request[:300])

        async def _run() -> None:
            try:
                result = await self._call_browser(RPC_BRAIN_ASK, {"request": request})
                error = result.get("error") if isinstance(result, dict) else None
                if error:  # the ADK run failed in the browser (e.g. expired Google credentials)
                    self._on_brain_result(False, None, str(error))
                else:
                    self._on_brain_result(True, result, None)
            except Exception as err:  # noqa: BLE001
                logger.exception("consult_brain failed")
                self._on_brain_result(False, None, str(err))

        asyncio.create_task(_run())
        return {
            "status": "working",
            "instruction": (
                "Di SOLO 'Dame un momento.' (o similar, máximo 4 palabras). No adelantes nada del resultado "
                "(ni el plan, ni productos, ni preguntas): cuando llegue te pediré decirlo una sola vez."
            ),
        }
