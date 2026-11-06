import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

// Issues a LiveKit room token for Gemini Live voice (browser → room → worker).
export async function POST(req: Request) {
  const { room = "commercial-demo", identity = `guest-${Date.now()}` } = (await req.json().catch(() => ({}))) as {
    room?: string;
    identity?: string;
  };
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret)
    return NextResponse.json({ error: "LiveKit not configured (LIVEKIT_API_KEY/SECRET)." }, { status: 501 });

  const token = new AccessToken(apiKey, apiSecret, { identity, ttl: "1h" });
  token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  return NextResponse.json({ token: await token.toJwt(), url: process.env.NEXT_PUBLIC_LIVEKIT_URL });
}
