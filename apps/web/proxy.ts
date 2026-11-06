import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateEnabled, readGate } from "./lib/gate";

const OPEN = ["/entrar", "/api/gate"];

export function proxy(request: NextRequest) {
  if (!gateEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (OPEN.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return NextResponse.next();

  if (!readGate(request.cookies.get(GATE_COOKIE)?.value)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Necesitas entrar." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
