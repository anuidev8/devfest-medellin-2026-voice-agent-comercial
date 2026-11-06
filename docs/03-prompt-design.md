# 03 · Diseño del prompt (`instruction` de ADK + estado)

Nuestra instrucción vive en `packages/agent/src/instruction.ts` y se pasa como `LlmAgent.instruction`.
Esta página explica el formato y de dónde sale cada regla.

## Qué dicen las docs

### Google ADK: LLM agents ([llm-agents](https://google.github.io/adk-docs/agents/llm-agents/), "Guide the agent with instructions")
ADK llama a `instruction` "posiblemente el parámetro más crítico". No impone nombres de etiquetas; dice que la
instrucción debe decirle al agente estas **cinco cosas**:

1. **Tarea u objetivo principal.**
2. **Persona / personalidad** ("Eres un asistente útil…").
3. **Restricciones** ("Responde solo preguntas sobre X", "Nunca reveles Y").
4. **Cómo y cuándo usar sus herramientas.** Explica el propósito de cada herramienta y en qué circunstancias llamarla,
   *complementando* la descripción propia de la herramienta.
5. **Formato de salida deseado** ("Responde en JSON", "Da una lista con viñetas").

El ejemplo de las docs de ADK (`capital_agent`) es prosa simple: una línea de rol, un procedimiento numerado "Cuando un usuario pregunta…"
que nombra la herramienta, y luego `Example Query:` / `Example Response:`. Los agentes de ejemplo de Google para ADK
([adk-recipes](https://github.com/google/adk-recipes)) siguen el mismo estilo: rol → pasos numerados que nombran herramientas →
lista de salida "Tu revisión DEBE incluir:". Cuando agregas una herramienta, las recipes dicen que también actualices la instrucción
para que el LLM sepa cuándo elegirla sobre las demás.

Consejos:
- **Sé claro y específico.** Di las acciones y resultados que quieres; evita la ambigüedad.
- **Usa Markdown** (títulos, listas) para instrucciones complejas.
- **Da ejemplos (few-shot)** para tareas complejas o formatos de salida específicos.
- **Guía el uso de herramientas.** No solo las listes; explica *cuándo* y *por qué* usar cada una.
- **Plantillas de estado:** `{var}` inserta `session.state.var`; `{artifact.var}` inserta el texto de un artifact.
  Una variable que falta **lanza un error**; `{var?}` la hace opcional (cadena vacía).
- `instruction` también puede ser un **`InstructionProvider`** `(ctx: ReadonlyContext) => string | Promise<string>`,
  para prompts construidos en código (también sirve para saltarse las plantillas por completo).
- `globalInstruction` aplica a todos los agentes del árbol, pero **solo en el agente raíz**.
- ADK **Python** además tiene `static_instruction`: un prefijo constante que va antes de todo para que se cachee bien
  (la recipe `long-horizon-harness` de Google lo usa y deja los datos cambiantes al final). **ADK JS 2.3 (nuestra versión) solo tiene
  `instruction` y `globalInstruction`**, así que logramos el mismo efecto poniendo `# Contexto de la sesión` al final.
- `description` es para *otros* agentes (enrutamiento/delegación). Mantenla corta y sobre capacidades.

### Prompting de Gemini 3 ([prompting-strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies))
- **Sé preciso y directo.** Evita lenguaje innecesario o demasiado persuasivo. Los trucos de prompt hechos para modelos
  anteriores pueden hacer que Gemini 3.x sobreanalice.
- **Estructura consistente.** Etiquetas estilo XML (`<context>`, `<task>`) *o* títulos Markdown: **elige uno y úsalo
  en todo el prompt.**
- **Define los términos ambiguos** de forma explícita.
- **Prioriza las instrucciones críticas.** Persona, restricciones de comportamiento y formato de salida van en la instrucción de sistema.
- **Verbosidad:** Gemini 3 es conciso por defecto. Pide explícitamente un tono conversacional si lo quieres.
- **Contexto largo:** primero los datos, la pregunta o instrucciones al final ("Con base en la información anterior…").

### Gemini Live API, para voz ([live-api/best-practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices))
Define la instrucción de sistema **en este orden**:
1. **Persona:** nombre, rol, características. Si defines un acento, define también el idioma de salida.
2. **Reglas de conversación, en el orden en que el modelo debe seguirlas.** Separa los elementos **de una sola vez**
   (pedir datos una vez) de los **bucles conversacionales** (temas que el usuario puede retomar las veces que quiera).
3. **Llamadas a herramientas dentro del flujo, en frases separadas.** P. ej. "Primero, pide X. Luego invoca `get_user_info` con esos datos."
4. **Guardrails:** qué no hacer, con ejemplos "si pasa X, haz Y". Si aún falta precisión,
   Google sugiere la palabra *unmistakably* (inequívocamente).

Además: una instrucción de sistema por agente; define el idioma de respuesta explícitamente si no debe cambiar.

### Anthropic: context engineering ([artículo](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
- El conjunto más pequeño de **tokens de alta señal** que produce el comportamiento.
- **La altura correcta:** ni if/else rígidos y frágiles ni guías vagas.
- Unos pocos ejemplos canónicos valen más que una lista larga de casos borde.
- Empieza mínimo; agrega una instrucción solo después de ver un fallo sin ella.

## Nuestro formato

Solo títulos Markdown (un único estilo de delimitador). Secciones en este orden:

```markdown
# Persona                      ← nombre, rol, tono, idioma, los tipos de usuario que atiende
# Reglas de conversación       ← "sigue instructionForModel" + pasos numerados en orden
## 1. Presentación (una sola vez)        ← elemento de una sola vez
## 2…7. Contexto → Discovery → Resumen → Plan → Aprobación → Cierre
##    una llamada a herramienta por frase: "Cuando X, llama a tool_y con Z."
## En cualquier momento: la comunidad    ← bucle conversacional, marcado como tal
# Límites                      ← guardrails (nunca inventar, honestidad en las entregas, …)
# Formato de respuesta         ← formato de salida: voz = texto plano, 2–3 frases, ≤ 1 pregunta
# Ejemplos                     ← 3 intercambios few-shot, misma forma Usuario / Acción / Tú
# Contexto de la sesión        ← placeholders {state?}, AL FINAL
```

Por qué el **contexto de la sesión va al final**:
- La parte fija (persona → ejemplos) es idéntica en cada turno, así que forma un **prefijo estable**, que es
  lo que reutiliza el caché implícito de contexto de Gemini. Poner valores cambiantes arriba cambiaría el prefijo en cada turno.
- Es el "datos, luego instrucciones" de Gemini al revés para un prompt corto: las reglas se leen
  primero y los datos vivos quedan junto a la conversación a la que aplican.

## Etiquetas, estructura y ejemplos (plantillas de referencia)

Ninguna doc oficial exige nombres de etiquetas específicos. Lo que piden es **secciones claras, un solo estilo de delimitador y consistencia.**
Estas son las etiquetas que usan las docs de Gemini (no ADK) ([prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies),
ahora servida desde `aistudio.google.com/docs/prompting-strategies`). Las plantillas se citan tal cual, en inglés.

**Google: versión Markdown**
```markdown
# Identity
You are a senior solution architect.

# Constraints
- No external libraries allowed.
- Python 3.11+ syntax only.

# Output format
Return a single code block.
```

**Google: versión XML** (la "plantilla que combina buenas prácticas" de Gemini 3, parte de instrucción de sistema)
```xml
<role>
You are a specialized assistant for [domain]. You are precise, analytical, and persistent.
</role>

<instructions>
1. **Plan**: Analyze the task and create a step-by-step plan.
2. **Execute**: Carry out the plan.
3. **Validate**: Review your output against the user's task.
4. **Format**: Present the final answer in the requested structure.
</instructions>

<constraints>
- Verbosity: [Low/Medium/High]
- Tone: [Formal/Casual/Technical]
</constraints>

<output_format>
Structure your response as follows: …
</output_format>
```
Los datos que el modelo debe tratar como *datos, no instrucciones* van en `<context>`, y la petición en `<task>` (turno del usuario).

**Anthropic** ([prompt engineering: XML tags, examples, system prompts](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview)):
tampoco hay nombres mágicos de etiquetas; usa etiquetas descriptivas de forma consistente y anídalas cuando el contenido sea jerárquico. Envuelve
los ejemplos en etiquetas `<example>` (3–5 variados funcionan mejor). Di qué *hacer* en lugar de solo qué no hacer, y da la
razón detrás de cada regla; los modelos generalizan mejor a partir del porqué.

### Cómo se corresponden las etiquetas

| Componente ADK | Gemini Markdown | Gemini XML | Orden Live API | **Nuestro** (`instruction.ts`) |
|---|---|---|---|---|
| 1 Tarea + 2 Persona | `# Identity` | `<role>` | 1. Persona | `# Persona` |
| 4 Herramientas: cuándo y por qué | (instrucciones) | `<instructions>` | 2. Reglas de conversación + 3. herramientas en el flujo | `# Reglas de conversación` (`## 1…7` + bucle) |
| 3 Restricciones | `# Constraints` | `<constraints>` | 4. Guardrails | `# Límites` |
| 5 Formato de salida | `# Output format` | `<output_format>` | — | `# Formato de respuesta` |
| Consejo: few-shot | — | `<example>` (Anthropic) | si X → haz Y | `# Ejemplos` |
| Consejo: estado `{var?}` | — | `<context>` | — | `# Contexto de la sesión` |

Los cinco componentes de ADK están cubiertos, cada uno en su propia sección con etiqueta.

Elegimos **Markdown** sobre XML porque los consejos de ADK dicen "usa Markdown", y ambos son válidos para Gemini.
La única regla es no mezclarlos. Si algún día pasamos a XML, convierte *todas* las secciones; no envuelvas solo algunas.

### Reglas para few-shot (Google)
- **Incluye siempre ejemplos.** Ejemplos claros pueden incluso reemplazar instrucciones.
- **La misma estructura en todos los ejemplos** (etiquetas, espacios, saltos de línea). La nuestra: `Usuario:` / `Acción:` / `Tú:`.
- **No demasiados,** o el modelo se sobreajusta a ellos. Cubre comportamientos distintos (tenemos: resumen, bucle de comunidad, entrega fallida).
- Los prefijos con etiqueta (`Order:` / `Output:` en la doc de Google) guían la forma de la respuesta.

### No adoptado
La **plantilla de instrucción agéntica** de Google ("You are a very strong reasoner and planner…", 9 reglas de planificación) puntúa
bien en benchmarks agénticos, pero le pide al modelo razonar antes de cada acción. Eso agrega latencia, lo cual es malo para
un turno de voz. Considérala para un agente-como-herramienta offline (p. ej. un futuro planificador), no para el front-end de voz.

## Reglas prácticas

| Haz | No hagas |
|---|---|
| "Cuando haya objetivo y dolor claros, llama a summarize_context." | "Herramientas: summarize_context, match_community, …" (una lista sin más) |
| Una llamada a herramienta por frase, en el orden del flujo | Varias llamadas encadenadas con flechas en una línea |
| Marca los bucles: "Esto es un bucle: puede pedirlo las veces que quiera" | Dejar que el modelo adivine si un paso se puede repetir |
| "Nunca inventes precios." | "¡¡NUNCA JAMÁS inventes precios!!" (demasiado forzado; Gemini 3 no lo necesita) |
| `{deal_summary?}` | `{deal_summary}` (lanza error si falta la clave) o `{ }` literales en el texto (se leen como variable) |
| Deja el *siguiente paso* del flujo en el resultado de la herramienta (`instructionForModel`) | Reexplicar todo el flujo por herramienta en el prompt |
| Explica los efectos de la UI en términos del usuario ("la app muestra la tarjeta") | Explicar internos de la UI (A2UI, ACTIVITY_SNAPSHOT) |

## Qué va dónde

| Ponlo en… | Ejemplos de este repo |
|---|---|
| **Instrucción** | Persona, idioma, brevedad, orden del flujo, reglas de no inventar, honestidad en las entregas |
| **Descripción de la herramienta** | Cuándo llamarla, qué significa cada parámetro, ejemplos |
| **Resultado de la herramienta** (`instructionForModel`) | El siguiente paso ("contexto completo → summarize_context") |
| **Código / callbacks / servidor** | Valores por defecto del estado (`beforeAgentCallback`), detección de aprobación (`approval.ts`), bloqueo de envíos |

## Consejos de estado (ADK)

- Inicializa cada clave usada en la plantilla (lo hacemos en `ensurePreContextDefaults`), y aun así usa `{key?}`.
- Prefijos: ninguno = sesión · `user:` = entre las sesiones del usuario · `app:` = global · `temp:` = solo esta invocación.
- Usa `outputKey` para pasar la respuesta de un agente al siguiente en los workflow agents.

## Nota sobre el worker de voz

`packages/livekit/agent.py` tiene su **propio** prompt para la capa de voz de Gemini Live. El orden de la Live API de arriba
(persona → reglas → guardrails) también aplica ahí. Es una instrucción de sistema separada, como recomienda Google.
