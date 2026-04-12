#!/usr/bin/env node
/**
 * Import the curated municipal directory into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-directory.ts [options]
 *
 * Options:
 *   --dry-run          Print what would be inserted/skipped without writing to DB
 *   --state <abbr>     Only import entries for this state (e.g. --state OH)
 *   --status <s>       Insert with this status: "pending" | "active" (default: pending)
 *
 * Required env vars (same as scrape.ts):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, ".."));

// ── Parse CLI args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const stateIdx = args.indexOf("--state");
const stateFilter = stateIdx !== -1 ? args[stateIdx + 1]?.toUpperCase() : undefined;
const statusIdx = args.indexOf("--status");
const statusArg = statusIdx !== -1 ? args[statusIdx + 1] : "pending";
const status = statusArg === "active" ? "active" : "pending";

if (dryRun) console.log("[import-directory] DRY RUN — no DB writes will occur\n");

// ── Validate required env vars ────────────────────────────────────────────
const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[import-directory] Missing required env var: ${key}`);
    process.exit(1);
  }
}

(async () => {
  const { MUNICIPAL_DIRECTORY } = await import("../data/municipal-directory.js");
  const { MUNICIPALITY_COORDINATES } = await import("../data/municipality-coordinates.js");
  const { createTownship } = await import("../src/lib/db/townships.js");

  const entries = stateFilter
    ? MUNICIPAL_DIRECTORY.filter((e) => e.state === stateFilter)
    : MUNICIPAL_DIRECTORY;

  if (entries.length === 0) {
    console.log("[import-directory] No entries match the given filters.");
    return;
  }

  console.log(
    `[import-directory] Processing ${entries.length} entr${entries.length === 1 ? "y" : "ies"}` +
    (stateFilter ? ` (state=${stateFilter})` : "") +
    ` with status="${status}"`
  );

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    const label = `${entry.name}, ${entry.state}`;
    if (dryRun) {
      console.log(`  [dry-run] would insert: ${label} — ${entry.website_url}`);
      inserted++;
      continue;
    }

    try {
      const coordKey = `${entry.name}|${entry.state}`;
      const coords = MUNICIPALITY_COORDINATES[coordKey];
      await createTownship({
        name: entry.name,
        state: entry.state,
        county: entry.county ?? null,
        category: entry.category ?? null,
        population: entry.population ?? null,
        latitude: coords ? coords[0] : null,
        longitude: coords ? coords[1] : null,
        website_url: entry.website_url,
        status,
      });
      console.log(`  ✓ inserted: ${label}`);
      inserted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Postgres unique violation (23505) = already exists — not an error
      if (msg.includes("23505") || msg.includes("unique") || msg.includes("duplicate")) {
        console.log(`  – skipped (already exists): ${label}`);
        skipped++;
      } else {
        console.error(`  ✗ error for ${label}: ${msg}`);
        errors++;
      }
    }
  }

  console.log(`\n[import-directory] Done — inserted ${inserted}, skipped ${skipped}, errors ${errors}`);
  if (errors > 0) process.exit(1);
})().catch((err) => {
  console.error("[import-directory] Unhandled error:", err);
  process.exit(1);
});
