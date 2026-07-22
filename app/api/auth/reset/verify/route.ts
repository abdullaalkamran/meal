// Step 2 of "forgot password": verify the code and set a new password.
//   POST { phone, code, newPassword }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUserByPhone, setUserPassword, verifyResetOtp } from "@/lib/data/server/db";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 6;

export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string; newPassword?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  const code = (body.code ?? "").trim();
  const newPassword = body.newPassword ?? "";
  if (!phone || !code) {
    return NextResponse.json({ error: "Enter your phone number and the code." }, { status: 400 });
  }
  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json({ error: `New password must be at least ${MIN_LENGTH} characters.` }, { status: 400 });
  }

  const user = await getUserByPhone(phone);
  // Same generic error as a bad code, so this can't probe which numbers exist.
  if (!user) return NextResponse.json({ error: "Incorrect or expired code." }, { status: 400 });

  const check = await verifyResetOtp(user.id, code);
  if (!check.ok) return NextResponse.json({ error: check.error ?? "Incorrect or expired code." }, { status: 400 });

  await setUserPassword(user.id, newPassword);
  return NextResponse.json({ ok: true });
}
