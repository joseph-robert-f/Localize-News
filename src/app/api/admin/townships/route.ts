/**
 * GET /api/admin/townships
 *
 * Returns all townships ordered by next_scrape_at (nulls first = highest priority).
 * Used by the admin queue panel.
 *
 * Auth: x-admin-secret header must match ADMIN_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllTownships } from "@/lib/db/townships";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) return unauthorized();

  try {
    const townships = await getAllTownships();
    return NextResponse.json(townships);
  } catch (err) {
    console.error("[api/admin/townships] GET failed:", err);
    return NextResponse.json({ error: "Failed to load townships." }, { status: 500 });
  }
}
