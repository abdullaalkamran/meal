// The single data endpoint. GET returns the change counter (clients poll it
// to know when to re-fetch); POST dispatches one repository call against the
// server-side store (see lib/data/server/db.ts).

import type { NextRequest } from "next/server";
import { getStatus, getUserById, handleRpc, RpcError, type RpcRequest } from "@/lib/data/server/db";
import { SESSION_COOKIE, verifySession } from "@/lib/data/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getStatus());
}

export async function POST(req: NextRequest) {
  let body: RpcRequest;
  try {
    body = (await req.json()) as RpcRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    // The activity-log actor is derived from the signed session cookie, never
    // trusted from the request body — so who did what can't be spoofed.
    const userId = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    const actorUser = userId ? getUserById(userId) : undefined;
    const actor = actorUser ? { id: actorUser.id, name: actorUser.name } : null;
    const { result, rev } = await handleRpc({ ...body, actor });
    return Response.json({ result, rev });
  } catch (err) {
    if (err instanceof RpcError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: message }, { status: 400 });
  }
}
