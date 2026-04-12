/**
 * POST /api/admin/revalidate
 *
 * Flushes the Next.js ISR cache for a specific township page so fresh
 * data appears immediately after a scrape — without waiting up to an hour.
 *
 * Body: { townshipId: string }
 * Auth: x-admin-secret header must match ADMIN_SECRET env var
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { townshipId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.townshipId) {
    return NextResponse.json({ error: "townshipId is required" }, { status: 400 });
  }

  revalidatePath(`/townships/${body.townshipId}`);

  return NextResponse.json({ ok: true, revalidated: `/townships/${body.townshipId}` });
}
