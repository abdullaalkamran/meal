import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Fast, optimistic redirect for the common case of hitting a protected
// segment with no session cookie at all. Presence-only (it doesn't verify the
// signature — that happens server-side in /api/auth and /api/rpc, and
// RoleGuard on the client does the role-appropriate redirect); this is just to
// avoid flashing a protected shell to a signed-out visitor.
const PROTECTED_PREFIXES = ["/student", "/manager", "/owner", "/cook"];
const SESSION_COOKIE = "herp_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !request.cookies.get(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/manager/:path*", "/owner/:path*", "/cook/:path*"],
};
