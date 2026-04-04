/**
 * Scraper orchestrator.
 *
 * This module is the single entry point for triggering scrapes.
 * It is called by:
 *   - src/app/api/cron/scrape/route.ts  (scheduled cron runs)
 *   - src/app/api/scrape/route.ts       (admin-triggered manual runs)
 *
 * It does NOT write to the DB itself — it calls lib/db helpers to persist
 * the ScraperResult returned by the pipeline.
 */

import { runScraperPipeline } from "./pipeline";
import type { ScraperResult } from "./types";
import type { Township } from "../src/lib/db/types";

export interface OrchestratorOptions {
  /** Only scrape this specific township ID. If omitted, scrapes all active townships. */
  townshipId?: string;
  /** Re-fetch documents even if we've scraped recently. */
  force?: boolean;
  /** Override the triggered-by label in scrape_run logs. */
  trigger?: "cron" | "admin" | "manual";
}

export interface OrchestratorResult {
  ran: number;
  totalFound: number;
  totalInserted: number;
  errors: Array<{ townshipId: string; message: string }>;
}

/**
 * Run scrapers for one or all active townships.
 *
 * Import db helpers lazily so this file is safe to import in environments
 * where Supabase env vars aren't set (e.g. during build).
 */
export async function runScrapers(
  townships: Township[],
  opts: OrchestratorOptions = {}  // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<OrchestratorResult> {
  const { upsertDocuments } = await import("../src/lib/db/documents");
  const { markTownshipScraped } = await import("../src/lib/db/townships");

  const summary: OrchestratorResult = {
    ran: 0,
    totalFound: 0,
    totalInserted: 0,
    errors: [],
  };

  for (const township of townships) {
    console.log(`[orchestrator] Scraping ${township.name}, ${township.state}…`);
    let scraperResult: ScraperResult;
    try {
      scraperResult = await runScraperPipeline({
        townshipId: township.id,
        townshipName: township.name,
        websiteUrl: township.website_url,
        state: township.state,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[orchestrator] Pipeline threw for ${township.id}:`, err);
      summary.errors.push({ townshipId: township.id, message: msg });
      continue;
    }

    summary.ran += 1;
    summary.totalFound += scraperResult.documents.length;

    if (scraperResult.documents.length > 0) {
      try {
        const { inserted } = await upsertDocuments(
          scraperResult.documents.map((d) => ({
            township_id: township.id,
            type: d.type,
            title: d.title,
            date: d.date,
            source_url: d.sourceUrl,
            content: d.content,
            file_url: d.fileUrl,
            scraped_at: new Date().toISOString(),
          }))
        );
        summary.totalInserted += inserted;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[orchestrator] upsertDocuments failed for ${township.id}:`, err);
        summary.errors.push({ townshipId: township.id, message: `upsert: ${msg}` });
      }
    }

    if (scraperResult.errors.length === 0) {
      await markTownshipScraped(township.id).catch((err) =>
        console.warn("[orchestrator] markTownshipScraped failed:", err)
      );
    }

    for (const e of scraperResult.errors) {
      summary.errors.push({ townshipId: township.id, message: e });
    }
  }

  return summary;
}
