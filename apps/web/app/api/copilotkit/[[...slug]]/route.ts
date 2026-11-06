import { ADKAgent } from "@ag-ui/adk";
import { CopilotRuntime, InMemoryAgentRunner, createCopilotEndpoint } from "@copilotkit/runtime/v2";
import { handle } from "hono/vercel";

// ADKAgent (@ag-ui/adk) is the official AG-UI client for ADK endpoints;
// it extends HttpAgent. Our TS bridge in packages/agent serves /ag-ui.
const runtime = new CopilotRuntime({
  agents: {
    // Cast: this monorepo install carries two @ag-ui/client copies
    // (CopilotKit pins 1.0.2, @ag-ui/adk resolves 1.0.3), so TS sees
    // duplicate private `_debug` declarations on AbstractAgent.
    // At runtime ADKAgent *is* an HttpAgent and speaks AG-UI identically.
    default: new ADKAgent({
      url: process.env.ADK_AG_UI_URL ?? "http://localhost:8000/ag-ui",
    }) as never,
  },
  // Enables A2UI middleware: ACTIVITY_SNAPSHOT activityType a2ui-surface
  // with a2ui_operations from the ADK bridge (plan recommend + approve).
  a2ui: {},
  runner: new InMemoryAgentRunner(),
});

const app = createCopilotEndpoint({ runtime, basePath: "/api/copilotkit" });

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
