"use client";

import { useFrontendTool } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useConcierge } from "./concierge";
import { Icon } from "./Icon";

/** Colombia has no DST: every slot is -05:00. */
const TZ = "-05:00";
const HOURS = ["09:30", "12:00", "15:00", "17:00"];
const WEEKDAY = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export type Slot = { iso: string; label: string };
/** What booking returned (book_meeting via the brain). */
export type BookingResult = { ok: boolean; status: string; reply: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** Next two working days in Bogotá, four times each, as exact ISO datetimes. */
function upcomingSlots(now = new Date()): Slot[] {
  // Today's date in Bogotá.
  const bog = new Date(now.getTime() + (now.getTimezoneOffset() - 300) * 60_000);
  const days: Date[] = [];
  for (let d = 1; days.length < 2 && d < 8; d += 1) {
    const day = new Date(bog.getFullYear(), bog.getMonth(), bog.getDate() + d);
    if (day.getDay() !== 0 && day.getDay() !== 6) days.push(day);
  }
  return days.flatMap((day) =>
    HOURS.map((h) => ({
      iso: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${h}:00${TZ}`,
      label: `${WEEKDAY[day.getDay()]} ${day.getDate()} · ${h}`,
    })),
  );
}

/** "2026-11-07T12:00:00-05:00" → "Viernes 7 · 12:00" (Bogotá wall time from the ISO itself). */
export function labelFor(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return iso;
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${WEEKDAY[day.getDay()]} ${day.getDate()} · ${m[4]}:${m[5]}`;
}

/* ---------- Voice → calendar bridge (LiveKit RPC calendar.open / calendar.pick) ---------- */

type Command =
  | { kind: "open"; resolve: (slots: Slot[]) => void }
  | { kind: "pick"; iso: string; resolve: (r: BookingResult) => void };
let listener: ((c: Command) => void) | null = null;

/** Voice: open the calendar right away (no brain round-trip). Resolves with the offered slots. */
export function openCalendar(): Promise<Slot[]> {
  return new Promise((resolve) => (listener ? listener({ kind: "open", resolve }) : resolve([])));
}

/** Voice: highlight `iso` in the calendar, close it and book it. Resolves with the booking result. */
export function pickMeetingTime(iso: string): Promise<BookingResult> {
  return new Promise((resolve) =>
    listener ? listener({ kind: "pick", iso, resolve }) : resolve({ ok: false, status: "no_calendar", reply: "" }),
  );
}

const PICK_HIGHLIGHT_MS = 1600;

export function CalendarTool() {
  const [isOpen, setIsOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const { askBrain } = useConcierge();

  const open = useCallback(() => {
    const list = upcomingSlots();
    setSlots(list);
    setSelected(null);
    setBooking(false);
    setIsOpen(true);
    return list;
  }, []);

  /** Book through the brain with an exact ISO datetime (book_meeting) → the finale plays on success. */
  const book = useCallback(
    async (iso: string): Promise<BookingResult> => {
      setIsOpen(false);
      const res = await askBrain(`Reserva la reunión: horario ${iso}. Usa book_meeting con ese datetime exacto.`);
      const meeting = res.shown.find((s) => s.tool === "book_meeting");
      const status = meeting?.summary.match(/"status":"([a-z_]+)"/)?.[1] ?? (res.error ? "failed" : "unknown");
      return { ok: status === "booked" || status === "ok", status, reply: res.reply };
    },
    [askBrain],
  );

  useFrontendTool({
    name: "open_calendar",
    description: "Abre el calendario para que el usuario agende una reunión.",
    parameters: z.object({ reason: z.string().describe("Motivo de la reunión") }),
    handler: async ({ reason }: { reason: string }) => {
      const list = open();
      return `Calendario abierto para: ${reason}. Horarios: ${list.map((s) => `${s.label} (${s.iso})`).join("; ")}. Esperando selección.`;
    },
  });

  // Voice commands.
  const timers = useRef<number[]>([]);
  useEffect(() => {
    listener = (c) => {
      if (c.kind === "open") {
        c.resolve(open());
        return;
      }
      // Pick: open if needed, add the slot if it is not one of ours, light it up, then book.
      const list = isOpen && slots.length ? slots : open();
      if (!list.some((s) => s.iso === c.iso)) setSlots([...list, { iso: c.iso, label: labelFor(c.iso) }]);
      setIsOpen(true);
      setSelected(c.iso);
      setBooking(true);
      timers.current.push(window.setTimeout(() => void book(c.iso).then(c.resolve), PICK_HIGHLIGHT_MS));
    };
    return () => {
      listener = null;
    };
  }, [open, book, isOpen, slots]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Agenda tu reunión">
      <div className="rise w-full max-w-md rounded-[32px] border border-line bg-surface p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-12 flex-none place-items-center rounded-2xl bg-raise text-signal">
            <Icon name="calendar" size={22} />
          </span>
          <div>
            <p className="eyebrow">Reunión · 30 min · hora Colombia</p>
            <h2 className="mt-1.5 text-2xl">Agenda tu reunión</h2>
          </div>
        </div>
        <div className="mt-5 grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
          {slots.map((slot) => {
            const on = selected === slot.iso;
            return (
              <button
                key={slot.iso}
                onClick={() => setSelected(slot.iso)}
                disabled={booking}
                aria-pressed={on}
                className={`rounded-full px-4 py-3 text-left text-sm tabular-nums transition-[background,box-shadow,transform] duration-[220ms] ${
                  on ? "scale-[1.03] bg-primary text-primary-ink shadow-[0_0_0_4px_rgba(47,107,255,0.35)]" : "bg-raise text-text hover:bg-line"
                }`}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setIsOpen(false)} disabled={booking} className="btn btn-quiet flex-1">
            Cancelar
          </button>
          <button disabled={!selected || booking} onClick={() => selected && void book(selected)} className="btn btn-blue flex-1">
            {booking ? "Agendando…" : `Confirmar ${selected ? labelFor(selected) : ""}`}
          </button>
        </div>
        {selected && (
          <p className="mt-3 text-sm text-good" role="status">
            {booking ? `Agendando ${labelFor(selected)}…` : `Seleccionaste ${labelFor(selected)}.`}
          </p>
        )}
      </div>
    </div>
  );
}
