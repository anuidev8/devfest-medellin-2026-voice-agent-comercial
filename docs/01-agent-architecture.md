# 01 · Arquitectura del agente

## La escalera: sube solo cuando el escalón de abajo no alcanza

El consejo central de Anthropic ("Building effective agents"): usa la configuración más simple que funcione y agrega
complejidad solo cuando mejore claramente los resultados. Cada escalón cuesta latencia, tokens y facilidad de depuración.

| Escalón | Qué es | Úsalo cuando |
|---|---|---|
| 1. Una sola llamada al LLM | Prompt + recuperación/contexto | Tareas de una vez: clasificar, extraer, resumir |
| 2. Workflow | Pasos que orquestas **en código** (cadena, enrutamiento, llamadas en paralelo) | Los pasos se conocen de antemano |
| 3. Un solo agente | El modelo elige herramientas en un bucle | Conversación abierta; el siguiente paso depende del usuario |
| 4. Multi-agente | Varios agentes cooperan | Solo cuando 1–3 claramente no pueden |

Anthropic separa los **workflows** (caminos de código predefinidos) de los **agentes** (el modelo dirige su propio
proceso). La mayoría de sistemas en producción son una mezcla: un agente para la conversación y workflows dentro de sus herramientas.

## Patrones de workflow (Anthropic) ↔ bloques de ADK

| Patrón | Idea | ADK |
|---|---|---|
| Prompt chaining | A → B → C, cada paso una llamada | `SequentialAgent`, o código dentro de una herramienta |
| Routing | Clasificar y enviar a un especialista | `LlmAgent` con `subAgents` (transfer), o código |
| Parallelization | Llamadas independientes a la vez, unir resultados | `ParallelAgent`, o `Promise.all` dentro de una herramienta |
| Orchestrator–workers | Un líder divide la tarea dinámicamente, los workers la ejecutan | `LlmAgent` + workers como `AgentTool` |
| Evaluator–optimizer | Generar, criticar, revisar | `LoopAgent` (generador + crítico), o código |

## Subagentes vs. multi-agente

- **Subagente** = un agente le pasa una subtarea a otro y recibe un *resultado*. En ADK eso es
  `AgentTool` (agente como herramienta): el padre mantiene el control.
- **Multi-agente** = el término general para cualquier sistema con varios agentes: orquestador–workers,
  enrutamiento/handoff (`subAgents` + `transfer_to_agent`: la *conversación* pasa a otro agente),
  pipelines, generador–crítico.

### Usa subagentes / multi-agente cuando

1. **Trabajo paralelo e independiente.** Investigar 10 empresas a la vez. Aquí brilla el sistema de investigación de Anthropic.
2. **Aislar el contexto.** Una subtarea debe leer mucho (una transcripción de 200k caracteres, páginas web) pero solo importa un resumen.
3. **Una configuración distinta.** Otro prompt, otro modelo (barato vs. potente) u otro set de herramientas.
4. **Permisos / seguridad.** Solo un agente puede enviar correos o tocar producción.
5. **Dominios realmente separados.** Facturación vs. soporte técnico detrás de una misma puerta, que casi no comparten estado.

### No los uses cuando

- Los pasos son **secuenciales** y comparten el mismo estado (discovery → resumen → plan → aprobación).
- **La latencia importa** (voz). Cada traspaso es otro turno del modelo.
- La motivación es "demasiadas herramientas". Primero consolida las herramientas (ver [02](./02-tool-design.md)).
- El costo importa. Anthropic reporta que los agentes usan unas 4× los tokens de un chat, y los sistemas multi-agente unas 15×.

**Prueba rápida:** ¿podría un contratista hacer esta subtarea con un brief de un párrafo y devolver un resultado corto,
sin toda la conversación? Sí → buen subagente. No → déjala en el agente principal.

## En ADK específicamente

- Prefiere **`AgentTool`** sobre el transfer de `subAgents` para los ayudantes. El transfer entrega la conversación;
  para un front-end de voz casi nunca es lo que quieres.
- Usa **workflow agents** (`SequentialAgent`, `ParallelAgent`, `LoopAgent`) para pipelines fijos y no conversacionales,
  y pasa datos entre pasos con `session.state` (`outputKey`).
- Pon los **controles deterministas en callbacks o en el servidor**, no en el prompt (p. ej. `beforeAgentCallback`
  para valores por defecto, nuestro `approvalFromHistory` para la aprobación del plan).

## Nuestra decisión

**Un agente de voz rápido; agentes extra solo detrás de herramientas.**

```
Agente de voz (un solo LlmAgent, modelo rápido)   ← lo único con lo que habla el usuario
 ├─ analyze_meet_transcript → llamada al modelo analista (meeting-analyst.ts)   ✅ hoy
 ├─ research_client         → workers de investigación en paralelo           ⏳ si hace falta
 └─ build_plan(s)           → modelo más potente / paso crítico               ⏳ si los planes salen flojos
```

Agrega los ítems ⏳ solo cuando un problema medido los justifique (planes flojos, falta investigar al cliente).
