/**
 * PATCH /api/requests/[id]
 *
 * Admin-only endpoint to approve or reject a scrape request.
 * Requires the x-admin-secret header.
 *
 * Body: { status: "approved" | "rejected" }
 *
 * On approval, a new township row is created with status = "pending"
 * (a separate admin action triggers the first scrape).
 */

import { NextRequest, NextResponse } from "next/server";
import { reviewRequest, getPendingRequests } from "@/lib/db/scrapeRequests";
import { createTownship } from "@/lib/db/townships";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (req.headers.get("x-admin-secret") !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { status?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status !== "approved" && body.status !== "rejected") {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  // ── Find the request ────────────────────────────────────────────────────────
  // We fetch pending requests to find this one (avoids a separate getById helper for now)
  const pending = await getPendingRequests();
  const request = pending.find((r) => r.id === id);
  if (!request) {
    return NextResponse.json({ error: "Request not found or already reviewed" }, { status: 404 });
  }

  // ── Update status ───────────────────────────────────────────────────────────
  await reviewRequest(id, body.status);

  // ── If approved, create the township ───────────────────────────────────────
  let township = null;
  if (body.status === "approved") {
    // Infer state from the URL or leave as "XX" for admin to update
    try {
      township = await createTownship({
        name: request.township_name,
        state: inferState(request.website_url),
        website_url: request.website_url,
      });
    } catch (err) {
      // Township may already exist (e.g. duplicate request) — not fatal
      console.warn("[api/requests/[id]] createTownship failed (may already exist):", err);
    }
  }

  return NextResponse.json({ ok: true, status: body.status, township });
}

/** Best-effort: extract state abbreviation from a .gov/.us URL, or return "XX". */
function inferState(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    // Matches patterns like springfield.pa.us or springfield.pa.gov
    const match = host.match(/\.([a-z]{2})\.(us|gov)$/);
    if (match) return match[1].toUpperCase();
  } catch {
    // ignore
  }
  return "XX";
}
