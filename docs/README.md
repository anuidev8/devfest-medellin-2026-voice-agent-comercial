# Documentación

## Guías de instalación y operación (empieza aquí)

| Guía | Qué cubre |
|---|---|
| [00 · Quickstart](./guides/00-quickstart.md) | Instalar herramientas, `npm run setup`, llenar las llaves, **`npm run dev`** levanta todo |
| **Google ADK** | `guides/google-adk/` |
| [01 · Google ADK](./guides/google-adk/01-google-adk.md) | Llaves de Gemini (Vertex AI o AI Studio), sesiones de Agent Engine, OAuth de Meet/Calendar, `adk web` |
| [07 · Agent Studio](./guides/google-adk/07-agent-studio.md) | ADK web, Agent Studio (prompt para replicar `packages/agent`) y sesiones de chat en la consola |
| **LiveKit** | `guides/livekit/` |
| [02 · LiveKit](./guides/livekit/02-livekit.md) | Llaves de LiveKit Cloud, ElevenLabs, correr el worker de voz, desplegar con `lk agent create` |
| [06 · Agent Builder](./guides/livekit/06-livekit-cloud-builder.md) | Instrucciones, bienvenida, modelo y client tools para pegar en el Agent Builder de LiveKit Cloud |
| **CopilotKit** | `guides/copilotkit/` |
| [03 · CopilotKit](./guides/copilotkit/03-copilotkit.md) | Cómo el frontend se conecta a ADK, tarjetas de Generative UI, A2UI, agregar una tarjeta |
| [A2UI Composer · proposal prompt](./guides/copilotkit/a2ui-composer-proposal-prompt.txt) | Prompt para regenerar la tarjeta de propuesta (botón azul) en a2ui-composer.ag-ui.com |
| **Deploy** | `guides/deploy/` |
| [04 · Desplegar en la nube](./guides/deploy/04-deploy-cloud.md) | Cloud Run (agente) → LiveKit Cloud (voz) → Vercel (web), referencia de variables de entorno |
| **Debugging** | `guides/debugging/` |
| [05 · Depuración](./guides/debugging/05-debugging.md) | Logs, UI de desarrollo de ADK, stream AG-UI en crudo, breakpoints, tablas síntoma → solución |

Escenarios de prueba del chat: [`COPILOTKIT-CHAT-TEST-GUIDELINES.txt`](./COPILOTKIT-CHAT-TEST-GUIDELINES.txt)

---

# Docs de diseño del agente

Cómo estructuramos el agente NoShy Concierge (Google ADK, TypeScript) y por qué. Estas docs resumen
la guía publicada por **Anthropic** y **Google ADK** en reglas que aplicamos en este repo.

| Doc | Léelo cuando… |
|---|---|
| [01 · Arquitectura del agente](./01-agent-architecture.md) | Elijas entre un workflow, un agente, subagentes o multi-agente |
| [02 · Diseño de herramientas](./02-tool-design.md) | Agregues o cambies una herramienta (tool) |
| [03 · Diseño del prompt](./03-prompt-design.md) | Edites la instrucción del agente (`instruction.ts`) o el estado de sesión |
| [04 · Agente NoShy](./04-noshy-agent.md) | Quieras entender el agente actual, sus herramientas y su flujo |

## La versión corta

1. **Empieza simple.** Un agente con buenas herramientas le gana a varios agentes. Agrega complejidad solo cuando puedas medir que ayuda.
2. **Menos herramientas, mejores.** Una herramienta por *tarea del usuario*, no una por llamada a una API. El resultado de la herramienta dice qué hacer después.
3. **El flujo en código, el criterio en el modelo.** Las reglas deterministas (aprobación, bloqueos, estado) viven en código. El prompt guarda la persona, las reglas y las decisiones que requieren criterio.
4. **Agentes detrás de herramientas.** Cuando una subtarea necesita su propia llamada al modelo (análisis de transcripción, investigación), envuélvela como herramienta. El usuario siempre habla con un solo agente.

## Fuentes

Anthropic
- [Building effective agents](https://www.anthropic.com/research/building-effective-agents)
- [Writing effective tools for agents — with agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Docs de tool use](https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview)

Google ADK
- [Agents overview](https://google.github.io/adk-docs/agents/) · [LLM agents](https://google.github.io/adk-docs/agents/llm-agents/)
- [Multi-agent systems](https://google.github.io/adk-docs/agents/multi-agents/) · [Workflow agents](https://google.github.io/adk-docs/agents/workflow-agents/)
- [Function tools](https://google.github.io/adk-docs/tools/function-tools/) (incluye `AgentTool`)
- [Session state](https://google.github.io/adk-docs/sessions/state/) · [Callbacks](https://google.github.io/adk-docs/callbacks/)

Google Gemini (prompting)
- [Prompt design strategies (Gemini 3)](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- [Live API best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices) (instrucciones de sistema para voz)
