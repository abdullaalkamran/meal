import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Fast, optimistic redirect for the common case of hitting a protected
// segment with no session at all. This is UX polish only — not a security
// boundary — since there's no real backend/auth yet; the authoritative
// check is RoleGuard on the client, which also knows about the
// manager-viewing-as-student case this proxy doesn't need to understand.
const PROTECTED_PREFIXES = ["/student", "/manager", "/owner", "/cook"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !request.cookies.get("herp_role")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/manager/:path*", "/owner/:path*", "/cook/:path*"],
};
