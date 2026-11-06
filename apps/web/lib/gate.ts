import { createHmac, timingSafeEqual } from "node:crypto";

export const GATE_COOKIE = "cva-gate";
export const EMAIL_COOKIE = "cva-email";
const MAX_AGE = 60 * 60 * 24 * 14;

export function gateEnabled() {
  return Boolean(process.env.SITE_PASSWORD);
}

export function passwordMatches(input: string) {
  const expected = process.env.SITE_PASSWORD ?? "";
  if (!expected || !input) return false;
  const a = createHmac("sha256", "cva-gate").update(input).digest();
  const b = createHmac("sha256", "cva-gate").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function signGate(email: string) {
  const secret = process.env.SITE_PASSWORD ?? "";
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readGate(token: string | undefined): { email: string } | null {
  const secret = process.env.SITE_PASSWORD;
  if (!secret || !token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { email?: string; exp?: number };
    if (!data.email || !data.exp || data.exp < Date.now()) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

export function gateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}
