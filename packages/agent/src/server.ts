import "dotenv/config";
import { createHash } from "node:crypto";
import cors from "cors";
import express, { type Request, type Response } from "express";
import {
  InMemorySessionService,
  Runner,
  State,
  VertexAiSessionService,
  createEvent,
  getFunctionCalls,
  getFunctionResponses,
  type ToolContext,
} from "@google/adk";
import rootAgent from "./agent.js";
import { approvalFromHistory, type HistoryMsg } from "./approval.js";
import { normalizePreContext, preContextToStateDelta } from "./community.js";
import { updateDeal } from "./deal-store.js";
import { buildCommunityA2uiStream, COMMUNITY_SURFACE_ID } from "./a2ui-community.js";
import { buildPlanA2uiOperations } from "./a2ui-plan.js";
import { buildProductA2uiOperations, PRODUCT_SURFACE_ID } from "./a2ui-product.js";
import type { ProductPlan } from "./strategy.js";
import { demoRespond, type DemoStep } from "./demo.js";
import { analyzeTranscript } from "./meeting-analyst.js";
import { communityShowReply, communityShowRequest, type CommunityShowRequest } from "./community-fast-path.js";
import { runMatchCommunity } from "./tools.js";

/**
 * AG-UI bridge for Google ADK (TypeScript).
 *
 * Why this file exists: `@ag-ui/adk` on npm is a *client* (`ADKAgent extends
 * HttpAgent`) that expects a Python `ag_ui_adk` server. There is no TS server
 * handler. So we serve AG-UI ourselves: POST /ag-ui accepts a RunAgentInput,
 * runs the ADK `Runner`, and translates ADK Events into AG-UI SSE events
 * (RUN_*, TEXT_MESSAGE_*, TOOL_CALL_*) that CopilotKit / HttpAgent consume.
 * Tool-call events carry `toolCallName`, which is what CopilotKit's
 * `useRenderTool({ name: "match_community" })` matches on for Generative UI.
 */

const app = express();
// The web app calls /ag-ui server-side (Next.js route), so CORS only matters for browser tools.
// Cloud: CORS_ORIGINS=https://your-app.vercel.app,https://other.domain
app.use(cors({ origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((o) => o.trim()) }));
app.use(express.json({ limit: "1mb" }));

const MAX_TRANSCRIPT_CHARS = 200_000;
const isProduction = process.env.NODE_ENV === "production";

const useVertex =
  (process.env.GOOGLE_GENAI_USE_ENTERPRISE ?? process.env.GOOGLE_GENAI_USE_VERTEXAI)?.toLowerCase() === "true";
const hasVertex = useVertex && Boolean(process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_LOCATION);
const hasKey =
  hasVertex || Boolean(process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
const APP_NAME = "noshy-concierge";
const agentEngineId = process.env.GOOGLE_CLOUD_AGENT_ENGINE_ID?.trim();
const agentEngineLocation = process.env.GOOGLE_CLOUD_AGENT_ENGINE_LOCATION?.trim() || process.env.GOOGLE_CLOUD_LOCATION;
const useVertexSessions = Boolean(hasVertex && agentEngineId);
const sessionService = useVertexSessions
  ? new VertexAiSessionService({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: agentEngineLocation,
      agentEngineId,
    })
  : new InMemorySessionService();
const runner = hasKey
  ? new Runner({
      appName: APP_NAME,
      agent: rootAgent,
      sessionService,
      autoCreateSession: true,
    })
  : null;

/**
 * Vertex session ids must match `[a-z][a-z0-9-]{0,61}[a-z0-9]` (max 63).
 * CopilotKit thread ids are often UUIDs or `thread_<timestamp>`, so map them
 * to a stable id. Same thread always resolves to the same session.
 */
function vertexSessionIdentity(threadId: string): { userId: string; sessionId: string } {
  const cleaned = threadId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefixed = `t-${cleaned}`.replace(/-+/g, "-").replace(/-+$/g, "");
  const readable = /^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])$/.test(prefixed) && prefixed.length <= 63;
  const sessionId = readable ? prefixed : `t${createHash("sha256").update(threadId).digest("hex")}`.slice(0, 63);
  return { userId: `u-${sessionId}`, sessionId };
}

type AgUiMessage = {
  id?: string;
  role?: string;
  content?: unknown;
  toolCallId?: string;
  name?: string;
  toolCalls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
};
type RunInput = {
  threadId?: string;
  runId?: string;
  messages?: AgUiMessage[];
  tools?: Array<{ name?: string }>;
  state?: Record<string, unknown>;
};

/** Browser-executed tools: CopilotKit runs them; the bridge must not emit TOOL_CALL_RESULT. */
const FRONTEND_TOOLS = new Set(["open_calendar"]);

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content.map((p) => (typeof p === "object" && p && "text" in p ? String((p as { text: unknown }).text) : "")).join("");
  return "";
}

function sse(res: Response, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const COMMUNITY_CARD_STREAM_MS = 160;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function emitA2uiSnapshot(res: Response, runId: string, surfaceId: string, ops: Record<string, unknown>[], quiet = false) {
  if (!quiet) console.log("[ag-ui] emitting A2UI ACTIVITY_SNAPSHOT", { surfaceId, ops: ops.length });
  sse(res, {
    type: "ACTIVITY_SNAPSHOT",
    messageId: `a2ui_${runId}_${surfaceId}`,
    activityType: "a2ui-surface",
    content: { a2ui_operations: ops },
    replace: true,
  });
}

/** Plan recommend+approve (Composer layout). */
function emitPlanA2ui(res: Response, runId: string, plan: Record<string, unknown>) {
  emitA2uiSnapshot(res, runId, "seller-recommend", buildPlanA2uiOperations(plan));
}

/** Product build plan + approve (A2UI). */
function emitProductA2ui(res: Response, runId: string, plan: Record<string, unknown>) {
  emitA2uiSnapshot(res, runId, PRODUCT_SURFACE_ID, buildProductA2uiOperations(plan as unknown as ProductPlan));
}

/**
 * Community board — A2UI surface rendered by the catalog `CommunityBoard` component.
 * Progressive: one snapshot per card on the same messageId (replace).
 */
async function emitCommunityA2ui(res: Response, runId: string, match: Record<string, unknown>) {
  const frames = buildCommunityA2uiStream(match);
  for (let i = 0; i < frames.length; i += 1) {
    if (i > 0) await sleep(COMMUNITY_CARD_STREAM_MS);
    console.log("[ag-ui] emitting A2UI community frame", { frame: i + 1, of: frames.length });
    emitA2uiSnapshot(res, runId, COMMUNITY_SURFACE_ID, frames[i]!, true);
  }
}

async function emitSteps(res: Response, threadId: string, runId: string, steps: DemoStep[]) {
  sse(res, { type: "RUN_STARTED", threadId, runId });
  let i = 0;
  let planForA2ui: Record<string, unknown> | null = null;
  let matchForA2ui: Record<string, unknown> | null = null;
  let productForA2ui: Record<string, unknown> | null = null;
  for (const step of steps) {
    i += 1;
    if (step.kind === "tool") {
      const toolCallId = `call_${runId}_${i}`;
      const messageId = `msg_${runId}_${i}`;
      sse(res, { type: "TOOL_CALL_START", toolCallId, toolCallName: step.name, parentMessageId: messageId });
      sse(res, { type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify(step.args) });
      sse(res, { type: "TOOL_CALL_END", toolCallId });
      // Frontend tools are executed by CopilotKit in the browser — emitting a
      // RESULT here would pre-empt that execution.
      if (!FRONTEND_TOOLS.has(step.name)) {
        sse(res, {
          type: "TOOL_CALL_RESULT",
          messageId: `result_${runId}_${i}`,
          toolCallId,
          content: JSON.stringify(step.result),
          role: "tool",
        });
      }
      if (step.name === "build_strategy_plan" && step.result && typeof step.result === "object") {
        planForA2ui = step.result as Record<string, unknown>;
      }
      if (step.name === "match_community" && step.result && typeof step.result === "object") {
        matchForA2ui = step.result as Record<string, unknown>;
      }
      if (step.name === "build_product_plan" && step.result && typeof step.result === "object") {
        productForA2ui = step.result as Record<string, unknown>;
      }
    } else {
      const messageId = `msg_${runId}_text_${i}`;
      sse(res, { type: "TEXT_MESSAGE_START", messageId, role: "assistant" });
      sse(res, { type: "TEXT_MESSAGE_CONTENT", messageId, delta: step.text });
      sse(res, { type: "TEXT_MESSAGE_END", messageId });
    }
  }
  // Community board only when asked on its own (with a plan in the same run it is just its support).
  if (matchForA2ui && !planForA2ui && !productForA2ui) await emitCommunityA2ui(res, runId, matchForA2ui);
  if (planForA2ui) emitPlanA2ui(res, runId, planForA2ui);
  if (productForA2ui) emitProductA2ui(res, runId, productForA2ui);
  sse(res, { type: "RUN_FINISHED", threadId, runId });
  res.end();
}

/** Fast-path session writes still in flight, per session: a following run waits for them. */
const pendingSessionWrites = new Map<string, Promise<void>>();

/**
 * "Muéstrame productos / personas relacionados" without the LLM: run match_community on the
 * session state, stream the board, and record the turn + state in the ADK session so later plan
 * runs see it (history as plain text: no synthetic function calls, so no thought-signature issues).
 */
async function communityFastPathSteps(
  ids: { runId: string; userId: string; sessionId: string },
  userText: string,
  request: CommunityShowRequest,
  stateDelta: Record<string, unknown>,
) {
  const started = Date.now();
  await pendingSessionWrites.get(ids.sessionId);
  const session = await sessionService.getOrCreateSession({ appName: APP_NAME, userId: ids.userId, sessionId: ids.sessionId });
  const delta: Record<string, unknown> = { ...stateDelta };
  const state = new State({ ...session.state, ...stateDelta }, delta);
  const args = { goal: request.goal, focus: request.focus };
  const result = runMatchCommunity(args, { state } as unknown as ToolContext);
  const planStatus = state.get<string>("plan_status");
  const reply = communityShowReply(result, { planShown: !!planStatus && planStatus !== "none" });

  const persisted = Object.fromEntries(Object.entries(delta).filter(([k]) => !k.startsWith("temp:")));
  const invocationId = `fast_${ids.runId}`;
  // Persist while the cards stream (remote sessions take ~1–2 s); the next run waits for it.
  const write = (async () => {
    await sessionService.appendEvent({
      session,
      event: createEvent({ invocationId, author: "user", content: { role: "user", parts: [{ text: userText }] } }),
    });
    await sessionService.appendEvent({
      session,
      event: createEvent({
        invocationId,
        author: rootAgent.name,
        content: { role: "model", parts: [{ text: reply }] },
        actions: { stateDelta: persisted },
      }),
    });
  })()
    .catch((err: unknown) => console.warn("[ag-ui] community fast path: session not saved", err))
    .finally(() => {
      if (pendingSessionWrites.get(ids.sessionId) === write) pendingSessionWrites.delete(ids.sessionId);
    });
  pendingSessionWrites.set(ids.sessionId, write);
  console.log("[ag-ui] community fast path", { focus: request.focus, ms: Date.now() - started });
  const steps: DemoStep[] = [
    { kind: "tool", name: "match_community", args, result },
    { kind: "text", text: reply },
  ];
  return steps;
}

// Opening the agent in a browser (GET) is a common mix-up: explain instead of "Cannot GET".
app.get(["/", "/ag-ui"], (_req, res) => {
  res
    .type("text/plain; charset=utf-8")
    .send(
      [
        "NoShy Concierge — ADK agent server (backend, no web page).",
        "",
        "• The app talks to it with POST /ag-ui. Opening /ag-ui in a browser sends GET, so there is nothing to show.",
        "• Open the app instead: http://localhost:3000  (run `npm run dev:web`).",
        `• Status: GET /health → mode ${hasKey ? "adk-gemini" : "demo-no-key"}${useVertex ? " (Vertex AI)" : " (Gemini API key)"}.`,
      ].join("\n"),
    );
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mode: hasKey ? "adk-gemini" : "demo-no-key",
    agent: "noshy_concierge",
    sessions: useVertexSessions ? "vertex-agent-engine" : "memory",
    ...(useVertexSessions ? { agentEngineId } : {}),
    endpoint: "/ag-ui",
  });
});

app.post("/deal", (req: Request, res: Response) => {
  const { dealId, patch } = (req.body ?? {}) as { dealId?: unknown; patch?: unknown };
  if (typeof dealId !== "string" || !/^[\w-]{8,80}$/.test(dealId) || typeof patch !== "object" || !patch) {
    res.status(400).json({ error: "Invalid deal" });
    return;
  }
  try {
    updateDeal(dealId, patch as Record<string, unknown>);
    res.json({ ok: true });
  } catch (err) {
    console.error("Deal not saved", err);
    res.status(500).json({ error: "Deal not saved" });
  }
});

app.post("/transcript", async (req: Request, res: Response) => {
  const transcript = String((req.body as { transcript?: unknown } | undefined)?.transcript ?? "").trim();
  if (transcript.length < 50 || transcript.length > MAX_TRANSCRIPT_CHARS) {
    res.status(400).json({ error: "Pega una transcripción de entre 50 y 200.000 caracteres." });
    return;
  }
  if (!hasKey) {
    res.status(503).json({ error: "El análisis necesita credenciales de Gemini." });
    return;
  }
  try {
    res.json(await analyzeTranscript(transcript));
  } catch (err) {
    console.error("Transcript analysis failed", err);
    res.status(502).json({ error: "No pude analizar la transcripción. Inténtalo de nuevo." });
  }
});

app.post("/ag-ui", async (req: Request, res: Response) => {
  const input = (req.body ?? {}) as RunInput;
  const threadId = input.threadId ?? `thread_${Date.now()}`;
  const runId = input.runId ?? `run_${Date.now()}`;
  const messages = input.messages ?? [];
  // A frontend tool result only counts as a continuation when it ends the history;
  // earlier server tool results stay in `messages` on every later turn.
  const lastTool = messages.at(-1)?.role === "tool" ? messages.at(-1) : undefined;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUser ? textOf(lastUser.content) : "";
  const frontendToolNames = new Set((input.tools ?? []).map((t) => t.name).filter(Boolean));

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  try {
    // A broken deploy must fail visibly, not answer with scripted replies.
    if (!runner && isProduction) {
      sse(res, { type: "RUN_ERROR", message: "Agent is not configured" });
      res.end();
      return;
    }

    // Continuation after a frontend tool (calendar) ran in the browser.
    // Plan approve/reject comes as an A2UI action userMessage → normal user turn (demoRespond / ADK).
    if (lastTool) {
      await emitSteps(res, threadId, runId, [
        { kind: "text", text: "Te abrí el calendario: elige un horario y confírmalo." },
      ]);
      return;
    }

    // Frontend-tool interception: ADK (server) tools can't call browser tools,
    // so a clear booking intent is routed to `open_calendar` when CopilotKit
    // advertised it. The browser executes it and returns the result next run.
    const steps = demoRespond(lastUserText);
    const calendarStep = steps.find((s) => s.kind === "tool" && s.name === "open_calendar");
    if (calendarStep && frontendToolNames.has("open_calendar")) {
      // Only the frontend tool call in this run; confirmation text comes
      // after the browser returns the tool result on the next run.
      await emitSteps(res, threadId, runId, [calendarStep]);
      return;
    }

    if (!runner) {
      // Drop browser-only calendar from scripted demo (handled above when advertised).
      const demoSteps = steps.filter((s) => !(s.kind === "tool" && s.name === "open_calendar"));
      await emitSteps(res, threadId, runId, demoSteps);
      return;
    }

    // Real ADK path: translate ADK Events -> AG-UI events.
    // Pre-form answers arrive as AG-UI `state` / `state.preContext` and become
    // session.state via stateDelta so {key} instruction templating + tools see intake.
    const stateDelta: Record<string, unknown> = preContextToStateDelta(normalizePreContext(input.state));
    // Approval is deterministic: the A2UI button / voice decide_plan send "Apruebo el plan…".
    // Mark it in session.state here so send_plan_email never asks to confirm again
    // (the model sometimes skipped confirm_plan on that turn).
    const approval = approvalFromHistory(messages as HistoryMsg[]);
    Object.assign(stateDelta, approval);
    const sessionIdentity = useVertexSessions
      ? vertexSessionIdentity(threadId)
      : { userId: `visitor:${threadId}`, sessionId: threadId };

    // Plain "show me related products / people" → deterministic match, no LLM round-trips.
    const showCommunity = communityShowRequest(lastUserText);
    if (showCommunity) {
      const fast = await communityFastPathSteps({ runId, ...sessionIdentity }, lastUserText, showCommunity, stateDelta).catch(
        (err: unknown) => {
          console.warn("[ag-ui] community fast path failed → ADK", err);
          return null;
        },
      );
      if (fast) {
        await emitSteps(res, threadId, runId, fast);
        return;
      }
    }

    await pendingSessionWrites.get(sessionIdentity.sessionId);
    console.log("[ag-ui] run", { user: lastUserText.slice(0, 120), approval: Object.keys(approval).length ? approval : undefined });
    sse(res, { type: "RUN_STARTED", threadId, runId });
    const messageId = `msg_${runId}`;
    let textStarted = false;
    const seenToolResults = new Set<string>();
    const toolCallNames = new Map<string, string>();
    let lastPlanPayload: Record<string, unknown> | null = null;
    let lastMatchPayload: Record<string, unknown> | null = null;
    let lastProductPayload: Record<string, unknown> | null = null;

    for await (const event of runner.runAsync({
      userId: sessionIdentity.userId,
      sessionId: sessionIdentity.sessionId,
      newMessage: { role: "user", parts: [{ text: lastUserText }] },
      // Stopping condition: a turn needs at most a few tool hops.
      runConfig: { maxLlmCalls: 8 },
      ...(Object.keys(stateDelta).length ? { stateDelta } : {}),
    })) {
      // Model/auth failures arrive as an event with errorCode — surface them instead of an empty reply.
      const failed = event as unknown as { errorCode?: string; errorMessage?: string };
      if (failed.errorCode || failed.errorMessage) {
        console.error("[agent] model error:", failed.errorCode, failed.errorMessage);
        sse(res, { type: "RUN_ERROR", message: failed.errorMessage ?? failed.errorCode ?? "Model error" });
        res.end();
        return;
      }
      const calls = getFunctionCalls(event);
      for (const call of calls) {
        const toolCallId = call.id ?? `call_${runId}_${calls.indexOf(call)}`;
        if (call.name) toolCallNames.set(toolCallId, call.name);
        sse(res, { type: "TOOL_CALL_START", toolCallId, toolCallName: call.name ?? "tool", parentMessageId: messageId });
        sse(res, { type: "TOOL_CALL_ARGS", toolCallId, delta: JSON.stringify(call.args ?? {}) });
        sse(res, { type: "TOOL_CALL_END", toolCallId });
      }
      const responses = getFunctionResponses(event);
      for (const r of responses) {
        const toolCallId = r.id ?? `call_${runId}`;
        if (seenToolResults.has(toolCallId)) continue;
        seenToolResults.add(toolCallId);
        const payload = (r.response ?? {}) as Record<string, unknown>;
        const toolName = (typeof r.name === "string" && r.name) || toolCallNames.get(toolCallId);
        if (toolName === "build_strategy_plan") lastPlanPayload = payload;
        if (toolName === "match_community") lastMatchPayload = payload;
        if (toolName === "build_product_plan") lastProductPayload = payload;
        sse(res, {
          type: "TOOL_CALL_RESULT",
          messageId: `result_${toolCallId}`,
          toolCallId,
          content: JSON.stringify(payload),
          role: "tool",
        });
      }
      const parts = event.content?.parts ?? [];
      for (const part of parts) {
        if ("text" in part && part.text) {
          if (!textStarted) {
            sse(res, { type: "TEXT_MESSAGE_START", messageId, role: "assistant" });
            textStarted = true;
          }
          sse(res, { type: "TEXT_MESSAGE_CONTENT", messageId, delta: part.text });
        }
      }
    }
    if (textStarted) sse(res, { type: "TEXT_MESSAGE_END", messageId });

    // Steps: community board (only when it was asked for on its own — when the same run builds a
    // plan, the matches are just the plan's support and the voice offers the cards afterwards),
    // then meeting plan, then product plan.
    if (lastMatchPayload && !lastPlanPayload && !lastProductPayload) await emitCommunityA2ui(res, runId, lastMatchPayload);
    if (lastPlanPayload) emitPlanA2ui(res, runId, lastPlanPayload);
    if (lastProductPayload) emitProductA2ui(res, runId, lastProductPayload);

    sse(res, { type: "RUN_FINISHED", threadId, runId });
    res.end();
  } catch (err) {
    sse(res, { type: "RUN_ERROR", message: err instanceof Error ? err.message : "Agent run failed" });
    res.end();
  }
});

const port = Number(process.env.PORT ?? 8000);
app.listen(port, () => {
  console.log(
    `ADK AG-UI server on http://localhost:${port}/ag-ui  (mode: ${hasKey ? "adk-gemini" : "demo-no-key"}, sessions: ${useVertexSessions ? `vertex:${agentEngineId}` : "memory"})`,
  );
});
