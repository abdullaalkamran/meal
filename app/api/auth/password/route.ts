// Change your OWN password while signed in.
//   POST { currentPassword, newPassword }
// The session fixes WHOSE password this is, so there's no userId in the body —
// you can only ever change your own. Kept on /api/auth (not /api/rpc) so a
// password check is never reachable by the generic, any-signed-in-user RPC.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/data/server/auth";
import { setUserPassword, verifyPasswordById } from "@/lib/data/server/db";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 6;

export async function POST(req: NextRequest) {
  const userId = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const newPassword = body.newPassword ?? "";
  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (!(await verifyPasswordById(userId, body.currentPassword ?? ""))) {
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
  }

  await setUserPassword(userId, newPassword);
  return NextResponse.json({ ok: true });
}
