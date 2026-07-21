// Server-side auth endpoint.
//   GET    → the current session's user (or null)
//   POST   → sign in by phone + password; issues the signed httpOnly session cookie
//   DELETE → sign out; clears the cookie
// Server-verified: the account and password hash must match in the server store.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUserById, verifyPassword } from "@/lib/data/server/db";
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
  let body: { phone?: string; password?: string; scope?: "hostel" | "platform" };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  const password = body.password ?? "";
  if (!phone || !password) {
    return NextResponse.json({ error: "Enter your phone number and password." }, { status: 400 });
  }
  const scope = body.scope === "platform" ? "platform" : "hostel";
  const user = await verifyPassword(phone, password);

  // Uniform 401 for "no such account" and "wrong password" — don't reveal
  // which numbers exist or leak which half of the credential was wrong.
  if (!user) {
    return NextResponse.json(
      {
        error:
          scope === "platform"
            ? "No platform-team account with that number and password."
            : "Wrong phone number or password.",
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
