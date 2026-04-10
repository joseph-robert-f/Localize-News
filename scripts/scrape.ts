#!/usr/bin/env node
/**
 * Standalone scraper entry point — runs outside of Next.js / Vercel.
 * Designed to be executed by GitHub Actions on a schedule.
 *
 * Usage:
 *   npx tsx scripts/scrape.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL     Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    Supabase service role key (bypasses RLS)
 *
 * Optional env vars:
 *   BRAVE_SEARCH_API_KEY         Brave Search API key (falls back to DuckDuckGo)
 *   TOWNSHIP_ID                  Scrape only this specific township ID
 *   FORCE_SCRAPE                 Set to "true" to re-scrape even if recently done
 */

import path from "path";
import { fileURLToPath } from "url";

// Make src/ importable via relative paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, ".."));

// Validate required env vars early
const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[scrape] Missing required env var: ${key}`);
    process.exit(1);
  }
}

// Lazy imports (after env check)
const { getActiveTownships, getTownshipById } = await import(
  "../src/lib/db/townships.js"
);
const { startScrapeRun, finishScrapeRun } = await import(
  "../src/lib/db/scrapeRuns.js"
);
const { runScrapers } = await import("../scrapers/index.js");

// Config from env
const townshipId = process.env.TOWNSHIP_ID || undefined;
const force = process.env.FORCE_SCRAPE === "true";
const trigger = "cron" as const;

async function main() {
  console.log("=".repeat(60));
  console.log("[scrape] GitHub Actions scraper starting");
  console.log(`  township: ${townshipId ?? "all active"}`);
  console.log(`  force:    ${force}`);
  console.log(`  time:     ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  // Resolve townships
  let townships;
  if (townshipId) {
    const t = await getTownshipById(townshipId);
    if (!t) {
      console.error(`[scrape] Township not found: ${townshipId}`);
      process.exit(1);
    }
    townships = [t];
  } else {
    townships = await getActiveTownships();
  }

  if (townships.length === 0) {
    console.log("[scrape] No active townships found - nothing to do.");
    return;
  }
  console.log(`[scrape] ${townships.length} township(s) to scrape:`);
  for (const t of townships) {
    console.log(`  * ${t.name}, ${t.state} - ${t.website_url}`);
  }

  // Start run log in Supabase
  const runId = await startScrapeRun(townshipId ?? null, trigger).catch(
    (err) => {
      console.warn("[scrape] Could not create scrape_run log:", err);
      return null;
    }
  );

  // Execute pipeline
  let summary;
  try {
    summary = await runScrapers(townships, { force, trigger, townshipId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scrape] Fatal pipeline error:", err);
    if (runId) {
      await finishScrapeRun(runId, {
        status: "error",
        found: 0,
        inserted: 0,
        errorMessage: msg,
      }).catch(() => {});
    }
    process.exit(1);
  }

  // Finish run log
  if (runId) {
    await finishScrapeRun(runId, {
      status: summary.errors.length === 0 ? "success" : "error",
      found: summary.totalFound,
      inserted: summary.totalInserted,
      errorMessage:
        summary.errors.length > 0
          ? summary.errors
              .map((e) => `${e.townshipId}: ${e.message}`)
              .join("; ")
          : undefined,
    }).catch(() => {});
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("[scrape] Run complete");
  console.log(`  Townships scraped:   ${summary.ran}`);
  console.log(`  Documents found:     ${summary.totalFound}`);
  console.log(`  Documents inserted:  ${summary.totalInserted}`);

  if (summary.errors.length > 0) {
    console.log(`  Errors (${summary.errors.length}):`);
    for (const e of summary.errors) {
      console.log(`    x ${e.townshipId}: ${e.message}`);
    }
    console.log("=".repeat(60));
    process.exit(1);
  }

  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("[scrape] Unhandled error:", err);
  process.exit(1);
});
