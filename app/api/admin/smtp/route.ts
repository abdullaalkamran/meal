// Super Admin email (SMTP) settings.
//   GET  → current settings, sanitized (never the password)
//   POST → save settings (password optional: blank keeps the stored one)
// Superadmin-only, checked from the session. Kept off /api/rpc because it
// touches a server secret (the mail password).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/data/server/auth";
import { getSmtpConfigPublic, getUserById, saveSmtpConfig } from "@/lib/data/server/db";

export const dynamic = "force-dynamic";

async function requireSuperadmin(req: NextRequest) {
  const id = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const user = id ? await getUserById(id) : undefined;
  return user?.role === "superadmin" ? user : null;
}

export async function GET(req: NextRequest) {
  if (!(await requireSuperadmin(req))) {
    return NextResponse.json({ error: "Super Admin only." }, { status: 403 });
  }
  return NextResponse.json(await getSmtpConfigPublic());
}

export async function POST(req: NextRequest) {
  if (!(await requireSuperadmin(req))) {
    return NextResponse.json({ error: "Super Admin only." }, { status: 403 });
  }
  let body: {
    host?: string; port?: number; secure?: boolean; username?: string;
    password?: string; fromEmail?: string; fromName?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.host?.trim() || !body.username?.trim()) {
    return NextResponse.json({ error: "Server and username are required." }, { status: 400 });
  }
  await saveSmtpConfig({
    host: body.host,
    port: Number(body.port) || 465,
    secure: body.secure !== false,
    username: body.username,
    password: body.password ?? "",
    fromEmail: body.fromEmail ?? "",
    fromName: body.fromName ?? "",
  });
  return NextResponse.json({ ok: true });
}
