import { NextResponse } from "next/server";

const AGENT_ORIGIN = new URL(process.env.ADK_AG_UI_URL ?? "http://localhost:8000/ag-ui").origin;

/** Browser → agent server, so the agent URL stays server-side. */
export async function POST(request: Request) {
  try {
    const res = await fetch(`${AGENT_ORIGIN}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      cache: "no-store",
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "No pude conectar con el agente." }, { status: 502 });
  }
}
