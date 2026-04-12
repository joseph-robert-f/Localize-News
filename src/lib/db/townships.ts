import { createServerClient } from "../supabase";
import type { Township, TownshipStatus } from "./types";

/** Fetch all active townships ordered by state + name. */
export async function getActiveTownships(): Promise<Township[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("townships")
    .select("*")
    .eq("status", "active")
    .order("state")
    .order("name");
  if (error) throw new Error(`getActiveTownships: ${error.message}`);
  return data ?? [];
}

/**
 * Fetch active townships that are due for a scrape — i.e. next_scrape_at is
 * NULL (new/never scraped) or <= now(). Results are oldest-first so priority
 * entries (bumped to NULL) always surface at the top.
 */
export async function getTownshipsForQueue(limit = 25): Promise<Township[]> {
  const db = createServerClient();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("townships")
    .select("*")
    .eq("status", "active")
    .or(`next_scrape_at.is.null,next_scrape_at.lte.${now}`)
    .order("next_scrape_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`getTownshipsForQueue: ${error.message}`);
  return data ?? [];
}

/** Fetch a single township by ID. Returns null if not found. */
export async function getTownshipById(id: string): Promise<Township | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("townships")
    .select("*")
    .eq("id", id)
    .single();
  if (error?.code === "PGRST116") return null; // not found
  if (error) throw new Error(`getTownshipById: ${error.message}`);
  return data;
}

/** Fetch all townships (any status) — admin use only. */
export async function getAllTownships(): Promise<Township[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("townships")
    .select("*")
    .order("next_scrape_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(`getAllTownships: ${error.message}`);
  return data ?? [];
}

/** Update a township's status. */
export async function setTownshipStatus(id: string, status: TownshipStatus): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("townships")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`setTownshipStatus: ${error.message}`);
}

/**
 * Record that a township was scraped and advance its queue schedule.
 *
 * Back-off rules:
 *   hadError             → now + 2 days  (error doesn't count as empty)
 *   newDocsInserted > 0  → now + 7 days, reset consecutive_empty_runs
 *   1st empty run        → now + 14 days
 *   2nd empty run        → now + 21 days
 *   3rd+ empty run       → now + 30 days
 */
export async function markTownshipScraped(
  id: string,
  opts: { newDocsInserted?: number; hadError?: boolean } = {}
): Promise<void> {
  const db = createServerClient();
  const newDocs = opts.newDocsInserted ?? 0;
  const hadError = opts.hadError ?? false;

  // Read current consecutive_empty_runs to compute next value
  const { data: current, error: readError } = await db
    .from("townships")
    .select("consecutive_empty_runs")
    .eq("id", id)
    .single();
  if (readError && readError.code !== "PGRST116") {
    throw new Error(`markTownshipScraped (read): ${readError.message}`);
  }
  const emptyRuns = current?.consecutive_empty_runs ?? 0;

  let nextScrapeOffsetMs: number;
  let newEmptyRuns: number;

  if (hadError) {
    nextScrapeOffsetMs = 2 * 24 * 60 * 60 * 1000; // 2 days — don't count errors
    newEmptyRuns = emptyRuns;
  } else if (newDocs > 0) {
    nextScrapeOffsetMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    newEmptyRuns = 0;
  } else {
    newEmptyRuns = emptyRuns + 1;
    if (newEmptyRuns === 1) nextScrapeOffsetMs = 14 * 24 * 60 * 60 * 1000;
    else if (newEmptyRuns === 2) nextScrapeOffsetMs = 21 * 24 * 60 * 60 * 1000;
    else nextScrapeOffsetMs = 30 * 24 * 60 * 60 * 1000;
  }

  const next_scrape_at = new Date(Date.now() + nextScrapeOffsetMs).toISOString();

  const { error } = await db
    .from("townships")
    .update({
      last_scraped_at: new Date().toISOString(),
      status: "active",
      consecutive_empty_runs: newEmptyRuns,
      next_scrape_at,
    })
    .eq("id", id);
  if (error) throw new Error(`markTownshipScraped: ${error.message}`);
}

/**
 * Place a township at the front of the scrape queue by setting
 * next_scrape_at = NULL. Used by the admin "Bump" action.
 */
export async function bumpTownshipPriority(id: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("townships")
    .update({ next_scrape_at: null })
    .eq("id", id);
  if (error) throw new Error(`bumpTownshipPriority: ${error.message}`);
}

/** Persist AI area insights for a township. */
export async function setTownshipInsights(id: string, insights: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("townships")
    .update({
      ai_insights: insights,
      insights_updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`setTownshipInsights: ${error.message}`);
}

/** Read AI area insights for a township. Returns null if none generated yet. */
export async function getTownshipInsights(
  id: string
): Promise<{ ai_insights: string | null; insights_updated_at: string | null } | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("townships")
    .select("ai_insights, insights_updated_at")
    .eq("id", id)
    .single();
  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(`getTownshipInsights: ${error.message}`);
  return data;
}

/** Insert a new township. Returns the created record. */
export async function createTownship(
  data: Pick<Township, "name" | "state" | "website_url"> & { status?: TownshipStatus }
): Promise<Township> {
  const db = createServerClient();
  const { data: created, error } = await db
    .from("townships")
    .insert({ status: "pending", ...data })
    .select()
    .single();
  if (error) throw new Error(`createTownship: ${error.message}`);
  return created;
}
