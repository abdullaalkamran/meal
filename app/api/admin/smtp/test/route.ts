// Super Admin "send a test email" — confirms the saved SMTP settings work.
//   POST { to }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/data/server/auth";
import { getUserById } from "@/lib/data/server/db";
import { sendTestEmail } from "@/lib/data/server/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const id = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const user = id ? await getUserById(id) : undefined;
  if (user?.role !== "superadmin") {
    return NextResponse.json({ error: "Super Admin only." }, { status: 403 });
  }
  let body: { to?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const to = (body.to ?? "").trim();
  if (!to) return NextResponse.json({ error: "Enter a recipient email." }, { status: 400 });

  const result = await sendTestEmail(to);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
