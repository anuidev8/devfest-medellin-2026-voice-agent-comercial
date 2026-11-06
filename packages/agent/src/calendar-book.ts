/**
 * Google Calendar API — create event with Google Meet link.
 * Requires calendar.events scope (re-run npm run auth:meet after adding the scope).
 */
import { randomUUID } from "node:crypto";
import { getGoogleAccessToken } from "./google-oauth.js";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export type BookMeetInput = {
  /** ISO-8601 or any Date.parse-able string */
  datetime: string;
  durationMinutes?: number;
  title?: string;
  description?: string;
  attendeeEmails?: string[];
  timeZone?: string;
};

export type BookMeetResult =
  | {
      status: "ok";
      eventId: string;
      htmlLink?: string;
      meetUrl?: string;
      start: string;
      end: string;
      attendees: string[];
    }
  | { status: "not_configured"; message: string }
  | { status: "invalid_datetime"; message: string }
  | { status: "failed"; message: string };

function resolveWindow(datetime: string, durationMinutes: number, timeZone: string) {
  const start = new Date(datetime);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function meetUrlFromEvent(event: {
  hangoutLink?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
}): string | undefined {
  const fromEntry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri;
  return fromEntry || event.hangoutLink;
}

/** Create a Calendar event on the authenticated user's primary calendar + Meet link. */
export async function bookGoogleMeet(input: BookMeetInput): Promise<BookMeetResult> {
  const auth = await getGoogleAccessToken();
  if (auth.status !== "ok") return auth;

  const durationMinutes = Math.min(Math.max(input.durationMinutes ?? 30, 15), 180);
  const timeZone = input.timeZone || process.env.GOOGLE_CALENDAR_TIMEZONE || "America/Bogota";
  const window = resolveWindow(input.datetime, durationMinutes, timeZone);
  if (!window) {
    return {
      status: "invalid_datetime",
      message: `No pude interpretar la fecha/hora "${input.datetime}". Usa ISO, ej. 2026-11-05T15:00:00-05:00`,
    };
  }

  const attendees = [...new Set((input.attendeeEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))].map(
    (email) => ({ email }),
  );

  const body = {
    summary: input.title || "Reunión NoShy",
    description: input.description || "Reunión agendada por NoShy Concierge.",
    start: window.start,
    end: window.end,
    attendees,
    conferenceData: {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  try {
    const url = new URL(`${CALENDAR_BASE}/calendars/primary/events`);
    url.searchParams.set("conferenceDataVersion", "1");
    url.searchParams.set("sendUpdates", attendees.length ? "all" : "none");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
      error?: { message?: string };
    };

    if (!res.ok || !json.id) {
      const msg = json.error?.message ?? `Calendar API ${res.status}`;
      if (/insufficient|scope|auth/i.test(msg)) {
        return {
          status: "not_configured",
          message: `${msg}. Añade scope calendar.events en Acceso a los datos y vuelve a correr npm run auth:meet.`,
        };
      }
      return { status: "failed", message: msg };
    }

    return {
      status: "ok",
      eventId: json.id,
      htmlLink: json.htmlLink,
      meetUrl: meetUrlFromEvent(json),
      start: window.startIso,
      end: window.endIso,
      attendees: attendees.map((a) => a.email),
    };
  } catch (err) {
    return { status: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}
