#!/usr/bin/env node
/**
 * Backfill county, category, and population for existing township rows.
 *
 * Cross-references the static MUNICIPAL_DIRECTORY (data/municipal-directory.ts)
 * against every row in the townships table. For any row where county, category,
 * or population is NULL, the values are copied from the directory if a match is
 * found by (name, state).
 *
 * Safe to run multiple times — only updates rows where at least one of the
 * three fields is still NULL.
 *
 * Usage:
 *   npx tsx scripts/backfill-townships.ts [--dry-run]
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

// ── Validate env ─────────────────────────────────────────────────────────────

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[backfill] Missing required env var: ${key}`);
    process.exit(1);
  }
}

if (dryRun) console.log("[backfill] DRY RUN — no DB writes\n");

(async () => {
  const { MUNICIPAL_DIRECTORY } = await import("../data/municipal-directory.js");
  const { createClient } = await import("@supabase/supabase-js");

  // Use service role to read + update all rows regardless of RLS
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Build lookup: "name|state" → directory entry ─────────────────────────

  type DirEntry = {
    name: string;
    state: string;
    county?: string;
    category?: string;
    population?: number;
  };

  const dirMap = new Map<string, DirEntry>();
  for (const entry of MUNICIPAL_DIRECTORY as DirEntry[]) {
    const key = `${entry.name.trim().toLowerCase()}|${entry.state.trim().toUpperCase()}`;
    dirMap.set(key, entry);
  }

  console.log(`[backfill] Directory entries loaded: ${dirMap.size}`);

  // ── Fetch all townships that need backfilling ─────────────────────────────

  const { data: rows, error } = await db
    .from("townships")
    .select("id, name, state, county, category, population")
    .or("county.is.null,category.is.null,population.is.null");

  if (error) {
    console.error("[backfill] Failed to fetch townships:", error.message);
    process.exit(1);
  }

  console.log(`[backfill] Rows needing backfill: ${rows?.length ?? 0}\n`);

  if (!rows || rows.length === 0) {
    console.log("[backfill] Nothing to backfill — all rows are complete.");
    return;
  }

  // ── Process each row ──────────────────────────────────────────────────────

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const row of rows) {
    const key = `${row.name.trim().toLowerCase()}|${row.state.trim().toUpperCase()}`;
    const entry = dirMap.get(key);

    if (!entry) {
      console.log(`  [not found] ${row.name}, ${row.state}`);
      notFound++;
      continue;
    }

    // Only update fields that are currently NULL
    const patch: Record<string, string | number | null> = {};
    if (row.county === null && entry.county) patch.county = entry.county;
    if (row.category === null && entry.category) patch.category = entry.category;
    if (row.population === null && entry.population) patch.population = entry.population;

    if (Object.keys(patch).length === 0) {
      skipped++;
      continue;
    }

    const fields = Object.entries(patch)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ");
    console.log(`  [update] ${row.name}, ${row.state} → ${fields}`);

    if (!dryRun) {
      const { error: updateErr } = await db
        .from("townships")
        .update(patch)
        .eq("id", row.id);

      if (updateErr) {
        console.error(`  [error] ${row.name}, ${row.state}: ${updateErr.message}`);
        continue;
      }
    }

    updated++;
  }

  console.log(`
[backfill] Complete
  Updated:   ${updated}
  Skipped:   ${skipped} (already had all fields)
  Not found: ${notFound} (no match in directory — likely auto-expanded or manually inserted)
`);
})().catch((err) => {
  console.error("[backfill] Unhandled error:", err);
  process.exit(1);
});
