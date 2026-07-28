// Public, unauthenticated hostel view for the door-QR landing page (/h/[id]).
//   GET /api/public/hostel/<hostelId>
// Returns a curated view only (no occupant ids / member data). Unknown or
// suspended hostels → 404.

import { NextResponse } from "next/server";
import { getPublicHostelView } from "@/lib/data/server/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hostelId: string }> }
) {
  const { hostelId } = await params;
  const view = await getPublicHostelView(hostelId);
  if (!view) return NextResponse.json({ error: "Hostel not found." }, { status: 404 });
  return NextResponse.json(view);
}
