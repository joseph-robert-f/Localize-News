#!/usr/bin/env node
/**
 * Backfill latitude/longitude for townships that have a matching entry in
 * data/municipality-coordinates.ts.
 *
 * Usage:
 *   npx tsx scripts/backfill-coordinates.ts [--dry-run]
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, ".."));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[backfill-coordinates] Missing required env var: ${key}`);
    process.exit(1);
  }
}

if (dryRun) console.log("[backfill-coordinates] DRY RUN — no DB writes\n");

(async () => {
  const { MUNICIPALITY_COORDINATES } = await import("../data/municipality-coordinates.js");
  const { createClient } = await import("@supabase/supabase-js");

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all townships that are missing coordinates
  const { data: townships, error } = await db
    .from("townships")
    .select("id, name, state, latitude, longitude")
    .or("latitude.is.null,longitude.is.null");

  if (error) {
    console.error("[backfill-coordinates] DB error:", error.message);
    process.exit(1);
  }

  if (!townships || townships.length === 0) {
    console.log("[backfill-coordinates] All townships already have coordinates.");
    return;
  }

  console.log(`[backfill-coordinates] ${townships.length} townships missing coordinates\n`);

  let updated = 0;
  let missing = 0;

  for (const t of townships) {
    const key = `${t.name}|${t.state}`;
    const coords = MUNICIPALITY_COORDINATES[key];

    if (!coords) {
      console.log(`  – no coords for: ${key}`);
      missing++;
      continue;
    }

    const [latitude, longitude] = coords;

    if (dryRun) {
      console.log(`  [dry-run] would update: ${key} → [${latitude}, ${longitude}]`);
      updated++;
      continue;
    }

    const { error: updateError } = await db
      .from("townships")
      .update({ latitude, longitude })
      .eq("id", t.id);

    if (updateError) {
      console.error(`  ✗ error for ${key}: ${updateError.message}`);
    } else {
      console.log(`  ✓ updated: ${key} → [${latitude}, ${longitude}]`);
      updated++;
    }
  }

  console.log(`\n[backfill-coordinates] Done — updated ${updated}, no coords found for ${missing}`);
})().catch((err) => {
  console.error("[backfill-coordinates] Unhandled error:", err);
  process.exit(1);
});
