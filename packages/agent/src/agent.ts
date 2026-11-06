import { Gemini, LlmAgent, type CallbackContext, type LlmRequest } from "@google/adk";
import {
  analyzeMeetTranscript,
  assessContext,
  bookMeeting,
  buildProductPlan,
  confirmPlan,
  buildStrategyPlan,
  matchCommunity,
  sendPlanEmail,
  showDiscoveryGuide,
  summarizeContext,
} from "./tools.js";
import { INSTRUCTION } from "./instruction.js";

async function ensurePreContextDefaults(context: CallbackContext) {
  const defaults: Record<string, unknown> = {
    persona: "",
    building: "",
    lookingFor: "",
    offering: "",
    successCriteria: "",
    challenge: "",
    helpType: "",
    urgency: "",
    budget: "",
    deal_summary: "",
    fit_route: "",
    client_name: "",
    targetAudience: "",
    growthGoal: "",
    city: "Medellín",
    "user:preferred_language": "es",
    user_name: "",
    user_email: "",
    plan_status: "none",
    plan_confirmed: false,
    current_intent: "",
    discovery_track: "",
    discovery_facts: [],
    discovery: { track: "builder", pendingSlotIds: [], stage: "context", shownItemIds: [], recommendationShown: false },
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (!context.state.has(key)) context.state.set(key, value);
  }
  return undefined;
}

/**
 * Text turns use ADK_MODEL; the ADK web mic (/run_live) needs a Live API model,
 * so connect() swaps in ADK_LIVE_MODEL. On Vertex the only Live model is
 * gemini-live-2.5-flash-native-audio (regional, not "global").
 */
class TextAndLiveGemini extends Gemini {
  constructor(
    model: string,
    private readonly liveModel: string,
  ) {
    super({ model });
  }

  override async connect(llmRequest: LlmRequest) {
    llmRequest.model = this.liveModel;
    const connection = await super.connect(llmRequest);
    // adk-devtools 2.3.0 web UI sends mic/camera blobs as { mime_type } (Python
    // shape); ADK JS reads blob.mimeType and drops them ("Blob not sent").
    const sendRealtime = connection.sendRealtime.bind(connection);
    connection.sendRealtime = (blob) => {
      const { mime_type, ...rest } = blob as typeof blob & { mime_type?: string };
      return sendRealtime({ ...rest, mimeType: blob.mimeType ?? mime_type });
    };
    return connection;
  }
}

const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === "true";
const model = new TextAndLiveGemini(
  process.env.ADK_MODEL ?? "gemini-flash-latest",
  process.env.ADK_LIVE_MODEL ??
    (useVertex ? "gemini-live-2.5-flash-native-audio" : "gemini-3.1-flash-live-preview"),
);

export const rootAgent = new LlmAgent({
  name: "noshy_concierge",
  description:
    "NoShy Concierge — discovery comercial → resumen de retos → plan de estrategia (preguntas para el cliente) con apoyo de la comunidad (proyectos y personas).",
  model,
  beforeAgentCallback: ensurePreContextDefaults,
  instruction: INSTRUCTION,
  tools: [
    analyzeMeetTranscript,
    assessContext,
    showDiscoveryGuide,
    summarizeContext,
    matchCommunity,
    buildStrategyPlan,
    buildProductPlan,
    confirmPlan,
    sendPlanEmail,
    bookMeeting,
  ],
});

export default rootAgent;
