"use client";

import { motion } from "motion/react";
import { FINALE_DONE_EVENT, FINALE_PREVIEW_EVENT } from "./FinaleJourney";
import { useAgentSpeech } from "./spoken";
import { requestDecision, type PlanWhich } from "./voiceDecision";
import { openCalendar, pickMeetingTime } from "./CalendarTool";
import { DOCK_SPRING, useVoiceDock } from "./useVoiceDock";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useVoiceAssistant,
} from "@livekit/components-react";
import * as LiveKitReact from "@livekit/components-react";
import "@livekit/components-styles";

/**
 * Runtime export of @livekit/components-react 2.9.24, but `dist/index.d.ts` re-exports an
 * older `hooks.d.ts` that lacks it — re-typed here (agent text-stream transcriptions).
 */
const useTranscriptions = (
  LiveKitReact as unknown as {
    useTranscriptions: () => Array<{ text: string; participantInfo?: { identity?: string } }>;
  }
).useTranscriptions;
import { RoomEvent, type RpcInvocationData } from "livekit-client";
import { ACT_LABEL, type Act } from "./act";
import { CharacterStage } from "./CharacterStage";
import { REPLAY_INTRO_EVENT } from "./IntroSequence";
import {
  useConcierge,
  type DiscoveryGuide,
  type DiscoverySubmission,
  type Intake,
} from "./concierge";
import { Icon } from "./Icon";
import { LottieState, type LottieKind } from "./LottieState";
import { ORB_LABEL, type OrbState } from "./VoiceOrb";
import { VoiceWave, type VoiceLevels, type WaveMode } from "./VoiceWave";
import { useVoiceLevels } from "./useVoiceLevels";

type Session = {
  token: string;
  url: string;
  room?: string;
  agentName?: string;
};

/** Must match packages/livekit/tools.py RPC method names. */
const RPC_INTAKE_SUBMIT = "intake.submit";
const RPC_INTAKE_FIELD = "intake.field";
const RPC_DISCOVERY_SUBMIT = "discovery.submit";
const RPC_BRAIN_ASK = "brain.ask";
const RPC_PLAN_DECIDE = "plan.decide";
const RPC_FINALE = "concierge.finale";
const RPC_CALENDAR_OPEN = "calendar.open";
const RPC_CALENDAR_PICK = "calendar.pick";

const TEST_STATES: OrbState[] = ["idle", "listening", "thinking", "speaking"];
const TEST_CYCLE_MS = 2800;

/** Page-level toggles that live in the voice capsule. */
export type DockControls = {
  chatOpen: boolean;
  onToggleChat: () => void;
  hasStage: boolean;
  stageOpen: boolean;
  onToggleStage: () => void;
};

type VoiceRoomProps = {
  /** Preview character + wave without LiveKit / Gemini. */
  testMode?: boolean;
  onExitTest?: () => void;
  /** Fires when LiveKit connects / disconnects (or test mode toggles). Opens the right ContextRail. */
  onVoiceLiveChange?: (live: boolean) => void;
  controls: DockControls;
};

/** Lottie micro-animation per voice state. */
const STATE_LOTTIE: Record<OrbState, LottieKind> = {
  idle: "idle",
  listening: "listen",
  thinking: "think",
  speaking: "speak",
};

/**
 * LiveKit + Gemini Live voice stage: character in the arch, status pill, Gemini-style capsule dock.
 * `testMode` fakes the connected session so you can preview behavior.
 */
export function VoiceRoom({
  testMode = false,
  onExitTest,
  onVoiceLiveChange,
  controls,
}: VoiceRoomProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (testMode && session) setSession(null);
  }, [testMode, session]);

  useEffect(() => {
    onVoiceLiveChange?.(!!session || testMode);
  }, [session, testMode, onVoiceLiveChange]);

  const connect = async () => {
    if (testMode) return;
    setError(null);
    setHint(null);
    setJoining(true);
    try {
      const res = await fetch("/api/livekit/session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "LiveKit no disponible");
        setHint(data.hint ?? "Corre npm run dev:livekit");
        return;
      }
      setSession(data);
    } catch {
      setError("No pude pedir la sesión de LiveKit.");
    } finally {
      setJoining(false);
    }
  };

  if (testMode) {
    return <TestVoiceStage onExit={onExitTest} controls={controls} />;
  }

  if (session) {
    return (
      <LiveKitRoom
        token={session.token}
        serverUrl={session.url}
        connect
        audio
        video={false}
        onDisconnected={() => setSession(null)}
        className="absolute inset-0"
      >
        <LiveKitVoice
          room={session.room}
          onHangUp={() => setSession(null)}
          error={error}
          hint={hint}
          controls={controls}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return (
    <IdleLiveKit
      joining={joining}
      onConnect={connect}
      error={error}
      hint={hint}
      controls={controls}
    />
  );
}

/* ---------- Layout pieces ---------- */

/**
 * Avatar column. Idle: full width, avatar big in the centre. When voice starts the
 * board opens and this column springs down to the left voice column (framer-motion),
 * so the avatar glides left; the AvatarLayer tracks the arch every frame.
 */
function StageColumn({ children }: { children: React.ReactNode }) {
  const { docked, width } = useVoiceDock();
  return (
    <motion.div
      className="stage-col absolute inset-y-0 left-0 flex flex-col items-center justify-center px-6 pb-36 pt-20 md:pb-40"
      data-docked={docked ? "1" : "0"}
      initial={false}
      animate={{ width }}
      transition={DOCK_SPRING}
    >
      {children}
    </motion.div>
  );
}

function StatusPill({ state, label }: { state: OrbState; label: string }) {
  return (
    <div
      className="pill mt-6 h-10 pl-2 text-text"
      role="status"
      aria-live="polite"
    >
      <LottieState kind={STATE_LOTTIE[state]} size={30} zoom={2.6} />
      {label}
    </div>
  );
}

function Problem({
  error,
  hint,
}: {
  error: string | null;
  hint: string | null;
}) {
  if (!error && !hint) return null;
  return (
    <div className="mt-4 max-w-sm text-center" role="alert">
      {error && <p className="text-sm text-danger">{error}</p>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Gemini Live-style control bar: chat · results · blue voice pill · mic · end. */
function Dock({
  controls,
  pill,
  mic,
  end,
  above,
}: {
  controls: DockControls;
  pill: React.ReactNode;
  mic: React.ReactNode;
  end?: React.ReactNode;
  above?: React.ReactNode;
}) {
  const dock = useVoiceDock();
  return (
    <motion.div
      className="dock-wrap absolute bottom-0 left-0 z-20 flex flex-col items-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-8"
      initial={false}
      animate={{ width: dock.width }}
      transition={DOCK_SPRING}
    >
      {above}
      <div
        className="dock w-full max-w-[560px]"
        role="group"
        aria-label="Controles de voz"
      >
        <button
          type="button"
          className="cbtn"
          onClick={controls.onToggleChat}
          aria-expanded={controls.chatOpen}
          aria-controls="chat-drawer"
          aria-label={controls.chatOpen ? "Ocultar chat" : "Abrir chat"}
        >
          <Icon name="chat" />
        </button>
        {controls.hasStage && (
          <button
            type="button"
            className="cbtn"
            onClick={controls.onToggleStage}
            aria-expanded={controls.stageOpen}
            aria-label={
              controls.stageOpen ? "Ocultar resultados" : "Ver resultados"
            }
          >
            <Icon name="stage" />
          </button>
        )}
        {pill}
        {mic}
        {end}
      </div>
    </motion.div>
  );
}

/* ---------- Test mode ---------- */

/** Simulated session: auto-cycles states + fake levels so the wave moves. */
function TestVoiceStage({
  onExit,
  controls,
}: {
  onExit?: () => void;
  controls: DockControls;
}) {
  const [orbState, setOrbState] = useState<OrbState>("listening");
  const [autoPlay, setAutoPlay] = useState(true);
  const [testAct, setTestAct] = useState<Act | undefined>(undefined);
  const levelsRef = useRef<VoiceLevels>({ agent: 0, user: 0 });

  useEffect(() => {
    if (!autoPlay) return;
    const id = window.setInterval(() => {
      setOrbState((prev) => {
        const i = TEST_STATES.indexOf(prev);
        return TEST_STATES[(i + 1) % TEST_STATES.length]!;
      });
    }, TEST_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [autoPlay]);

  // Fake audio energy so VoiceWave reacts per state.
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const t = now / 1000;
      const prev = levelsRef.current;
      let agent = 0.02;
      let user = 0.02;
      if (orbState === "speaking")
        agent = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 7.2));
      else if (orbState === "listening")
        user = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(t * 5.5));
      else if (orbState === "thinking") agent = 0.12 + 0.08 * Math.sin(t * 4);
      levelsRef.current = {
        agent: prev.agent + (agent - prev.agent) * 0.2,
        user: prev.user + (user - prev.user) * 0.2,
      };
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [orbState]);

  const waveMode: WaveMode = orbState;

  return (
    <>
      <StageColumn>
        <span className="pill mb-6 h-8 text-xs">
          <Icon name="flask" size={16} />
          Modo prueba · sin LiveKit
        </span>
        <CharacterStage state={orbState} levelsRef={levelsRef} act={testAct} />
        <StatusPill state={orbState} label={ORB_LABEL[orbState]} />
      </StageColumn>
      <Dock
        controls={controls}
        above={
          <div className="grid justify-items-center gap-2">
            <div
              className="flex flex-wrap items-center justify-center gap-1.5"
              role="group"
              aria-label="Actos del avatar"
            >
              {(Object.keys(ACT_LABEL) as Act[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setTestAct(a)}
                  aria-pressed={testAct === a}
                  className="pill h-7 px-3 text-[11px]"
                >
                  {ACT_LABEL[a]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {TEST_STATES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setAutoPlay(false);
                    setOrbState(s);
                  }}
                  aria-pressed={orbState === s}
                  className="pill h-8 pl-1 text-xs"
                >
                  <LottieState
                    kind={STATE_LOTTIE[s]}
                    size={24}
                    zoom={2.6}
                    color={orbState === s ? "--primary-ink" : undefined}
                  />
                  {ORB_LABEL[s]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAutoPlay((v) => !v)}
                aria-pressed={autoPlay}
                className="pill h-8 text-xs"
              >
                Ciclo auto
              </button>
              <button type="button" onClick={() => window.dispatchEvent(new Event(REPLAY_INTRO_EVENT))} className="pill h-8 text-xs">
                Repetir intro
              </button>
              <button type="button" onClick={() => window.dispatchEvent(new Event(FINALE_PREVIEW_EVENT))} className="pill h-8 text-xs">
                Ver final
              </button>
            </div>
          </div>
        }
        pill={
          <div className="voice-pill">
            <VoiceWave
              levelsRef={levelsRef}
              mode={waveMode}
              className="h-full w-full"
            />
          </div>
        }
        mic={
          <span
            className="cbtn is-on"
            role="img"
            aria-label="Micrófono simulado"
          >
            <Icon name="mic" />
          </span>
        }
        end={
          onExit && (
            <button
              type="button"
              className="cbtn is-end"
              onClick={onExit}
              aria-label="Salir del modo prueba"
            >
              <Icon name="close" />
            </button>
          )
        }
      />
    </>
  );
}

/* ---------- Not connected ---------- */

function IdleLiveKit({
  joining,
  onConnect,
  error,
  hint,
  controls,
}: {
  joining: boolean;
  onConnect: () => void;
  error: string | null;
  hint: string | null;
  controls: DockControls;
}) {
  const idleLevels = useRef<VoiceLevels>({ agent: 0, user: 0 });
  const mode: WaveMode = joining ? "thinking" : "idle";

  return (
    <>
      <StageColumn>
        <CharacterStage
          state={joining ? "thinking" : "idle"}
          onClick={joining ? undefined : onConnect}
          label="Conectar voz"
        />
        <h2 className="mt-8 text-center text-3xl tracking-[-0.035em] md:text-[40px] md:leading-[1.05]">
          Habla con tu guía
        </h2>
        <p className="mt-3 max-w-sm text-center text-sm text-muted md:max-w-md md:text-base">
          {joining
            ? "Conectando…"
            : "Vende mejor, prepara a tu equipo antes del cliente, o encuentra skills y soluciones en la comunidad."}
        </p>
        <Problem error={error} hint={hint} />
      </StageColumn>
      <Dock
        controls={controls}
        pill={
          <button
            type="button"
            onClick={onConnect}
            disabled={joining}
            className="voice-pill flex items-center justify-center gap-3 px-5 text-sm font-medium"
            aria-label="Conectar voz"
          >
            <VoiceWave
              levelsRef={idleLevels}
              mode={mode}
              className="h-full w-14 flex-none sm:w-24"
            />
            <span className="truncate">
              {joining ? (
                "Conectando"
              ) : (
                <>
                  <span className="sm:hidden">Hablar</span>
                  <span className="hidden sm:inline">Toca para hablar</span>
                </>
              )}
            </span>
          </button>
        }
        mic={
          <button
            type="button"
            className="cbtn"
            onClick={onConnect}
            disabled={joining}
            aria-label="Activar micrófono y conectar"
          >
            <Icon name="mic" />
          </button>
        }
      />
    </>
  );
}

/* ---------- Connected ---------- */

function LiveKitVoice({
  room,
  onHangUp,
  error,
  hint,
  controls,
}: {
  room?: string;
  onHangUp: () => void;
  error: string | null;
  hint: string | null;
  controls: DockControls;
}) {
  const lkRoom = useRoomContext();
  const { running, setVoiceInput, askBrain, submitIntake, saveDiscovery, fillIntakeFromVoice, send } =
    useConcierge();
  const { state, agent } = useVoiceAssistant();
  const { setText: setAgentSpeech } = useAgentSpeech();
  const transcriptions = useTranscriptions();
  const speakerId = (agent as { identity?: string } | undefined)?.identity;

  // What she is saying right now (agent text-stream transcription) → cards light up
  // the question / item being read.
  const lastSegment =
    transcriptions.findLast((t) => t.participantInfo?.identity === speakerId)?.text ?? "";
  useEffect(() => {
    setAgentSpeech(lastSegment);
  }, [lastSegment, setAgentSpeech]);
  useEffect(() => {
    if (state === "speaking") return;
    const id = window.setTimeout(() => setAgentSpeech(""), 2500);
    return () => window.clearTimeout(id);
  }, [state, setAgentSpeech]);
  useEffect(() => () => setAgentSpeech(""), [setAgentSpeech]);
  const [isMicrophoneEnabled, setMicEnabled] = useState(true);
  const levelsRef = useVoiceLevels();
  const agentIdentity = (agent as { identity?: string } | undefined)?.identity;

  const orbState: OrbState = useMemo(
    () =>
      state === "speaking"
        ? "speaking"
        : state === "thinking" || running
          ? "thinking"
          : state === "listening"
            ? "listening"
            : "idle",
    [state, running],
  );

  const waveMode: WaveMode = !agentIdentity ? "thinking" : orbState;

  useEffect(() => {
    if (!agentIdentity) {
      setVoiceInput(null);
      return;
    }
    setVoiceInput(async (text) => {
      await lkRoom.localParticipant.performRpc({
        destinationIdentity: agentIdentity,
        method: "concierge.ask",
        payload: text.slice(0, 4000),
        responseTimeout: 60_000,
      });
      return "";
    });
    return () => setVoiceInput(null);
  }, [lkRoom, agentIdentity, setVoiceInput]);

  // LiveKit voice tools land here: RPC → CopilotKit → ADK → cards on screen.
  const bridgeRef = useRef({ askBrain, submitIntake, saveDiscovery, fillIntakeFromVoice, send });
  useEffect(() => {
    bridgeRef.current = { askBrain, submitIntake, saveDiscovery, fillIntakeFromVoice, send };
  }, [askBrain, submitIntake, saveDiscovery, fillIntakeFromVoice, send]);

  // Finale animation ended → the voice says the closing (thanks · selling · learning · DevFest).
  useEffect(() => {
    if (!agentIdentity) return;
    const onDone = () =>
      void lkRoom.localParticipant
        .performRpc({ destinationIdentity: agentIdentity, method: RPC_FINALE, payload: "", responseTimeout: 60_000 })
        .catch((error: unknown) => console.warn("Concierge: finale voice failed", error));
    window.addEventListener(FINALE_DONE_EVENT, onDone);
    return () => window.removeEventListener(FINALE_DONE_EVENT, onDone);
  }, [lkRoom, agentIdentity]);

  useEffect(() => {
    // Voice approve / reject: light up + press the A2UI button; fall back to the same text message.
    lkRoom.registerRpcMethod(
      RPC_PLAN_DECIDE,
      async ({ payload }: RpcInvocationData) => {
        const { which, approved } = JSON.parse(payload) as { which: PlanWhich; approved: boolean };
        const pressed = await requestDecision(which, approved);
        if (!pressed) {
          const product = which === "product";
          void bridgeRef.current.send(
            approved
              ? product ? "Apruebo el plan de producto. Continúa." : "Apruebo el plan. Continúa."
              : product ? "Rechazo el plan de producto: necesito ajustar. Ajustémoslo." : "Rechazo el plan: necesito ajustar. Ajustémoslo.",
          );
        }
        return JSON.stringify({ ok: true, pressed });
      },
    );
    // Calendar straight from the voice (no brain round-trip): open it, or light up a time and book it.
    lkRoom.registerRpcMethod(RPC_CALENDAR_OPEN, async () => JSON.stringify({ ok: true, slots: await openCalendar() }));
    lkRoom.registerRpcMethod(RPC_CALENDAR_PICK, async ({ payload }: RpcInvocationData) => {
      const { datetime } = JSON.parse(payload) as { datetime: string };
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(datetime ?? ""))
        return JSON.stringify({ ok: false, status: "invalid_datetime", reply: "Fecha u hora inválida (usa ISO con zona, ej. 2026-11-07T12:00:00-05:00)." });
      return JSON.stringify(await pickMeetingTime(datetime));
    });
    // One answer at a time: the voice saves each field as soon as it is said.
    lkRoom.registerRpcMethod(
      RPC_INTAKE_FIELD,
      async ({ payload }: RpcInvocationData) => {
        const { field, value } = JSON.parse(payload) as {
          field: "name" | "persona" | "lookingFor" | "clientName";
          value: string;
        };
        return JSON.stringify(bridgeRef.current.fillIntakeFromVoice(field, value));
      },
    );
    lkRoom.registerRpcMethod(
      RPC_INTAKE_SUBMIT,
      async ({ payload }: RpcInvocationData) => {
        const { intake, discovery } = JSON.parse(payload) as {
          intake: Intake;
          discovery: Pick<DiscoveryGuide, "track" | "questions" | "clientName">;
        };
        return JSON.stringify(
          await bridgeRef.current.submitIntake(intake, discovery),
        );
      },
    );
    lkRoom.registerRpcMethod(
      RPC_DISCOVERY_SUBMIT,
      async ({ payload }: RpcInvocationData) => {
        return JSON.stringify(
          bridgeRef.current.saveDiscovery(
            JSON.parse(payload) as DiscoverySubmission,
          ),
        );
      },
    );
    lkRoom.registerRpcMethod(
      RPC_BRAIN_ASK,
      async ({ payload }: RpcInvocationData) => {
        const { request } = JSON.parse(payload) as { request: string };
        return JSON.stringify(await bridgeRef.current.askBrain(request));
      },
    );
    return () => {
      lkRoom.unregisterRpcMethod(RPC_PLAN_DECIDE);
      lkRoom.unregisterRpcMethod(RPC_CALENDAR_OPEN);
      lkRoom.unregisterRpcMethod(RPC_CALENDAR_PICK);
      lkRoom.unregisterRpcMethod(RPC_INTAKE_FIELD);
      lkRoom.unregisterRpcMethod(RPC_INTAKE_SUBMIT);
      lkRoom.unregisterRpcMethod(RPC_DISCOVERY_SUBMIT);
      lkRoom.unregisterRpcMethod(RPC_BRAIN_ASK);
    };
  }, [lkRoom]);

  // Mic button mirrors the local track; mute/unmute can also come from elsewhere (device loss, permissions).
  useEffect(() => {
    const sync = () =>
      setMicEnabled(lkRoom.localParticipant.isMicrophoneEnabled);
    sync();
    lkRoom
      .on(RoomEvent.TrackMuted, sync)
      .on(RoomEvent.TrackUnmuted, sync)
      .on(RoomEvent.LocalTrackPublished, sync)
      .on(RoomEvent.LocalTrackUnpublished, sync);
    return () => {
      lkRoom
        .off(RoomEvent.TrackMuted, sync)
        .off(RoomEvent.TrackUnmuted, sync)
        .off(RoomEvent.LocalTrackPublished, sync)
        .off(RoomEvent.LocalTrackUnpublished, sync);
    };
  }, [lkRoom]);

  const shownState: OrbState = agentIdentity ? orbState : "thinking";
  const label = !agentIdentity ? "Esperando al agente…" : ORB_LABEL[orbState];

  return (
    <>
      <StageColumn>
        <CharacterStage state={shownState} levelsRef={levelsRef} />
        <StatusPill state={shownState} label={label} />
        <Problem error={error} hint={hint} />
      </StageColumn>
      <Dock
        controls={controls}
        above={
          <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Gemini Live{room ? ` · ${room}` : ""}
          </span>
        }
        pill={
          <div className="voice-pill">
            <VoiceWave
              levelsRef={levelsRef}
              mode={waveMode}
              className="h-full w-full"
            />
          </div>
        }
        mic={
          <button
            type="button"
            className={`cbtn ${isMicrophoneEnabled ? "is-on" : ""}`}
            onClick={() =>
              void lkRoom.localParticipant
                .setMicrophoneEnabled(!isMicrophoneEnabled)
                .then(() =>
                  setMicEnabled(lkRoom.localParticipant.isMicrophoneEnabled),
                )
                .catch(() =>
                  setMicEnabled(lkRoom.localParticipant.isMicrophoneEnabled),
                )
            }
            aria-pressed={isMicrophoneEnabled}
            aria-label={
              isMicrophoneEnabled ? "Silenciar micrófono" : "Activar micrófono"
            }
          >
            <Icon name={isMicrophoneEnabled ? "mic" : "micOff"} />
          </button>
        }
        end={
          <button
            type="button"
            className="cbtn is-end"
            onClick={() => {
              lkRoom.disconnect();
              onHangUp();
            }}
            aria-label="Colgar"
          >
            <Icon name="close" />
          </button>
        }
      />
    </>
  );
}
