# 02 · Diseño de herramientas

Las herramientas son la interfaz del agente con el mundo. Anthropic las trata como un contrato entre código determinista
y un modelo no determinista: diséñalas para el modelo, no como envoltorios delgados de una API.

## Reglas

### 1. Una herramienta por tarea, no por llamada a una API
Anthropic: construye pocas herramientas bien pensadas para los flujos de mayor impacto; consolida los pasos que siempre van juntos.
Su ejemplo: `schedule_event` en lugar de `list_users` + `list_events` + `create_event`.

> En este repo: `analyze_meet_transcript` busca la última transcripción de Meet **y** la analiza
> (antes eran `list_meet_transcripts` + `analyze_meet_transcript`). `assess_context` guarda todos los datos del turno
> **y** revisa si el contexto está listo (antes `save_meeting_fact` × N + `assess_context`).

Únelas cuando: el modelo siempre llama A y luego B, o el único propósito de A es producir la entrada de B.
Déjalas separadas cuando: son intenciones distintas del usuario, o una tiene efectos secundarios que la otra no (correo vs. reunión).

### 2. Nombres claros y consistentes
`verbo_objeto`, sin ambigüedad, consistentes (`build_strategy_plan`, `build_product_plan`). Herramientas parecidas necesitan
nombres que hagan obvia la diferencia. ADK usa el nombre de la función/herramienta tal cual, así que *es* la API.

### 3. Las descripciones son prompts
Escribe la descripción como si le explicaras a un colega nuevo: cuándo usarla, cuándo no, qué pasarle
y ejemplos. Anthropic encontró que pequeños cambios en la descripción dan grandes mejoras de precisión.
ADK: la `description` (TS) / docstring (Python) de la herramienta es lo que ve el modelo. Hazla específica.

### 4. Pocos parámetros, tipados y sin ambigüedad
- ADK: mantén los parámetros al mínimo; evita valores por defecto que el modelo no ve; en ADK TS 2.x `parameters` es un **objeto Zod**.
- Usa enums para conjuntos cerrados (`focus: projects | people | all`).
- Nombra los parámetros para el modelo (`user_email`, no `user`). Agrega `.describe()` a cada uno.
- Deja que la herramienta lea de `session.state` lo que pueda, en vez de pedírselo al modelo.

### 5. Devuelve contexto útil, más el siguiente paso
- ADK: devuelve un objeto con un campo **`status`** (`ok`, `not_configured`, `failed`, …) para que el modelo pueda decidir.
- Anthropic: devuelve campos de alta señal (nombres, no IDs opacos) y respuestas pequeñas. Pagina o recorta las salidas grandes.
- **Dile al modelo qué hacer después** (`instructionForModel`, `next`). Esto saca el flujo del prompt y lo lleva al código,
  donde se puede probar.

### 6. Errores que enseñan
Un error debe decir qué salió mal y cómo recuperarse ("needs_email: pide el correo en el campo de la pantalla"),
no volcar un stack trace.

### 7. Protege los efectos secundarios en código
Nunca confíes en un argumento del modelo para la seguridad. Ejemplo: `send_plan_email` revisa `plan_confirmed` en el estado,
que solo pueden poner `confirm_plan` o el `approvalFromHistory` del servidor.

### 8. Evalúa y luego itera
El ciclo de Anthropic: prototipo → escribir tareas de evaluación realistas → ejecutarlas → leer las transcripciones → arreglar las herramientas
(Claude puede ayudar a reescribir descripciones a partir de transcripciones fallidas). Nuestra versión barata: `npm run test:tools`
más los flujos guionizados de `demo.ts`. Usa `adk web` para inspeccionar llamadas reales a herramientas.

## Checklist para una herramienta nueva

- [ ] ¿Es una tarea a nivel de usuario, o podría unirse a una herramienta existente?
- [ ] El nombre es `verbo_objeto` y se distingue de sus hermanas
- [ ] La descripción dice cuándo usarla / no usarla, con un ejemplo
- [ ] ≤ ~6 parámetros, enums donde se pueda, cada uno con `.describe()`
- [ ] Lee el estado en vez de pedirle al modelo cosas que ya sabemos
- [ ] Devuelve `status` + solo los campos que el modelo necesita + `instructionForModel` cuando hay siguiente paso
- [ ] Efectos secundarios protegidos en código
- [ ] Si la web la renderiza, el nombre está registrado en `apps/web` (`Stage.tsx`, `act.ts`, `CommunityCards.tsx`)
- [ ] Cubierta en `test-tools.ts` o `demo.ts`
