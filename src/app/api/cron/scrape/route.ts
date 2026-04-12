/**
 * POST /api/cron/scrape
 *
 * Called by the pg_cron job (via pg_net) on a schedule.
 * Also callable by the admin dashboard for manual full runs.
 *
 * Security: requires the x-cron-secret header to match CRON_SECRET env var.
 * Never expose this endpoint without the secret check.
 *
 * Body params:
 *   trigger     — "cron" | "admin" (default "cron")
 *   force       — boolean; if true, bypasses queue and scrapes all active townships
 *   townshipId  — string; if set, scrapes only this township
 *   sinceDays   — number; only collect documents from the last N days.
 *                 Defaults to 180 for nightly cron runs. Ignored on force runs.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // needs Node.js for Playwright + pdf-parse

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/scrape] CRON_SECRET is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const providedSecret = req.headers.get("x-cron-secret");
  if (providedSecret !== cronSecret) return unauthorized();

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { trigger?: string; force?: boolean; townshipId?: string; sinceDays?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const trigger = body.trigger === "admin" ? "admin" : "cron";
  const force = body.force === true;
  const townshipId = typeof body.townshipId === "string" ? body.townshipId : undefined;

  // Nightly cron defaults to 180-day window; force runs and specific-township
  // requests have no cutoff so admins always get the full picture.
  const rawSinceDays = typeof body.sinceDays === "number" ? body.sinceDays : undefined;
  const sinceDays = rawSinceDays ?? (trigger === "cron" && !force && !townshipId ? 180 : undefined);
  const sinceDate = sinceDays !== undefined
    ? new Date(Date.now() - sinceDays * 86_400_000)
    : undefined;

  // ── Load dependencies lazily (safe for build) ────────────────────────────────
  const { getActiveTownships, getTownshipsForQueue, getTownshipById } =
    await import("@/lib/db/townships");
  const { startScrapeRun, finishScrapeRun } = await import("@/lib/db/scrapeRuns");
  const { runScrapers } = await import("../../../../../scrapers/index");

  // ── Resolve townships to scrape ─────────────────────────────────────────────
  let townships;
  try {
    if (townshipId) {
      const t = await getTownshipById(townshipId);
      if (!t) return NextResponse.json({ error: "Township not found" }, { status: 404 });
      townships = [t];
    } else if (force) {
      // Force: scrape all active townships regardless of queue schedule
      townships = (await getActiveTownships()).slice(0, 25);
    } else {
      // Normal cron: only townships that are due
      townships = await getTownshipsForQueue(25);
    }
  } catch (err) {
    console.error("[cron/scrape] Failed to resolve townships:", err);
    return NextResponse.json({ error: "Failed to load townships." }, { status: 500 });
  }

  if (townships.length === 0) {
    return NextResponse.json({ message: "No townships due for scraping" });
  }

  // ── Start run log ───────────────────────────────────────────────────────────
  const runId = await startScrapeRun(townshipId ?? null, trigger).catch(() => null);

  // ── Execute pipeline ────────────────────────────────────────────────────────
  console.log(
    `[cron/scrape] Starting ${trigger} run: ${townships.length} townships, force=${force}, sinceDays=${sinceDays ?? "none"}`
  );

  let summary;
  try {
    summary = await runScrapers(townships, { force, trigger, townshipId, sinceDate });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/scrape] runScrapers threw:", err);
    if (runId) {
      try {
        await finishScrapeRun(runId, { status: "error", found: 0, inserted: 0, errorMessage: msg });
      } catch (logErr) {
        console.error("[cron/scrape] Failed to record error run:", logErr);
      }
    }
    return NextResponse.json({ error: "Scrape run failed." }, { status: 500 });
  }

  // ── Finish run log ──────────────────────────────────────────────────────────
  if (runId) {
    try {
      await finishScrapeRun(runId, {
        status: summary.errors.length === 0 ? "success" : "error",
        found: summary.totalFound,
        inserted: summary.totalInserted,
        errorMessage: summary.errors.length > 0
          ? summary.errors.map((e) => `${e.townshipId}: ${e.message}`).join("; ")
          : undefined,
      });
    } catch (logErr) {
      console.error("[cron/scrape] Failed to finalize scrape run log:", logErr);
    }
  }

  return NextResponse.json({
    ok: true,
    trigger,
    ran: summary.ran,
    totalFound: summary.totalFound,
    totalInserted: summary.totalInserted,
    sinceDays: sinceDays ?? null,
    errors: summary.errors,
  });
}
