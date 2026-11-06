"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * What the voice agent is saying right now (LiveKit agent transcription, set by VoiceRoom).
 * Cards use it to light up the question / item being read aloud.
 * Default context = no speech, so components work outside the provider (tests, chat).
 */
type Speech = { text: string; setText: (text: string) => void };

const SpeechContext = createContext<Speech>({ text: "", setText: () => {} });

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState("");
  const value = useMemo(() => ({ text, setText }), [text]);
  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export const useAgentSpeech = () => useContext(SpeechContext);

const STOP = new Set([
  "para", "como", "cómo", "que", "qué", "este", "esta", "esto", "estos", "estas", "tienes", "tiene", "sobre",
  "porque", "pero", "cuál", "cual", "cuando", "cuándo", "donde", "dónde", "quien", "quién", "unos", "unas",
  "ellos", "ellas", "nuestro", "nuestra", "tu", "tus", "sus", "hoy", "muy", "más", "mas", "algo", "todo",
]);

/** Lowercase, strip accents/punctuation, keep meaningful words (≥4 chars, no stopwords). */
export function keywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
  return new Set(words);
}

/**
 * Index of the candidate the speech is reading (best keyword overlap), or -1.
 * Score = shared keywords / candidate keywords; needs ≥2 shared words (or 1 for very short candidates).
 */
export function spokenIndex(speech: string, candidates: string[]): number {
  if (!speech.trim() || !candidates.length) return -1;
  const said = keywords(speech);
  if (!said.size) return -1;
  let best = -1;
  let bestScore = 0;
  candidates.forEach((c, i) => {
    const kw = keywords(c);
    if (!kw.size) return;
    let shared = 0;
    for (const w of kw) if (said.has(w)) shared += 1;
    const enough = shared >= 2 || (kw.size <= 2 && shared >= 1);
    const score = shared / kw.size;
    if (enough && score >= 0.34 && score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/** Hook form: which of `candidates` is being read right now (-1 = none). */
export function useSpokenIndex(candidates: string[]): number {
  const { text } = useAgentSpeech();
  const key = candidates.join("\u0001");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => spokenIndex(text, candidates), [text, key]);
}
