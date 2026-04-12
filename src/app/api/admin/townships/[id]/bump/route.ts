/**
 * POST /api/admin/townships/[id]/bump
 *
 * Places the given township at the front of the scrape queue by setting
 * next_scrape_at = NULL. The next cron run will pick it up first.
 *
 * Auth: x-admin-secret header must match ADMIN_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { bumpTownshipPriority } from "@/lib/db/townships";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) return unauthorized();

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing township id." }, { status: 400 });

  try {
    await bumpTownshipPriority(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[api/admin/townships/${id}/bump] POST failed:`, err);
    return NextResponse.json({ error: "Failed to bump township." }, { status: 500 });
  }
}
