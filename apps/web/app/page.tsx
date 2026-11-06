"use client";

import { CopilotChat, UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarTool } from "./components/CalendarTool";
import { CommunityCards } from "./components/CommunityCards";
import { ContextRail } from "./components/ContextRail";
import { deliveryFrom, FAREWELL_MS, FINALE_DONE_EVENT, FINALE_PREVIEW_EVENT, FinaleCaption, FinaleJourney, type Delivery } from "./components/FinaleJourney";
import { Icon } from "./components/Icon";
import { IntroSequence } from "./components/IntroSequence";
import { ConciergeProvider, useConcierge } from "./components/concierge";
import { SpeechProvider } from "./components/spoken";
import { ThemeToggle } from "./components/ThemeToggle";
import { VoiceRoom } from "./components/VoiceRoom";

export default function Home() {
  return (
    <ConciergeProvider>
      <SpeechProvider>
        <Concierge />
      </SpeechProvider>
    </ConciergeProvider>
  );
}

function Concierge() {
  const { items } = useConcierge();
  const { agent } = useAgent({ agentId: "default", updates: [UseAgentUpdate.OnMessagesChanged] });
  const [chatOpen, setChatOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [voiceLive, setVoiceLive] = useState(false);
  const [finale, setFinale] = useState<Delivery | null>(null);
  const [closing, setClosing] = useState<Delivery | null>(null);

  const hasA2ui = useMemo(
    () =>
      ((agent.messages ?? []) as Array<{ activityType?: string; role?: string }>).some(
        (m) =>
          m.activityType === "a2ui-surface" ||
          (m.role === "activity" && String(m.activityType ?? "").includes("a2ui")),
      ),
    [agent.messages],
  );

  const hasStage =
    hasA2ui ||
    items.some(
      (i) =>
        i.name === "build_strategy_plan" ||
        (i.name !== "open_calendar" && i.name !== "save_meeting_fact" && i.name !== "approve_plan" && i.name !== "assess_context"),
    );

  // Finale: once the plan email is sent or the meeting is booked (mock for now), play the journey.
  // items are newest-first → the latest send / booking.
  const lastDelivery = items.find((i) => i.name === "send_plan_email" || i.name === "book_meeting");
  const delivery = deliveryFrom(lastDelivery);
  // The moment a send / booking starts, the board and chat get out of the way (no cards flash
  // before the finale); the finale plays as soon as the result lands.
  const deliveryId = lastDelivery?.id ?? null;
  const [seenDeliveryId, setSeenDeliveryId] = useState<string | null>(null);
  if (deliveryId !== seenDeliveryId) {
    setSeenDeliveryId(deliveryId);
    if (deliveryId) {
      setRailOpen(false);
      setChatOpen(false);
    }
  }
  // Send / booking finished but did NOT go out (needs confirmation / email, failed): no finale,
  // so bring the board back instead of leaving an empty screen.
  const failedDeliveryId = lastDelivery?.done && !delivery ? lastDelivery.id : null;
  const [seenFailedId, setSeenFailedId] = useState<string | null>(null);
  if (failedDeliveryId !== seenFailedId) {
    setSeenFailedId(failedDeliveryId);
    if (failedDeliveryId) setRailOpen(true);
  }
  const playedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!delivery || !lastDelivery || playedRef.current === lastDelivery.id) return;
    playedRef.current = lastDelivery.id;
    const id = window.setTimeout(() => {
      setFinale(delivery);
      setRailOpen(false);
      setChatOpen(false);
    }, 150);
    return () => window.clearTimeout(id);
  }, [delivery, lastDelivery]);

  // Test mode "Ver final" button.
  useEffect(() => {
    const preview = () => {
      setFinale({ kind: "email", to: "cliente@demo.devfest", subject: "Plan para tu reunión con Retail Co", mock: true });
      setRailOpen(false);
      setChatOpen(false);
    };
    window.addEventListener(FINALE_PREVIEW_EVENT, preview);
    return () => window.removeEventListener(FINALE_PREVIEW_EVENT, preview);
  }, []);

  // Avatar hides during the finale (only the voice dock stays, centred).
  useEffect(() => {
    if (!finale) return;
    document.documentElement.setAttribute("data-finale", "1");
    return () => document.documentElement.removeAttribute("data-finale");
  }, [finale]);

  // Check done → avatar back in the centre with goodbye lines while the voice closes.
  const finaleRef = useRef<Delivery | null>(null);
  useEffect(() => {
    if (finale) finaleRef.current = finale;
  }, [finale]);
  const endFinale = useCallback(() => {
    setClosing(finaleRef.current);
    setFinale(null);
    setRailOpen(false);
    window.dispatchEvent(new Event(FINALE_DONE_EVENT)); // voice says the closing lines
  }, []);
  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(() => setClosing(null), FAREWELL_MS);
    return () => window.clearTimeout(id);
  }, [closing]);

  // Right rail opens when voice starts, or when generative results / plan approval land.
  useEffect(() => {
    if (voiceLive || testMode || hasStage) setRailOpen(true);
  }, [voiceLive, testMode, hasStage]);

  // New cards asked for at any stage (community / products / plan): bring the board back if it was closed.
  const newestCard = items.find((i) => ["match_community", "summarize_context", "build_strategy_plan", "build_product_plan"].includes(i.name));
  const newestCardId = newestCard?.id ?? null;
  const [seenCardId, setSeenCardId] = useState<string | null>(null);
  if (newestCardId !== seenCardId) {
    setSeenCardId(newestCardId);
    if (newestCardId && !finale) setRailOpen(true);
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-rail", railOpen ? "1" : "0");
    return () => document.documentElement.removeAttribute("data-rail");
  }, [railOpen]);

  useEffect(() => {
    if (!chatOpen && !railOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setChatOpen(false);
      setRailOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, railOpen]);

  return (
    <>
      {/* Generative UI renderers stay mounted (chat closed is fine). Plan approve is an A2UI surface. */}
      <CalendarTool />
      <CommunityCards />
      <IntroSequence />

      {/* Backdrop (behind the avatar layer): SETI print grain + moving print border. */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="seti-texture pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="edge-wake pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="edge-wake-mesh edge-wake-ring" />
          <div className="edge-wake-mesh edge-wake-corner edge-wake-tl" />
          <div className="edge-wake-mesh edge-wake-corner edge-wake-tr" />
          <div className="edge-wake-mesh edge-wake-corner edge-wake-bl" />
          <div className="edge-wake-mesh edge-wake-corner edge-wake-br" />
          <div className="edge-wake-wash" />
        </div>
      </div>

      {/* main sits above the avatar layer (z-1), transparent so she shows through; body paints --bg. */}
      <main className="fixed inset-0 z-[2] overflow-hidden text-text">
        <header className="reveal-1 absolute inset-x-0 top-0 z-30 flex min-h-[3.75rem] items-center justify-between gap-3 px-4 py-3 md:min-h-[5rem] md:px-8 md:pr-24">
          <h1 className="blue-tile flex h-10 items-center gap-2.5 rounded-full pl-3.5 pr-4 text-[15px] font-medium tracking-[-0.01em] md:h-12 md:pl-4 md:pr-5 md:text-lg">
            <Icon name="spark" filled size={18} />
            Concierge
            <span className="sr-only">· guía comercial de la comunidad</span>
          </h1>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setTestMode((v) => !v)} aria-pressed={testMode} className="pill">
              <Icon name="flask" size={16} />
              <span className="hidden sm:inline">Modo prueba</span>
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Avatar stays center-big; when the rail opens she eases left via CSS (data-rail). */}
        <VoiceRoom
          testMode={testMode}
          onExitTest={() => setTestMode(false)}
          onVoiceLiveChange={setVoiceLive}
          controls={{
            chatOpen,
            onToggleChat: () => setChatOpen((o) => !o),
            hasStage: voiceLive || testMode || hasStage,
            stageOpen: railOpen,
            onToggleStage: () => setRailOpen((o) => !o),
          }}
        />

        {finale && <FinaleJourney delivery={finale} onDone={endFinale} />}
        <AnimatePresence>{closing && !finale && <FinaleCaption key="closing" delivery={closing} />}</AnimatePresence>

        <ContextRail open={railOpen} onClose={() => setRailOpen(false)} voiceLive={voiceLive || testMode} />
      </main>

      <aside
        id="chat-drawer"
        aria-label="Chat"
        aria-hidden={!chatOpen}
        className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface transition-transform duration-[320ms] ease-[var(--ease-out-soft)] sm:w-[420px] ${
          chatOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg">Chat</h2>
          <button type="button" onClick={() => setChatOpen(false)} className="cbtn cbtn-sm" aria-label="Cerrar chat">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">{chatOpen && <CopilotChat agentId="default" />}</div>
      </aside>
    </>
  );
}
