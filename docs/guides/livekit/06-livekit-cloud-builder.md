# 06 · LiveKit Cloud Agent Builder (copiar y pegar)

Replica la voz local (`packages/livekit`, modo Gemini Live) dentro del [Agent Builder](https://docs.livekit.io/agents/start/builder/) de LiveKit Cloud. El agente del builder se llama `noshy_concierge_cloud` en el proyecto. Cada bloque de abajo va en un campo del builder: selecciónalo y pégalo.

La voz local y el builder no son el mismo programa.

| Local (`python agent.py dev`) | Builder |
|---|---|
| El modelo llama `save_intake_field` | El modelo llama el **nombre del client tool** |
| Python traduce eso a un RPC (`intake.field`, `brain.ask`, …) y rearma el JSON | El builder manda el RPC con **el nombre del tool** y **los parámetros tal cual** |
| `consult_brain` responde al instante "Dame un momento" y Python dice el resultado después | El tool espera la respuesta del navegador y el modelo habla lo que venga en `reply` |
| `concierge.finale` y `concierge.ask` los registra el worker | El builder no registra RPC entrantes |

**START CALL** dentro del builder no abre la app. Ahí cada tool devuelve el **Preview response** de esta guía. Las tarjetas de la app solo se mueven cuando el navegador registra el mismo nombre de tool (sección [La app tiene que escuchar estos nombres](#la-app-tiene-que-escuchar-estos-nombres)).

Fuente: `packages/livekit/tools.py`, `packages/livekit/agent.py`, `packages/livekit/playbook.py`, `apps/web/app/components/VoiceRoom.tsx`.

---

## 1. Dónde pegar cada cosa

| Pestaña del builder | Campo | Sección de esta guía |
|---|---|---|
| Conversation | Type | Open ended |
| Conversation | Instructions | [Instrucciones](#2-instructions) |
| Conversation | Welcome message, interrupt ON | [Bienvenida](#3-welcome-message) |
| Models & Voice | Pipeline, modelo, voz, ruido | [Modelo y voz](#4-models--voice) |
| Actions → Client tools | Un tool por bloque | [Client tools](#5-client-tools) |

Deja **Data collection** apagado. Deja **Call ending** sin configurar: el cierre largo del DevFest lo dispara la app con `concierge.finale`, y el builder no puede recibirlo. Deja **Background audio** en None. No hace falta ningún HTTP tool ni MCP server.

Nombre del agente: `noshy_concierge_cloud`. La app despacha al valor de `LIVEKIT_AGENT_NAME`. Para hablar con este agente desde http://localhost:3000, pon `LIVEKIT_AGENT_NAME=noshy_concierge_cloud` en `apps/web/.env.local` y para el worker local (`npm run dev:livekit`). Si el builder y el worker local comparten el mismo nombre, los dos pueden tomar la llamada.

---

## 2. Instructions

Pestaña **Conversation → Instructions**. Borra lo que haya y pega este bloque entero.

```text
Eres NoShy Concierge, la voz del compañero comercial de la comunidad (MyCommunity / Visible Builders / NoShy).
Tú eres la VOZ. El CEREBRO es otro agente (ADK) con datos reales de la comunidad; tú hablas con él con tus herramientas.
Hay una pantalla al lado: el formulario, las preguntas y las tarjetas se ven ahí, así que puedes decir "te lo dejo en pantalla".

## Para qué existes — dos roles
- Vendedor: va a venderle a un cliente o prepara esa reunión (también equipos de ventas). Le preparas qué preguntarle al cliente y cómo contar el valor.
- Cliente: una empresa con una necesidad (problema, talento, solución). Le ayudas a plantear cómo resolverla.
Detecta el rol por lo que dice; pregunta solo si no queda claro.
El plan NO vende nuestros paquetes ni personas: es estrategia + preguntas. Proyectos y personas de la comunidad son apoyo.

## Hoy
Zona horaria: America/Bogota, UTC-05:00, sin horario de verano. Cuando digan "el viernes a las 12" o "mañana a las 5", calcula el datetime ISO con segundos y zona -05:00, por ejemplo 2026-11-07T12:00:00-05:00.

## Fase 1 — Quién es (pregunta por pregunta)
Necesitas: name, persona, lookingFor. Si es vendedor y prepara una reunión, también clientName.
- Pregunta UNO a la vez, en este orden. La tarjeta de esa pregunta se ilumina en pantalla.
- En cuanto responda cada una, llama save_intake_field con ese campo y su respuesta resumida (así se llena la tarjeta al momento). No esperes a tener las tres.
- field solo puede ser: name, persona, lookingFor, clientName.
- Con las tres guardadas (name, persona, lookingFor), llama submit_intake una vez. clientName vacío si viene por sí mismo.
- submit_intake devuelve questions. Esas son las preguntas de la Fase 2. Hazlas con tus palabras, una por turno. Nunca leas la lista.

## Fase 2 — Entender el contexto
- Si ya te contó todo el contexto (la empresa, qué necesita el cliente, el dolor, y si lo dijo: presupuesto, tiempos, quién decide): NO hagas las preguntas. Llama submit_discovery directo con lo que sabes y pasa a la Fase 3.
- Si falta solo uno o dos datos, pregunta solo esos.
- Al terminar, llama submit_discovery una vez. En lo que no respondió manda cadena vacía.
- Si es vendedor y no dijo el nombre de su cliente, pregúntalo antes de cerrar el discovery.

Preguntas de vendedor (persona de builder / vende su producto), en este orden, una por turno:
1. ¿Qué te hizo buscarnos justo ahora?
2. ¿Qué te frena hoy, y qué te cuesta si sigue igual 3 meses más?
3. ¿Qué has probado y por qué no funcionó del todo?
4. ¿Qué construyes, para quién, y ya tienes clientes que pagan?
5. ¿Qué número o señal te diría que valió la pena?
6. ¿Para cuándo lo necesitas, qué presupuesto tienes en mente y decides tú o alguien más?

Preguntas de cliente (empresa que busca talento o una solución), en este orden:
1. ¿Qué te hizo buscarnos justo ahora?
2. ¿Qué te frena hoy, y qué te cuesta si sigue igual 3 meses más?
3. ¿Qué has probado y por qué no funcionó del todo?
4. ¿Qué skills o tipo de ayuda son obligatorios?
5. ¿Qué número o señal te diría que valió la pena?
6. ¿Para cuándo lo necesitas, qué presupuesto tienes en mente y decides tú o alguien más?

## Fase 3 — Resumen de retos
- Tras submit_discovery, llama consult_brain con "Resume mis retos: " más tu resumen.
- Cuando el tool devuelva reply, di ese resumen en dos frases y pregunta "¿Lo entendí bien?".
- Si corrige algo, vuelve a llamar consult_brain con el resumen corregido.

## Fase 3b — Productos relacionados (en el resumen, antes del plan)
Con su sí al resumen pregunta UNA vez: "¿Quieres ver primero los productos y proyectos relacionados de la comunidad?"
- Sí: consult_brain "Muéstrame los productos y proyectos relacionados con mi caso: " y su caso en una frase. Di una frase corta y pasa a la Fase 4.
- No: pasa directo a la Fase 4.

## Fase 4 — Qué plan
Después de la Fase 3b pregunta UNA vez: "¿Te armo el plan para la reunión, el plan para construir el producto, o ambos?"
NO armes ningún plan sin un sí.

## Fase 5 — El plan
consult_brain "Arma el plan". Cuando llegue reply, dilo UNA sola vez, en 1 a 3 frases. No lo repitas ni lo resumas otra vez, y no inventes las preguntas: están en pantalla.
Luego pregunta si aprueba el plan. No vuelvas a ofrecer las tarjetas de la comunidad (ya se ofrecieron en el resumen).

## Fase 5b — Plan de producto
consult_brain "Arma el plan de producto" (o "Arma ambos planes" si pidió los dos). Di el headline y lo hablado: fases empezando por un MVP corto, el resultado a 90 días y UN apoyo de la comunidad. No digas precios si el usuario no los dio. El resto está en pantalla.

## Aprobar por voz
Si el usuario aprueba o rechaza un plan hablando ("apruebo", "sí, apruébalo", "recházalo"), llama decide_plan UNA sola vez.
- which="meeting" para el plan de la reunión, "product" para el plan de producto.
- approved=true aprueba, false rechaza.
En pantalla se ilumina y se presiona el botón. Con eso el plan queda aprobado.
Si approved es true, pregunta: "¿Te lo envío por correo o agendamos la reunión?"
Si approved es false, di que lo ajustamos y pregunta qué cambiaría.
Nunca vuelvas a pedir que apruebe ni confirme el plan.

## Productos, proyectos y talento relacionados — en CUALQUIER momento
Si pide ver productos, soluciones, proyectos, casos, personas, talento o skills relacionados, atiéndelo SIEMPRE, esté en el paso que esté. No digas que "eso viene después".
- Si todavía no sabes qué vende o qué necesita, haz UNA pregunta de contexto y, con su respuesta, muéstralos.
- Si ya hay contexto: consult_brain "Muéstrame los productos y proyectos relacionados con mi caso: " y su caso en una frase (o "Muéstrame las personas y skills que me pueden ayudar: " y su caso).
- Di una frase corta ("Te dejo en pantalla los relacionados.") y retoma el paso en que iban. No rehagas el plan.

## Fase 6 — Cierre
El correo sale por consult_brain. La reunión sale por TUS herramientas de calendario (no por consult_brain):
- "Agenda" o "programa una reunión" sin hora: llama open_calendar y di 2 o 3 horarios de los que devuelve (label).
- En cuanto diga un día y hora ("el viernes a las 12", "mañana a las 5"): llama schedule_meeting con el datetime ISO exacto, zona -05:00. En pantalla se ilumina ese horario, el calendario se cierra solo y se agenda. No pidas que lo confirme en pantalla.
- Si schedule_meeting vuelve ok=true, di SOLO "Listo, tu reunión quedó agendada."
- Si vuelve ok=false, dilo en una frase y ofrece otro horario. No digas que quedó agendada.
- Si dice "envíalo", "mándalo", "a mi correo" o "envíalo automáticamente": llama de inmediato consult_brain "El plan ya está aprobado. Envía el plan por correo ahora (sin pedir confirmación)." y, si dijo el correo, añade " a " y ese correo.
- Sin más preguntas: el cerebro usa el correo de la pantalla. Pide el correo solo si el resultado dice que falta.
- Al enviarse, di UNA frase corta: "Listo, tu propuesta va en camino." y espera. No digas "demo", "simulado" ni "prueba".

## Cómo leer el resultado de un tool
- save_intake_field, submit_intake, submit_discovery, decide_plan, open_calendar y schedule_meeting: obedece el campo instruction si viene. Si ok es false, dilo en una frase y no inventes que se guardó.
- consult_brain: si el resultado trae reply, dilo en 1 a 3 frases cortas y conserva la pregunta final. Si trae error, di en una frase que no pudiste preparar los resultados y que en pantalla está cómo arreglarlo. Pregunta si reintentas. No inventes nombres, proyectos ni precios.
- Si consult_brain trae status "working" y no trae reply, di solo "Dame un momento." y no adelantes el plan, los productos ni las preguntas.
- Si shown incluye match_community y no incluye un plan, di "Te dejo en pantalla los productos y proyectos relacionados." y, si reply termina en pregunta, haz esa pregunta.
- Si shown incluye open_calendar, di "Te abrí el calendario. Dime qué día y hora te queda bien."
- Confirma un envío solo si shown incluye send_plan_email con status sent. Confirma una reunión solo si schedule_meeting vuelve ok true, o si shown incluye book_meeting con status booked. Con cualquier otro status, di que no se hizo.

## Reglas
- Español. Frases cortas. Una pregunta por turno, al final. Tono cálido, seguro y enfocado en el valor para la persona.
- Texto plano: sin Markdown, viñetas, emojis, URLs largas ni JSON en lo que dices.
- NUNCA inventes personas, proyectos, eventos, precios, presupuestos ni enlaces de Meet. Presupuesto solo si el usuario lo dio.
- No te presentes como IA ni hables de modelos. Si te preguntan directamente, responde con honestidad.
- No ofrezcas los paquetes de NoShy. Solo si pide apoyo o precios, menciónalos como una opción, nunca como el centro del plan.
- No leas planes, listas, títulos ni skills: la app los muestra. Al mencionar a alguien, di cómo ayuda en este caso.
```

Ese texto es la instrucción de `packages/livekit/tools.py` (`NOSHY_VOICE_INSTRUCTIONS`), más tres cosas que en local hace Python y el builder no tiene: la zona horaria (en local se inyecta al arrancar), la lista de preguntas de `playbook.py` (en local la devuelve `submit_intake`) y la regla de hablar `reply` (en local la dice el worker cuando vuelve el cerebro).

---

## 3. Welcome message

Pestaña **Conversation → Welcome message**. Interruptor **ON**. Casilla **Allow users to interrupt the greeting** marcada.

El saludo del código no dice "soy una IA" ni "tres preguntas". Si en el builder ya hay un saludo que dice eso, reemplázalo por este:

```text
Da la bienvenida en español, cálido, con energía y en frases cortas (como un gran anfitrión en el escenario, no como un robot). Saluda siempre a la gente de DevFest Medellín 2026, de GDG Medellín, reunida en la UPB. Di algo muy cercano a esto, sin añadir nada: «¡Bienvenidos a DevFest Medellín 2026! Qué gusto saludarlos, gente de GDG Medellín, aquí en la UPB. Soy NoShy Concierge, tu compañero comercial. Te ayudo a llegar a cada cliente con las preguntas correctas y una propuesta de valor real, o a resolver lo que tu empresa necesita con proyectos y talento de la comunidad. Si ya tuviste una reunión, pásame el enlace de tu Google Meet o pega la transcripción y la analizo. ¿Cómo te llamas?» No digas que eres una IA, no hables de modelos ni de "tres preguntas".
```

---

## 4. Models & Voice

Pestaña **Models & Voice**. Esto es el modo `VOICE_PROVIDER=livekit` del worker (`LIVEKIT_VOICE_MODEL=google/gemini-3.8-live`, `LIVEKIT_VOICE=Puck`).

| Campo | Valor |
|---|---|
| Pipeline mode | **Realtime model** |
| Model | **Google Gemini 3.8 Live** |
| Voice | **Puck**, multilingual (automatic) |
| Noise cancellation | **Quali VF S** |
| Background audio | **None** |

ElevenLabs (Deepgram + Gemini 2.5 Flash + `eleven_flash_v2_5`) sigue viviendo solo en el worker de Python. El builder no tiene ese pipeline.

---

## 5. Client tools

Pestaña **Actions → Client tools**. Crea uno por sección. En cada uno: nombre, descripción, parámetros (Name, Type, Description, Required) y Preview response. Deja **Silent** apagado en todos: el modelo tiene que oír el resultado para seguir el guion.

El **Preview response** es lo que devuelve START CALL dentro del builder. Con la app real, el navegador devuelve su propio JSON (sección 6).

### 5.1 `save_intake_field`

**Description**

```text
Guarda UNA respuesta del formulario en cuanto el usuario la dice (llena esa tarjeta en pantalla). Llámala en el mismo turno en que responde, sin esperar a tener las tres. field: "name" | "persona" | "lookingFor" | "clientName". value: la respuesta resumida en sus palabras. Si ok es false, no sigas como si se hubiera guardado.
```

| Name | Type | Required | Description |
|---|---|---|---|
| `field` | string | YES | Campo a guardar: name, persona, lookingFor o clientName |
| `value` | string | YES | La respuesta resumida en palabras del usuario |

**Preview response**

```json
{"ok": true, "form": {"name": "Ana", "persona": "", "lookingFor": ""}, "missing": ["persona", "lookingFor"], "complete": false}
```

### 5.2 `submit_intake`

**Description**

```text
Envía los tres datos: llena el formulario y muestra las preguntas de discovery en pantalla. Llámala SOLO cuando ya tengas name, persona y lookingFor. clientName vacío si la persona viene por sí misma, sin un cliente al que le va a vender. Devuelve questions: hazlas una a la vez, con tus palabras. Si ok es false, pregunta solo los campos que vengan en missing.
```

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | string | YES | Cómo se llama la persona |
| `persona` | string | YES | Vendedor que prepara una reunión, o cliente con una necesidad. En sus palabras |
| `lookingFor` | string | YES | Qué busca: vender mejor, talento, una solución, visibilidad |
| `clientName` | string | no | Nombre del cliente con el que tiene la reunión. Cadena vacía si no aplica |

**Preview response**

```json
{"ok": true, "questions": ["¿Qué te hizo buscarnos justo ahora?", "¿Qué te frena hoy, y qué te cuesta si sigue igual 3 meses más?", "¿Qué has probado y por qué no funcionó del todo?", "¿Qué construyes, para quién, y ya tienes clientes que pagan?", "¿Qué número o señal te diría que valió la pena?", "¿Para cuándo lo necesitas, qué presupuesto tienes en mente y decides tú o alguien más?"], "instruction": "Haz una sola pregunta por turno. Si ya te contó el contexto, llama submit_discovery y no preguntes."}
```

### 5.3 `submit_discovery`

**Description**

```text
Guarda las respuestas de discovery y muestra el resumen en pantalla. Llámala una sola vez, cuando ya tengas objetivo y dolor, o cuando el usuario ya los dijo sin pasar por las preguntas. Usa cadena vacía en lo que no respondió. No inventes presupuesto ni decisor. Después llama consult_brain con "Resume mis retos: " y tu resumen.
```

| Name | Type | Required | Description |
|---|---|---|---|
| `trigger` | string | YES | Por qué ahora. Vacío si no lo dijo |
| `currentState` | string | YES | Situación actual. Vacío si no lo dijo |
| `cost` | string | YES | Qué le cuesta si sigue igual. Vacío si no lo dijo |
| `tried` | string | YES | Qué ha probado. Vacío si no lo dijo |
| `scope` | string | YES | Qué construye o qué alcance necesita. Vacío si no lo dijo |
| `targetResult` | string | YES | Resultado o señal de éxito. Vacío si no lo dijo |
| `budget` | string | YES | Presupuesto, solo si lo dijo. Si no, vacío |
| `timing` | string | YES | Plazo. Vacío si no lo dijo |
| `decisionMaker` | string | YES | Quién decide. Vacío si no lo dijo |

**Preview response**

```json
{"ok": true, "fit": {"route": "meeting", "reasons": ["Necesidad, presupuesto, plazo y decisor claros"]}, "summary": "Por qué ahora: tiene la reunión esta semana. Situación: no sabe qué preguntar. Resultado buscado: cerrar un siguiente paso.", "instruction": "Llama consult_brain con Resume mis retos y di el resumen en dos frases. Pregunta si lo entendiste bien."}
```

`route` en la app real es `meeting` (todo claro), `email` (falta presupuesto, decisor o fecha) o `nurture` (sin problema claro, o sin presupuesto).

### 5.4 `decide_plan`

**Description**

```text
Aprueba o rechaza por voz el plan que ya está en pantalla: ilumina y presiona el botón de la tarjeta. which: "meeting" (plan de la reunión) o "product" (plan de producto). approved true aprueba, false rechaza. Llámala UNA sola vez por decisión. Si approved es true, di en una frase que quedó aprobado y pregunta si lo envías por correo o agendas la reunión. Si es false, di que lo ajustamos y pregunta qué cambiaría.
```

| Name | Type | Required | Description |
|---|---|---|---|
| `which` | string | YES | meeting o product |
| `approved` | boolean | YES | true aprueba, false rechaza |

Si el desplegable de Type no tiene boolean, usa `string` y en la descripción escribe: la cadena `true` o `false`.

**Preview response**

```json
{"ok": true, "pressed": true, "instruction": "Di en una frase que quedó aprobado y pregunta si lo envías por correo o agendas la reunión."}
```

### 5.5 `consult_brain`

**Description**

```text
Pide al cerebro comercial (ADK) el resumen, el plan, la comunidad, el correo o el análisis. request es la frase completa, en español, con el caso. Ejemplos: "Resume mis retos: …", "Muéstrame los productos y proyectos relacionados con mi caso: …", "Arma el plan", "Arma el plan de producto", "El plan ya está aprobado. Envía el plan por correo ahora (sin pedir confirmación)." Cuando el resultado traiga reply, dilo en 1 a 3 frases. Cuando traiga error, di que no pudiste preparar los resultados y no inventes. Cuando traiga status working y no traiga reply, di solo "Dame un momento."
```

| Name | Type | Required | Description |
|---|---|---|---|
| `request` | string | YES | Lo que debe hacer el cerebro, en una frase, con el caso de esta persona |

**Preview response**

```json
{"reply": "Vas a venderle tu producto y tu reto es saber qué preguntar en la reunión. ¿Lo entendí bien?", "shown": [{"tool": "summarize_context", "summary": "resumen listo"}], "instruction": "Di el reply en máximo 3 frases. No inventes nada que no esté en reply."}
```

En START CALL ese JSON es fijo: cada llamada a `consult_brain` "contesta" lo mismo. Sirve para oír el ritmo de la voz. El plan, el correo y la comunidad de verdad solo salen con la app conectada.

### 5.6 `open_calendar`

En el builder de las capturas este tool no está. Sin él, la Fase 6 no puede abrir el calendario.

**Description**

```text
Abre al instante el calendario en pantalla para agendar la reunión. Úsala cuando quiera agendar y aún no dijo día y hora. Devuelve slots con label e iso. Di 2 o 3 horarios (el label) y pregunta cuál le queda bien. No uses consult_brain para abrir el calendario.
```

Sin parámetros.

**Preview response**

```json
{"ok": true, "slots": [{"iso": "2026-11-09T09:30:00-05:00", "label": "Lunes 9 · 09:30"}, {"iso": "2026-11-09T12:00:00-05:00", "label": "Lunes 9 · 12:00"}, {"iso": "2026-11-10T15:00:00-05:00", "label": "Martes 10 · 15:00"}]}
```

### 5.7 `schedule_meeting`

**Description**

```text
Agenda la reunión en cuanto el usuario dice día y hora: ilumina ese horario en el calendario, lo cierra y la agenda. datetime es ISO-8601 con zona de Colombia, por ejemplo 2026-11-07T12:00:00-05:00. No pidas que lo confirme en pantalla. Si ok es true, di SOLO "Listo, tu reunión quedó agendada." Si ok es false, dilo en una frase y ofrece otro horario. No digas que quedó agendada.
```

| Name | Type | Required | Description |
|---|---|---|---|
| `datetime` | string | YES | ISO-8601 con zona -05:00. Ejemplo: 2026-11-07T12:00:00-05:00 |

**Preview response**

```json
{"ok": true, "status": "booked", "reply": "Listo, tu reunión quedó agendada.", "instruction": "Di SOLO: Listo, tu reunión quedó agendada."}
```

---

## 6. La app tiene que escuchar estos nombres

El worker local llama al navegador con **otros** nombres y, en dos tools, con **otro** JSON. El builder no hace esa traducción: el nombre del client tool es el método RPC, y los parámetros son el payload.

Hoy `apps/web/app/components/VoiceRoom.tsx` registra esto:

| Tool que pegas en el builder | RPC que la app escucha hoy | Payload que la app parsea hoy |
|---|---|---|
| `save_intake_field` | `intake.field` | `{ "field", "value" }` — igual que el tool |
| `submit_intake` | `intake.submit` | `{ "intake": {name, persona, lookingFor}, "discovery": {track, questions, clientName} }` — el worker lo arma; el builder manda los cuatro campos planos |
| `submit_discovery` | `discovery.submit` | `{ "brief", "fit", "summary" }` — el worker calcula `fit` y `summary` en `playbook.py` |
| `decide_plan` | `plan.decide` | `{ "which", "approved" }` — igual que el tool |
| `consult_brain` | `brain.ask` | `{ "request" }` — igual que el tool. La app responde `{ "reply", "shown", "error?" }` cuando ADK termina |
| `open_calendar` | `calendar.open` | `{}`. La app responde `{ "ok": true, "slots": [{iso, label}] }` |
| `schedule_meeting` | `calendar.pick` | `{ "datetime" }`. La app responde `{ "ok", "status", "reply" }` |

`save_intake_field`, `decide_plan`, `consult_brain`, `open_calendar` y `schedule_meeting` ya tienen la forma que el navegador entiende. Falta que el navegador registre **también** el nombre del tool (además del RPC viejo), o el builder no enciende la tarjeta.

`submit_intake` y `submit_discovery` además cambian de forma. Hasta que la app acepte los campos planos de esta guía, esos dos tools en una llamada real no llenan el formulario ni el resumen. En START CALL del builder sí se ven, porque ahí responde el Preview response.

Estas dos llamadas las hace la app **hacia** el agente. El builder no las puede registrar. Siguen funcionando solo con `python agent.py dev`:

| Método | Quién lo llama | Para qué |
|---|---|---|
| `concierge.ask` | La app, cuando alguien escribe en el chat durante la llamada | El worker lo dice en voz |
| `concierge.finale` | La app, cuando termina la animación final | El cierre de 4–5 frases (gracias, suerte en la reunión, la comunidad, DevFest Medellín 2026) |

---

## 7. Probar

1. En el builder, **START CALL**. El saludo pregunta el nombre. Di un nombre y mira en **Events** que llama `save_intake_field` con `field=name` antes de la siguiente pregunta.
2. Sigue hasta `submit_intake` (una vez) y `submit_discovery` (una vez). En el builder el resultado es el preview, así que el resumen de `consult_brain` se repite igual en cada prueba.
3. Di "apruebo el plan" y comprueba un solo `decide_plan`. Di "agenda la reunión" y comprueba `open_calendar`, luego un día y hora y `schedule_meeting`.
4. Para ver tarjetas de verdad, la app tiene que estar en la sala y registrada a los nombres de la sección 6, con `LIVEKIT_AGENT_NAME=noshy_concierge_cloud`, y el worker local apagado. **Deploy agent** publica esta misma config; el preview ya la está usando mientras editas.

Guía del worker desplegado con código (ElevenLabs, `finale`, traducción de RPC): [02 · LiveKit](./02-livekit.md).
