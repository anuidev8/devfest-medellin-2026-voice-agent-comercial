import { NextResponse } from "next/server";
import { EMAIL_COOKIE, GATE_COOKIE, gateCookieOptions, gateEnabled, passwordMatches, signGate } from "../../../lib/gate";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!gateEnabled()) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL.test(email) || !passwordMatches(body.password ?? "")) {
    return NextResponse.json({ error: "Correo o contraseña no válidos." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, email });
  res.cookies.set(GATE_COOKIE, signGate(email), gateCookieOptions());
  res.cookies.set(EMAIL_COOKIE, email, { ...gateCookieOptions(), httpOnly: false });
  return res;
}
