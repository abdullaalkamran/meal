// Admin password reset — for a member who forgot their password.
//   POST { userId, newPassword }
// Authorization (from the session, never the body):
//   * superadmin  → may reset any account (including platform staff)
//   * owner       → may reset accounts belonging to a hostel they OWN
// A manager cannot reset here, and an owner can't reach another owner or a
// platform account (their hostelId isn't among the owner's hostels).
//
// The admin sets the new password and tells the member; the member should then
// change it themselves (POST /api/auth/password).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/data/server/auth";
import { getUserById, setUserPassword } from "@/lib/data/server/db";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 6;

export async function POST(req: NextRequest) {
  const actorId = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const actor = actorId ? await getUserById(actorId) : undefined;
  if (!actor) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  let body: { userId?: string; newPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const targetId = (body.userId ?? "").trim();
  const newPassword = body.newPassword ?? "";
  if (!targetId) {
    return NextResponse.json({ error: "No account specified." }, { status: 400 });
  }
  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const target = await getUserById(targetId);
  if (!target) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const isSuper = actor.role === "superadmin";
  const ownsTargetsHostel =
    actor.role === "owner" &&
    !!target.hostelId &&
    (actor.ownedHostelIds ?? []).includes(target.hostelId);
  if (!isSuper && !ownsTargetsHostel) {
    return NextResponse.json(
      { error: "You can only reset passwords for members of your own hostels." },
      { status: 403 }
    );
  }

  await setUserPassword(targetId, newPassword);
  return NextResponse.json({ ok: true });
}
