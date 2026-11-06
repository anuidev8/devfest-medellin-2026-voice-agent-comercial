# 04 · Agente NoShy Concierge

Código: `packages/agent/src/agent.ts` (agente), `instruction.ts` (instrucción de sistema, formato en [03](./03-prompt-design.md)), `tools.ts` (herramientas), `server.ts` (puente AG-UI).

## Forma

Un `LlmAgent` (`noshy_concierge`) con 10 herramientas. Sin subagentes. El analista de transcripciones es una
llamada al modelo aparte dentro de una herramienta (agente-como-herramienta). La voz (LiveKit, `packages/livekit`) habla con este agente
a través del navegador; nunca llama herramientas directamente.

## Herramientas

| Herramienta | Paso | ¿La UI la renderiza? | Notas |
|---|---|---|---|
| `analyze_meet_transcript` | Contexto | — | Texto pegado, o busca por sí misma la última transcripción de Meet |
| `assess_context` | Contexto | oculta | Guarda todos los datos del turno + devuelve `next` (`summary` / `ask_missing` / `discovery`) |
| `show_discovery_guide` | Discovery | ✅ tablero de discovery | Solo cuando `assess_context` dice `next=discovery` |
| `summarize_context` | Resumen | ✅ tarjeta de resumen | Devuelve el siguiente paso (ofrecer comunidad → preguntar qué plan) |
| `match_community` | En cualquier momento | ✅ tablero de comunidad | Proyectos / personas / todo |
| `build_strategy_plan` | Plan | ✅ aprobación A2UI | Trae el apoyo de la comunidad por sí misma (`supportIds`) |
| `build_product_plan` | Plan | ✅ aprobación A2UI | Llama antes a `match_community(focus=people, skills)` para el equipo |
| `confirm_plan` | Aprobar | oculta | Solo para aprobación hablada; la aprobación con botón la detecta el servidor |
| `send_plan_email` | Cierre | ✅ final | Se niega salvo que `plan_confirmed` sea true en el estado |
| `book_meeting` | Cierre | ✅ final | Google Calendar + Meet; mock solo cuando `MOCK_DELIVERY` ≠ 0 |

## Flujo

```
analyze_meet_transcript ─┐
                         ▼
assess_context(facts) ──next──► show_discovery_guide ─► (una pregunta por turno) ─► assess_context …
        │ next=summary
        ▼
summarize_context ─► "¿Lo entendí bien?" ─► ofrecer match_community ─► "¿reunión, producto o ambos?"
        ▼ (sí explícito)
build_strategy_plan / build_product_plan ─► aprobación (botón A2UI → servidor, o voz → confirm_plan)
        ▼
send_plan_email  |  book_meeting
```

## Qué cambió (refactor de nov. 2026) y por qué

| Antes | Después | Por qué |
|---|---|---|
| `list_meet_transcripts` + `analyze_meet_transcript` | `analyze_meet_transcript` | Siempre se llamaban juntas. Ahorra un turno del modelo (latencia en voz). |
| `save_meeting_fact` (una vez por dato) + `assess_context` | `assess_context({ facts[] })` | Varios datos por llamada más la revisión de si está listo, en un solo viaje |
| Prompt de ~100 líneas con coreografía de 7 pasos, repetida para voz | Flujo más corto por paso; las herramientas devuelven `instructionForModel` (prompt de ~95 líneas con 3 ejemplos) | El flujo vive en código probado; el prompt guarda persona + reglas |
| Prompt dentro de `agent.ts`, secciones mezcladas, bloque de estado arriba | `instruction.ts`: Persona → Reglas (en orden, una herramienta por frase, bucle marcado) → Límites → Formato de respuesta → Ejemplos (3, misma forma) → estado de sesión al final | Guía de Google ADK + Gemini 3 + Live API; prefijo estable para el caché |
| El prompt explicaba A2UI / ACTIVITY_SNAPSHOT | "La app muestra la tarjeta" | El modelo no necesita los internos de la UI |

**Mantenido a propósito:** `build_strategy_plan` y `build_product_plan` no se unieron en un solo `build_plan`,
porque la web (`Stage.tsx`, `FinaleJourney.tsx`, `act.ts`, `CommunityCards.tsx`), `server.ts`
y `packages/livekit/agent.py` renderizan y enrutan por esos nombres. Unirlas es posible, pero implica
cambiar todo eso en el mismo PR.

## Siguientes pasos (solo si se mide la necesidad)

- **Planes flojos** → que `build_*_plan` llame a un modelo más potente con todo el contexto (agente-como-herramienta), opcionalmente con un paso crítico.
- **Investigar al cliente antes de una reunión** → herramienta `research_client` que haga búsquedas web/noticias en paralelo en segundo plano.
- **Evals** → grabar sesiones reales en `adk web`, convertir los fallos en casos de `test-tools.ts` y reescribir las descripciones de las herramientas a partir de esas transcripciones.
