// Server-side auth endpoint.
//   GET    → the current session's user (or null)
//   POST   → sign in by phone; issues the signed httpOnly session cookie
//   DELETE → sign out; clears the cookie
// Phone-only, server-verified: the account must exist in the server store.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUserById, getUserByPhone } from "@/lib/data/server/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sessionCookie,
  signSession,
  verifySession,
} from "@/lib/data/server/auth";
import type { Role } from "@/lib/data";

export const dynamic = "force-dynamic";

const PLATFORM_ROLES: Role[] = ["superadmin", "marketing", "service"];

function isSecure(req: NextRequest): boolean {
  return (
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https"
  );
}

export async function GET(req: NextRequest) {
  const userId = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const user = userId ? await getUserById(userId) : undefined;
  return NextResponse.json({ user: user ?? null });
}

export async function POST(req: NextRequest) {
  let body: { phone?: string; scope?: "hostel" | "platform" };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  if (!phone) {
    return NextResponse.json({ error: "Enter your phone number." }, { status: 400 });
  }
  const scope = body.scope === "platform" ? "platform" : "hostel";
  const user = await getUserByPhone(phone);

  // Uniform 401s — don't reveal which numbers exist.
  if (!user) {
    return NextResponse.json(
      {
        error:
          scope === "platform"
            ? "No platform-team account with this number."
            : "No account found with this phone number — check the number or create an account.",
      },
      { status: 401 }
    );
  }
  const isPlatform = PLATFORM_ROLES.includes(user.role);
  if (scope === "platform" && !isPlatform) {
    return NextResponse.json(
      { error: "No platform-team account with this number. Hostel accounts sign in on the main page." },
      { status: 401 }
    );
  }
  if (scope === "hostel" && isPlatform) {
    return NextResponse.json(
      { error: "Platform team signs in on the platform page." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ user });
  res.cookies.set(sessionCookie(signSession(user.id), SESSION_MAX_AGE, isSecure(req)));
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie("", 0, isSecure(req)));
  return res;
}
