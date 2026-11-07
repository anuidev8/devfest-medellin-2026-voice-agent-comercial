# 03 · CopilotKit (el puente) — cómo el frontend habla con el agente

Código: `apps/web` (Next.js 16, React 19). CopilotKit está **autohospedado** dentro de Next.js:
no hace falta cuenta de CopilotKit Cloud ni llave pública.

```text
Navegador                                 Servidor Next.js                   packages/agent
─────────                                 ────────────────                   ──────────────
<CopilotKit runtimeUrl="/api/copilotkit">  /api/copilotkit/[[...slug]]        POST /ag-ui  (SSE)
  <CopilotChat agentId="default"/>   ───▶  CopilotRuntime v2            ───▶  ADK Runner.runAsync
  useAgent / useRenderTool / A2UI    ◀───   └ agents.default = ADKAgent  ◀───  eventos ADK → eventos AG-UI
                                              (url = ADK_AG_UI_URL)
```

## Las 4 piezas

| Archivo | Rol |
|---|---|
| `app/providers.tsx` | `<CopilotKit runtimeUrl="/api/copilotkit" a2ui={{ catalog }}>` envuelve la app |
| `app/api/copilotkit/[[...slug]]/route.ts` | `CopilotRuntime` con un agente `default = new ADKAgent({ url: ADK_AG_UI_URL })`, `a2ui: {}` activo |
| `app/page.tsx` | `<CopilotChat agentId="default" />` + `useAgent()` para el estado |
| `app/components/*` | UI generativa: `useRenderTool` (pinta las tool calls de ADK), `useFrontendTool` (tools que corren en el navegador), catálogo A2UI |

La única variable que CopilotKit necesita:

```dotenv
# apps/web/.env.local
ADK_AG_UI_URL=http://localhost:8000/ag-ui      # nube: https://<agent-service>/ag-ui
```

Se lee **en el servidor**, en la ruta, así que la URL del agente no llega al navegador y
no hace falta CORS entre la web y el agente.

## UI generativa: cómo una herramienta se vuelve tarjeta

1. ADK llama una herramienta (por ejemplo `match_community`).
2. `server.ts` emite AG-UI `TOOL_CALL_START/ARGS/END` + el resultado, con `toolCallName: "match_community"`.
3. En el navegador, `useRenderTool({ name: "match_community", render })` (`CommunityCards.tsx`) coincide
   con ese nombre y pinta la tarjeta.

Herramientas de ADK que se pintan hoy: `match_community`, `summarize_context`, `show_discovery_guide`,
`assess_context`, `build_strategy_plan`, `build_product_plan`.

**Herramienta de frontend** (corre en el navegador; el modelo puede llamarla): `open_calendar` en `CalendarTool.tsx`
con `useFrontendTool({ name, parameters: z.object(...), handler })`.

**Superficies A2UI** (tarjeta de aprobación del plan, tablero de comunidad): `server.ts` emite `ACTIVITY_SNAPSHOT`
con `activityType: "a2ui-surface"`; el middleware `a2ui: {}` del runtime y `app/a2ui/catalog.tsx` la pintan.

Para rediseñar la tarjeta de propuesta en [A2UI Composer](https://a2ui-composer.ag-ui.com/), usa el prompt en
[`a2ui-composer-proposal-prompt.txt`](./a2ui-composer-proposal-prompt.txt) y vuelve a exportar a `packages/agent/src/a2ui-plan.ts`.

### Agregar una tarjeta nueva (checklist)
1. Agrega la herramienta en `packages/agent/src/tools.ts` (parámetros Zod) y menciónala en `instruction.ts`.
2. Agrega `useRenderTool({ name: "<tool_name>", render: (...) => <YourCard/> })` en un componente que esté montado.
3. Si la voz debe reaccionar, manéjalo en `VoiceRoom.tsx`.
4. Reinicia `npm run dev` y dispara la herramienta en el chat.

## Voz ↔ CopilotKit
`VoiceRoom.tsx` registra los métodos RPC de LiveKit (`brain.ask`, `intake.submit`, `intake.field`,
`discovery.submit`, `plan.decide`, `calendar.open`, `calendar.pick`) y llama al worker con
`concierge.ask` / `concierge.finale`. `brain.ask` manda el pedido de la persona al **mismo**
agente de CopilotKit que usa el chat, así chat y voz comparten una sesión de ADK.

## Correr

```bash
npm run dev            # todo
npm run dev:web        # solo la web (necesita el agente en ADK_AG_UI_URL)
npm run build -w web   # chequeo del build de producción
```

## Herramientas de CopilotKit
- `npx copilotkit@latest verify` — revisa el cableado de CopilotKit del proyecto (córrelo primero si el chat no responde).
- Nota de versiones: los paquetes de CopilotKit fijan `@ag-ui/client` 1.0.2 y `@ag-ui/adk` trae 1.0.3, de ahí el
  cast `as never` en la ruta. Al subir de versión, mantén alineados los `@copilotkit/*`.
- Docs: https://docs.copilotkit.ai

Deploy: [04 · Desplegar → Web en Vercel](../deploy/04-deploy-cloud.md#3-web-en-vercel).
