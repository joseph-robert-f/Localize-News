/**
 * GET /api/townships
 *
 * Returns the list of active townships (public).
 * Used by the home page to populate the township directory.
 */

import { NextResponse } from "next/server";
import { getActiveTownships } from "@/lib/db/townships";

export async function GET() {
  try {
    const townships = await getActiveTownships();
    return NextResponse.json(townships);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/townships] GET failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
