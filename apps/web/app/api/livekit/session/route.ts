import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";

/**
 * LiveKit voice session (no ADK here).
 *
 *   Browser joins LiveKit room
 *           ↓
 *   packages/livekit Python agent (Gemini Live via LiveKit Inference)
 *           ↓ RPC
 *   Browser CopilotKit → AG-UI → Google ADK brain
 */
export async function POST() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_URL;
  const agentName = process.env.LIVEKIT_AGENT_NAME ?? "noshy_concierge";

  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json(
      {
        error: "LiveKit not configured",
        hint: "Set LIVEKIT_API_KEY / LIVEKIT_API_SECRET / NEXT_PUBLIC_LIVEKIT_URL in apps/web/.env.local",
      },
      { status: 501 },
    );
  }

  const room = `noshy-${Date.now().toString(36)}`;
  const identity = `caller-${Date.now().toString(36)}`;

  try {
    const host = url.replace(/^ws/, "http");
    const dispatch = new AgentDispatchClient(host, apiKey, apiSecret);
    await dispatch.createDispatch(room, agentName, {
      metadata: JSON.stringify({ user_id: identity, session_id: room }),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Agent dispatch failed",
        hint: `Start the LiveKit worker: npm run dev:livekit  (agentName=${agentName})`,
      },
      { status: 502 },
    );
  }

  const token = new AccessToken(apiKey, apiSecret, { identity, ttl: "1h" });
  token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  return NextResponse.json({
    token: await token.toJwt(),
    url,
    room,
    mode: "livekit-agent",
    agentName,
  });
}
