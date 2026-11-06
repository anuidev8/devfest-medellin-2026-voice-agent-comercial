"use client";

import type { AbstractAgent, AgentSubscriber } from "@ag-ui/client";

import { UseAgentUpdate, useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { parseToolResult } from "./tool-utils";

/** One generative card on the stage, derived from an agent tool call. */
export type StageItem = {
  id: string;
  name: string;
  args: unknown;
  result: unknown;
  done: boolean;
};


/** The three intake fields voice fills first. Keys match ADK preContext (server.ts → session.state). */
export const INTAKE_FIELDS = [
  { id: "name", label: "Nombre", placeholder: "¿Cómo te llamas?" },
  { id: "persona", label: "Perfil", placeholder: "Vendo mi producto · Empresa buscando talento…" },
  { id: "lookingFor", label: "Qué necesitas", placeholder: "Vender mejor, un dev de IA, una solución…" },
] as const;

export type IntakeField = (typeof INTAKE_FIELDS)[number]["id"];
export type Intake = Record<IntakeField, string>;

/** What a brain turn hands back to the voice worker: speakable text + what the cards show. */
export type BrainReply = { reply: string; shown: { tool: string; summary: string }[]; error?: string };

/** Turn a raw run error into something a person can act on (shown on screen and said by the voice). */
export function friendlyRunError(raw: string): string {
  if (/invalid_grant|invalid_rapt|reauth|Could not load the default credentials|UNAUTHENTICATED/i.test(raw))
    return "Las credenciales de Google Cloud del agente vencieron. Ejecuta `gcloud auth application-default login` y reinicia el agente.";
  if (/ECONNREFUSED|fetch failed|Failed to fetch/i.test(raw)) return "El agente (puerto 8000) no responde. Inicia `npm run dev:agent`.";
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) return "Google limitó las peticiones (cuota). Espera un momento y reintenta.";
  return `El agente falló: ${raw.slice(0, 160)}`;
}

export type IntakeFillResult = {
  ok: boolean;
  form: Intake;
  missing: IntakeField[];
  complete: boolean;
  brain?: BrainReply;
};

export type DiscoveryGuide = {
  track: string;
  questions: { id: string; label: string; question: string }[];
  clientName?: string;
  done: boolean;
};

/** Mirrors packages/agent/src/deal-brief.ts. */
export type DealBrief = {
  trigger: string;
  currentState: string;
  cost: string;
  tried: string;
  scope: string;
  targetResult: string;
  budget: string;
  timing: string;
  decisionMaker: string;
};
export type Fit = { route: "meeting" | "email" | "nurture"; reasons: string[] };
export type DiscoverySubmission = { brief: DealBrief; fit: Fit; summary: string };
export type TranscriptAnalysis = DiscoverySubmission & { clientName: string; evidence: string[] };

type Concierge = {
  /**
   * Send a user utterance (chip, audience, or chat) through CopilotKit → runtime → ADK,
   * unless LiveKit/Gemini Live is connected — then `setVoiceInput` routes it to the room.
   */
  send: (text: string) => Promise<string>;
  /** Always CopilotKit → ADK (the voice worker's `consult_brain` lands here). */
  askBrain: (text: string) => Promise<BrainReply>;
  running: boolean;
  /** While LiveKit Gemini Live is connected, route text turns to the voice worker. */
  setVoiceInput: (fn: ((text: string) => Promise<string>) | null) => void;
  intake: Intake;
  /** Set one intake field by typing. Kicks off the ADK flow once all three are filled. */
  fillIntake: (field: IntakeField, value: string) => Promise<IntakeFillResult>;
  fillIntakeFromVoice: (field: IntakeField | "clientName", value: string) => IntakeFillResult;
  /** Voice hands over all answers at once; nothing is written unless the form ends up complete. */
  submitIntake: (values: Intake, guide: Pick<DiscoveryGuide, "track" | "questions" | "clientName">) => Promise<IntakeFillResult>;
  /** Templated business questions shown on screen after intake. */
  discovery: DiscoveryGuide | null;
  /** Deal Brief → saved lead + ADK session.state, read on the next brain turn. */
  saveDiscovery: (submission: DiscoverySubmission) => { ok: true };
  deal: (DiscoverySubmission & { evidence?: string[] }) | null;
  /** Client-prep mode: the proposal is for this client, not the user. */
  clientName: string;
  email: string;
  saveEmail: (email: string) => void;
  /** Meeting analyst: transcript → Deal Brief, then the conversation continues from it. */
  analyzeTranscript: (transcript: string) => Promise<void>;
  /** Field ids written most recently (for highlight). */
  voiceFilled: IntakeField[];
  lastUser: string | null;
  lastReply: string | null;
  items: StageItem[];
  /** Last failed agent run (cleared when a run succeeds). */
  brainError: string | null;
};

const ConciergeContext = createContext<Concierge | null>(null);

type ToolCall = { id: string; function: { name: string; arguments?: string } };
type AnyMessage = { id: string; role: string; content?: unknown; toolCalls?: ToolCall[]; toolCallId?: string };

const EMPTY_INTAKE: Intake = { name: "", persona: "", lookingFor: "" };

const missingFields = (intake: Intake) => INTAKE_FIELDS.map((f) => f.id).filter((id) => !intake[id]);

const textOf = (content: unknown) =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((p) => (p && typeof p === "object" && "text" in p ? String((p as { text: unknown }).text) : "")).join("")
      : "";

/** Captions get plain text, not the agent's markdown. */
const plain = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

type Named = { name?: string; title?: string; skills?: string[]; priceUsd?: number; priceMonthly?: number };
const names = (list: unknown, n = 3) =>
  (Array.isArray(list) ? (list as Named[]) : [])
    .slice(0, n)
    .map((x) => [x.name ?? x.title, x.skills?.length ? `(${x.skills.slice(0, 2).join(", ")})` : ""].filter(Boolean).join(" "))
    .join("; ");

/** Short, factual digest of a tool result so the voice can name real matches without inventing. */
function summarizeTool(name: string, raw: unknown): string {
  const r = parseToolResult<Record<string, unknown>>(raw);
  if (!r) return "";
  switch (name) {
    case "match_community":
      return [
        `personas: ${names(r.people)}`,
        `proyectos: ${names(r.projects, 2)}`,
        `eventos: ${names(r.events, 2)}`,
      ].join(" | ");
    case "summarize_context":
      return `${r.headline ?? ""}. Retos: ${(Array.isArray(r.challenges) ? r.challenges : []).join("; ")}. ${r.askPlan ?? ""}`;
    case "build_strategy_plan":
    case "build_product_plan":
      return String(r.spoken ?? r.headline ?? "");
    case "show_discovery_guide":
      return String(r.spokenQuestions ?? "").split("\n")[0] ?? "";
    default:
      return JSON.stringify(r).slice(0, 240);
  }
}

export function ConciergeProvider({ children }: { children: React.ReactNode }) {
  const { agent } = useAgent({ agentId: "default", updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged] });
  const { copilotkit } = useCopilotKit();

  const messages = agent.messages as unknown as AnyMessage[];
  const running = agent.isRunning;

  const voiceInputRef = useRef<((text: string) => Promise<string>) | null>(null);
  const setVoiceInput = useCallback((fn: ((text: string) => Promise<string>) | null) => {
    voiceInputRef.current = fn;
  }, []);

  const [voiceLastUser, setVoiceLastUser] = useState<string | null>(null);

  // Run failures (RUN_ERROR from ADK, network) → readable message for the screen and the voice.
  const [brainError, setBrainError] = useState<string | null>(null);
  const runErrorRef = useRef<string | null>(null);
  useEffect(() => {
    const fail = (raw: string) => {
      const msg = friendlyRunError(raw);
      runErrorRef.current = msg;
      setBrainError(msg);
      console.error("Concierge: agent run failed —", raw);
    };
    const subscriber: AgentSubscriber = {
      onRunStartedEvent: () => {
        runErrorRef.current = null;
      },
      onRunErrorEvent: ({ event }) => fail(String(event.message ?? "error")),
      onRunFailed: ({ error }) => fail(error instanceof Error ? error.message : String(error)),
      onRunFinishedEvent: () => {
        if (!runErrorRef.current) setBrainError(null);
      },
    };
    // useAgent's type omits subscribe(); the instance is an AG-UI AbstractAgent.
    const sub = (agent as unknown as AbstractAgent).subscribe(subscriber);
    return () => sub.unsubscribe();
  }, [agent]);

  // CopilotKit can't overlap runs on one agent; voice, chips and form all queue here.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const askBrain = useCallback(
    (text: string): Promise<BrainReply> => {
      const content = text.trim();
      if (!content) return Promise.resolve({ reply: "", shown: [] });
      const run = queueRef.current.then(async () => {
        const id = crypto.randomUUID();
        agent.addMessage({ id, role: "user", content });
        runErrorRef.current = null;
        try {
          await copilotkit.runAgent({ agent });
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error);
          runErrorRef.current ??= friendlyRunError(raw);
          setBrainError(runErrorRef.current);
          console.error("Concierge: runAgent failed", error);
        }
        const error = runErrorRef.current ?? undefined;
        const all = agent.messages as unknown as AnyMessage[];
        const after = all.slice(all.findIndex((m) => m.id === id) + 1);
        const results = new Map(after.filter((m) => m.role === "tool" && m.toolCallId).map((m) => [m.toolCallId!, m.content]));
        const shown = after
          .flatMap((m) => (m.role === "assistant" ? (m.toolCalls ?? []) : []))
          .filter((c) => c.function.name !== "save_meeting_fact")
          .map((c) => ({ tool: c.function.name, summary: summarizeTool(c.function.name, results.get(c.id)) }));
        const replies = after.filter((m) => m.role === "assistant").map((m) => plain(textOf(m.content))).filter(Boolean);
        return { reply: replies.at(-1) ?? "", shown, error };
      });
      queueRef.current = run.catch(() => undefined);
      return run;
    },
    [agent, copilotkit],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) return "";

      // LiveKit Gemini Live session: speak through the realtime worker.
      if (voiceInputRef.current) {
        setVoiceLastUser(content);
        try {
          await voiceInputRef.current(content);
        } catch (error) {
          console.error("Concierge: LiveKit voice input failed", error);
        }
        return "";
      }

      return (await askBrain(content)).reply;
    },
    [askBrain],
  );

  // ─── Intake form (voice fills it, ADK reads it as session.state) ──────────
  const [intake, setIntake] = useState<Intake>(EMPTY_INTAKE);
  const intakeRef = useRef<Intake>(EMPTY_INTAKE);
  const kickedOffRef = useRef(false);
  const [voiceFilled, setVoiceFilled] = useState<IntakeField[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryGuide | null>(null);
  const [deal, setDeal] = useState<Concierge["deal"]>(null);
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState("");
  const dealIdRef = useRef<string>(crypto.randomUUID());

  // AG-UI state → runtime → server.ts normalizePreContext → ADK session.state.
  const pushPreContext = useCallback(
    (patch: object) => {
      // useAgent's v2 type omits AbstractAgent's state API; the instance has it.
      const stateful = agent as unknown as { state?: { preContext?: object }; setState: (state: object) => void };
      stateful.setState({ ...stateful.state, preContext: { ...stateful.state?.preContext, ...patch, dealId: dealIdRef.current } });
      // Saving must never block the conversation.
      void fetch("/api/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: dealIdRef.current, patch }),
      }).catch((error) => console.error("Concierge: lead not saved", error));
    },
    [agent],
  );

  const commitIntake = useCallback(
    (next: Intake, changed: IntakeField[]) => {
      intakeRef.current = next;
      setIntake(next);
      setVoiceFilled(changed);
      pushPreContext(next);
    },
    [pushPreContext],
  );

  const fillIntake = useCallback(
    async (field: IntakeField, value: string): Promise<IntakeFillResult> => {
      const next = { ...intakeRef.current, [field]: value.trim() };
      commitIntake(next, [field]);

      const missing = missingFields(next);
      const complete = missing.length === 0;
      if (!complete || kickedOffRef.current) return { ok: true, form: next, missing, complete };

      kickedOffRef.current = true;
      const brain = await askBrain(
        `Ya tengo mi contexto: me llamo ${next.name}, mi perfil es "${next.persona}" y busco "${next.lookingFor}". ` +
          "Busca en la comunidad las personas, skills y proyectos que mejor encajen y explícame por qué el top match encaja.",
      );
      return { ok: true, form: next, missing, complete, brain };
    },
    [commitIntake, askBrain],
  );

  /** Voice saves each answer as soon as it is said (LiveKit RPC intake.field). */
  const fillIntakeFromVoice = useCallback(
    (field: IntakeField | "clientName", value: string): IntakeFillResult => {
      // The voice drives the flow from here, so the typed-form kickoff must not fire.
      kickedOffRef.current = true;
      if (field === "clientName") {
        const name = value.trim();
        if (name) {
          setClientName(name);
          pushPreContext({ mode: "client", clientName: name });
        }
        const form = intakeRef.current;
        return { ok: true, form, missing: missingFields(form), complete: missingFields(form).length === 0 };
      }
      const next = { ...intakeRef.current, [field]: value.trim() };
      commitIntake(next, [field]);
      const missing = missingFields(next);
      return { ok: true, form: next, missing, complete: missing.length === 0 };
    },
    [commitIntake, pushPreContext],
  );

  const submitIntake = useCallback(
    async (values: Intake, guide: Pick<DiscoveryGuide, "track" | "questions" | "clientName">): Promise<IntakeFillResult> => {
      const next = { ...intakeRef.current };
      for (const { id } of INTAKE_FIELDS) next[id] = values[id]?.trim() || next[id];
      const missing = missingFields(next);
      if (missing.length) return { ok: false, form: intakeRef.current, missing, complete: false };
      // The voice drives discovery from here, so the typed-form kickoff must not fire.
      kickedOffRef.current = true;
      commitIntake(next, INTAKE_FIELDS.map((f) => f.id));
      if (guide.clientName) {
        setClientName(guide.clientName);
        pushPreContext({ mode: "client", clientName: guide.clientName });
      }
      setDiscovery((prev) => ({ ...guide, done: prev?.done ?? false }));
      return { ok: true, form: next, missing, complete: true };
    },
    [commitIntake, pushPreContext],
  );

  const saveDeal = useCallback(
    (submission: Concierge["deal"] & object) => {
      const { brief, fit, summary } = submission;
      pushPreContext({
        ...brief,
        challenge: [brief.currentState, brief.tried && `Ya probó: ${brief.tried}`].filter(Boolean).join(". "),
        building: brief.scope,
        successCriteria: brief.targetResult,
        budget: brief.budget,
        urgency: brief.timing,
        dealSummary: summary,
        fitRoute: fit.route,
      });
      setDeal(submission);
    },
    [pushPreContext],
  );

  const saveDiscovery = useCallback(
    (submission: DiscoverySubmission) => {
      saveDeal(submission);
      setDiscovery((prev) => prev && { ...prev, done: true });
      return { ok: true as const };
    },
    [saveDeal],
  );

  const saveEmail = useCallback(
    (value: string) => {
      const next = value.trim();
      setEmail(next);
      pushPreContext({ email: next });
      // The voice can't see the form, so tell it the moment the address arrives.
      if (next && voiceInputRef.current) void send(`Mi correo es ${next}.`);
    },
    [pushPreContext, send],
  );

  const emailSeeded = useRef(false);
  useEffect(() => {
    if (emailSeeded.current) return;
    emailSeeded.current = true;
    const match = document.cookie.match(/(?:^|; )cva-email=([^;]*)/);
    const fromGate = match ? decodeURIComponent(match[1]).trim() : "";
    if (fromGate) saveEmail(fromGate);
  }, [saveEmail]);

  const analyzeTranscript = useCallback(
    async (transcript: string) => {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<TranscriptAnalysis> & { error?: string };
      if (!res.ok || !data.brief || !data.fit) throw new Error(data.error ?? "No pude analizar la transcripción.");

      const analysis = data as TranscriptAnalysis;
      kickedOffRef.current = true;
      saveDeal(analysis);
      if (analysis.clientName) {
        setClientName(analysis.clientName);
        pushPreContext({ mode: "client", clientName: analysis.clientName });
      }
      await send(
        `Analicé la transcripción de la reunión${analysis.clientName ? ` con ${analysis.clientName}` : ""}. ${analysis.summary}. ` +
          `Ruta sugerida: ${analysis.fit.route}. Confírmame el resumen en dos frases y pregunta solo lo que falte.`,
      );
    },
    [saveDeal, pushPreContext, send],
  );

  useEffect(() => {
    if (!voiceFilled.length) return;
    const id = window.setTimeout(() => setVoiceFilled([]), 1600);
    return () => window.clearTimeout(id);
  }, [voiceFilled, intake]);

  const { items, lastUser, lastReply } = useMemo(() => {
    const results = new Map<string, unknown>();
    for (const m of messages) if (m.role === "tool" && m.toolCallId) results.set(m.toolCallId, m.content);

    const stage: StageItem[] = [];
    let user: string | null = null;
    let reply: string | null = null;
    for (const m of messages) {
      if (m.role === "user") {
        user = textOf(m.content);
        reply = null;
      }
      if (m.role !== "assistant") continue;
      const text = plain(textOf(m.content));
      if (text) reply = text;
      for (const call of m.toolCalls ?? []) {
        stage.push({
          id: call.id,
          name: call.function.name,
          args: parseToolResult(call.function.arguments ?? null),
          result: parseToolResult(results.get(call.id) ?? null),
          done: results.has(call.id),
        });
      }
    }
    return { items: stage.reverse(), lastUser: user, lastReply: reply };
  }, [messages]);

  // Clear the voice caption override when CopilotKit gets a newer user turn.
  useEffect(() => {
    if (lastUser) setVoiceLastUser(null);
  }, [lastUser]);

  const value = useMemo(
    () => ({
      send,
      askBrain,
      running,
      setVoiceInput,
      intake,
      fillIntake,
      fillIntakeFromVoice,
      submitIntake,
      discovery,
      saveDiscovery,
      deal,
      clientName,
      email,
      saveEmail,
      analyzeTranscript,
      voiceFilled,
      lastUser: voiceLastUser ?? lastUser,
      lastReply,
      items,
      brainError,
    }),
    [send, askBrain, running, setVoiceInput, intake, fillIntake, fillIntakeFromVoice, submitIntake, discovery, saveDiscovery, deal, clientName, email, saveEmail, analyzeTranscript, voiceFilled, voiceLastUser, lastUser, lastReply, items, brainError],
  );
  return <ConciergeContext.Provider value={value}>{children}</ConciergeContext.Provider>;
}

export function useConcierge() {
  const ctx = useContext(ConciergeContext);
  if (!ctx) throw new Error("useConcierge must be used inside <ConciergeProvider>");
  return ctx;
}
