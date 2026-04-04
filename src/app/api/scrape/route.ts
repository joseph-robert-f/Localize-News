/**
 * POST /api/scrape
 *
 * Admin-only endpoint to trigger a scrape for a specific township.
 * Requires the ADMIN_SECRET header.
 *
 * Body: { townshipId: string }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (req.headers.get("x-admin-secret") !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { townshipId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.townshipId) {
    return NextResponse.json({ error: "townshipId is required" }, { status: 400 });
  }

  // ── Delegate to cron handler internally ────────────────────────────────────
  // Re-use the cron route logic by forwarding with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const { getTownshipById } = await import("@/lib/db/townships");
  const { startScrapeRun, finishScrapeRun } = await import("@/lib/db/scrapeRuns");
  const { runScrapers } = await import("../../../../scrapers/index");

  const township = await getTownshipById(body.townshipId);
  if (!township) {
    return NextResponse.json({ error: "Township not found" }, { status: 404 });
  }

  const runId = await startScrapeRun(township.id, "admin").catch(() => null);

  let summary;
  try {
    summary = await runScrapers([township], { trigger: "admin", townshipId: township.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (runId) await finishScrapeRun(runId, { status: "error", found: 0, inserted: 0, errorMessage: msg }).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (runId) {
    await finishScrapeRun(runId, {
      status: summary.errors.length === 0 ? "success" : "error",
      found: summary.totalFound,
      inserted: summary.totalInserted,
      errorMessage: summary.errors.length > 0
        ? summary.errors.map((e) => e.message).join("; ")
        : undefined,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    townshipId: township.id,
    found: summary.totalFound,
    inserted: summary.totalInserted,
    errors: summary.errors,
  });
}
