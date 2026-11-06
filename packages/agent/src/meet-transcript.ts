/**
 * Google Meet REST API v2 — conference records → transcript entries.
 * Auth: shared google-oauth.ts (same tokens as Calendar booking).
 */

import { getGoogleAccessToken, isGoogleOAuthConfigured, MEET_SCOPES } from "./google-oauth.js";

const MEET_BASE = "https://meet.googleapis.com/v2";
export { MEET_SCOPES };
export const isMeetConfigured = isGoogleOAuthConfigured;

export type MeetConferenceSummary = {
  conferenceRecord: string;
  startTime?: string;
  endTime?: string;
  space?: string;
  meetingCode?: string;
  transcriptName?: string;
  hasTranscript: boolean;
};

type ConferenceRecord = {
  name?: string;
  startTime?: string;
  endTime?: string;
  space?: string | { meetingCode?: string; name?: string };
};

type Transcript = { name?: string; state?: string; startTime?: string };
type TranscriptEntry = {
  name?: string;
  participant?: string;
  text?: string;
  languageCode?: string;
  startTime?: string;
};

const getAccessToken = getGoogleAccessToken;

async function meetGet<T>(path: string, token: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${MEET_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Meet API ${res.status}: ${body.slice(0, 400) || res.statusText}`);
  }
  return (await res.json()) as T;
}

function normalizeConferenceId(idOrName: string): string {
  const trimmed = idOrName.trim();
  return trimmed.startsWith("conferenceRecords/") ? trimmed : `conferenceRecords/${trimmed}`;
}

/** Format Meet transcript entries into plain text for meeting-analyst. */
export function formatTranscriptEntries(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => {
      const text = (e.text ?? "").trim();
      if (!text) return "";
      const speaker = e.participant?.split("/").pop();
      return speaker ? `[${speaker}] ${text}` : text;
    })
    .filter(Boolean)
    .join("\n");
}

export async function listRecentMeetTranscripts(opts?: {
  meetingCode?: string;
  limit?: number;
  daysBack?: number;
  /** Default false: return recent meetings even without transcripts. */
  onlyWithTranscript?: boolean;
}): Promise<
  | { status: "ok"; meetings: MeetConferenceSummary[]; withTranscript: number }
  | { status: "not_configured"; message: string }
  | { status: "failed"; message: string }
> {
  const auth = await getAccessToken();
  if (auth.status !== "ok") return auth;

  const limit = Math.min(Math.max(opts?.limit ?? 8, 1), 25);
  const daysBack = opts?.daysBack ?? 30;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const filters: string[] = [`start_time>="${since}"`];
  if (opts?.meetingCode?.trim()) {
    filters.push(`space.meeting_code = "${opts.meetingCode.trim()}"`);
  }

  try {
    const list = await meetGet<{ conferenceRecords?: ConferenceRecord[] }>("conferenceRecords", auth.token, {
      pageSize: limit,
      filter: filters.join(" AND "),
    });

    const meetings: MeetConferenceSummary[] = [];
    for (const record of list.conferenceRecords ?? []) {
      if (!record.name) continue;
      const transcripts = await meetGet<{ transcripts?: Transcript[] }>(`${record.name}/transcripts`, auth.token, {
        pageSize: 5,
      });
      const first = transcripts.transcripts?.[0];
      const spaceName = typeof record.space === "string" ? record.space : record.space?.name;
      const meetingCode = typeof record.space === "object" ? record.space?.meetingCode : undefined;
      meetings.push({
        conferenceRecord: record.name,
        startTime: record.startTime,
        endTime: record.endTime,
        space: spaceName,
        meetingCode,
        transcriptName: first?.name,
        hasTranscript: Boolean(first?.name),
      });
    }

    const visible = opts?.onlyWithTranscript ? meetings.filter((m) => m.hasTranscript) : meetings;
    return {
      status: "ok",
      meetings: visible,
      withTranscript: meetings.filter((m) => m.hasTranscript).length,
    };
  } catch (err) {
    return { status: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}

/** Pull full transcript text for a conference record (first transcript, all entry pages). */
export async function fetchMeetTranscriptText(
  conferenceRecordId: string,
): Promise<
  | { status: "ok"; conferenceRecord: string; transcriptName: string; transcript: string; entryCount: number }
  | { status: "not_configured"; message: string }
  | { status: "failed"; message: string }
  | { status: "empty"; message: string; conferenceRecord: string }
> {
  const auth = await getAccessToken();
  if (auth.status !== "ok") return auth;

  const conferenceRecord = normalizeConferenceId(conferenceRecordId);

  try {
    const transcripts = await meetGet<{ transcripts?: Transcript[] }>(`${conferenceRecord}/transcripts`, auth.token, {
      pageSize: 5,
    });
    const transcriptName = transcripts.transcripts?.[0]?.name;
    if (!transcriptName) {
      return {
        status: "empty",
        conferenceRecord,
        message: "Esa reunión no tiene transcripción en Meet (¿se activó 'Transcribir'?).",
      };
    }

    const entries: TranscriptEntry[] = [];
    let pageToken: string | undefined;
    do {
      const page = await meetGet<{ transcriptEntries?: TranscriptEntry[]; nextPageToken?: string }>(
        `${transcriptName}/entries`,
        auth.token,
        { pageSize: 100, pageToken },
      );
      entries.push(...(page.transcriptEntries ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);

    const transcript = formatTranscriptEntries(entries);
    if (transcript.length < 50) {
      return {
        status: "empty",
        conferenceRecord,
        message: "La transcripción de Meet está vacía o es demasiado corta.",
      };
    }

    return {
      status: "ok",
      conferenceRecord,
      transcriptName,
      transcript,
      entryCount: entries.length,
    };
  } catch (err) {
    return { status: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}
