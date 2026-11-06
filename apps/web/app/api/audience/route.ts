import { NextResponse } from "next/server";

// In-memory audience votes for the live talk demo (single-instance only).
// Swap for Supabase/Firebase realtime when you need multi-instance.
type Vote = { persona: string; product: string; objection?: string; ts: number };
const store: { votes: Vote[] } = (globalThis as unknown as { __audience?: { votes: Vote[] } }).__audience ??= { votes: [] };

export async function GET() {
  const counts = (key: "persona" | "product" | "objection") =>
    Object.entries(
      store.votes.reduce<Record<string, number>>((acc, v) => {
        const val = v[key];
        if (val) acc[val] = (acc[val] ?? 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
  return NextResponse.json({ total: store.votes.length, persona: counts("persona"), product: counts("product"), objection: counts("objection"), votes: store.votes.slice(-20) });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Vote>;
  if (!body.persona || !body.product) return NextResponse.json({ error: "persona and product required" }, { status: 400 });
  store.votes.push({ persona: body.persona, product: body.product, objection: body.objection, ts: Date.now() });
  return NextResponse.json({ ok: true, total: store.votes.length });
}

export async function DELETE() {
  store.votes = [];
  return NextResponse.json({ ok: true });
}
