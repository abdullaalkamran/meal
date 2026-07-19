// The single data endpoint. GET returns the change counter (clients poll it
// to know when to re-fetch); POST dispatches one repository call against the
// server-side store (see lib/data/server/db.ts).

import type { NextRequest } from "next/server";
import { getStatus, handleRpc, RpcError, type RpcRequest } from "@/lib/data/server/db";

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
    const { result, rev } = await handleRpc(body);
    return Response.json({ result, rev });
  } catch (err) {
    if (err instanceof RpcError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: message }, { status: 400 });
  }
}
