// Step 1 of "forgot password": email a reset code to the account's address.
//   POST { email }
// No session required (the user is locked out). To limit account enumeration,
// an unknown address returns the same generic success as a known one.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createResetOtp, getUserByEmail } from "@/lib/data/server/db";
import { sendResetEmail } from "@/lib/data/server/mailer";

export const dynamic = "force-dynamic";

/** "karim@gmail.com" → "k••••@gmail.com" so the user knows where it went. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "your email";
  const head = local.slice(0, 1);
  return `${head}${"•".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "Enter your email address." }, { status: 400 });

  const generic = { ok: true, message: "If an account uses that email, a reset code has been sent to it." };
  const user = await getUserByEmail(email);
  // Unknown email → generic success, so this can't probe which addresses exist.
  if (!user || !user.email) return NextResponse.json(generic);

  const created = await createResetOtp(user.id);
  if (created.error) return NextResponse.json({ error: created.error }, { status: 429 });

  const result = await sendResetEmail(user.email, created.code!, user.name);
  const devMode = process.env.OTP_DEV_MODE === "true";

  // The email didn't actually go out (SMTP not set up, or the send failed).
  // Don't pretend a code was sent — tell the user plainly so they aren't left
  // waiting for a mail that will never arrive. In dev mode we still return the
  // code below so the flow stays testable without a mail server.
  if (!result.sent && !devMode) {
    return NextResponse.json({
      ok: true,
      noEmail: true,
      message:
        "We couldn't send a reset email right now — email isn't set up for this app yet. " +
        "Ask your hostel manager or owner to reset your password.",
    });
  }

  return NextResponse.json({
    ok: true,
    sentTo: maskEmail(user.email),
    message: `A reset code was sent to ${maskEmail(user.email)}.`,
    // DEV ONLY: surfaces the code when SMTP isn't set up, so the flow is
    // testable without a mail server. Never enabled in production.
    ...(devMode ? { devCode: created.code, delivered: result.sent } : {}),
  });
}
