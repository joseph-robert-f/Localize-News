import { createServerClient } from "../supabase";
import type { ScrapeRun, ScrapeRunTrigger, ScrapeRunStatus } from "./types";

/** Open a new scrape run log entry. Returns the run ID. */
export async function startScrapeRun(
  townshipId: string | null,
  triggeredBy: ScrapeRunTrigger
): Promise<string> {
  const db = createServerClient();
  const { data, error } = await db
    .from("scrape_runs")
    .insert({ township_id: townshipId, triggered_by: triggeredBy, status: "running" })
    .select("id")
    .single();
  if (error) throw new Error(`startScrapeRun: ${error.message}`);
  return data.id;
}

/** Close out a scrape run with the final status and counts. */
export async function finishScrapeRun(
  runId: string,
  result: { status: ScrapeRunStatus; found: number; inserted: number; errorMessage?: string }
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("scrape_runs")
    .update({
      status: result.status,
      documents_found: result.found,
      documents_inserted: result.inserted,
      error_message: result.errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw new Error(`finishScrapeRun: ${error.message}`);
}

/** Fetch recent scrape runs for the admin dashboard. */
export async function getRecentScrapeRuns(limit = 50): Promise<ScrapeRun[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("scrape_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentScrapeRuns: ${error.message}`);
  return data ?? [];
}
