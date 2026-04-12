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
 *
 * Routing priority:
 *   1. If a hand-crafted scraper is registered for the township's hostname → use it
 *   2. Otherwise → fall back to the generic search-driven pipeline
 */

import { runScraperPipeline } from "./pipeline";
import { isDocumentRecent } from "./utils";
import type { ScraperResult } from "./types";
import type { Township } from "../src/lib/db/types";

export interface OrchestratorOptions {
  /** Only scrape this specific township ID. If omitted, scrapes all active townships. */
  townshipId?: string;
  /** Re-fetch documents even if we've scraped recently. */
  force?: boolean;
  /** Override the triggered-by label in scrape_run logs. */
  trigger?: "cron" | "admin" | "manual";
  /** Only include documents on or after this date. Undated documents are always kept. */
  sinceDate?: Date;
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
  opts: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
  const { upsertDocuments } = await import("../src/lib/db/documents");
  const { markTownshipScraped } = await import("../src/lib/db/townships");
  const { registerAll, getScraperForUrl } = await import("./registry");

  // Register all hand-crafted scrapers once before the loop
  await registerAll();

  const trigger = opts.trigger ?? "manual";
  const summary: OrchestratorResult = {
    ran: 0,
    totalFound: 0,
    totalInserted: 0,
    errors: [],
  };

  for (const township of townships) {
    console.log(`[orchestrator:${trigger}] Scraping ${township.name}, ${township.state}…`);

    let scraperResult: ScraperResult;
    let hadPipelineError = false;

    try {
      const specificScraper = getScraperForUrl(township.website_url);
      if (specificScraper) {
        console.log(`[orchestrator] Using hand-crafted scraper for ${township.website_url}`);
        scraperResult = await specificScraper(township.id);
        // Hand-crafted scrapers don't accept sinceDate — apply as post-filter
        if (opts.sinceDate) {
          scraperResult = {
            ...scraperResult,
            documents: scraperResult.documents.filter((d) =>
              isDocumentRecent(d, opts.sinceDate)
            ),
          };
        }
      } else {
        console.log(`[orchestrator] No specific scraper found — using generic pipeline`);
        scraperResult = await runScraperPipeline({
          townshipId: township.id,
          townshipName: township.name,
          websiteUrl: township.website_url,
          state: township.state,
          sinceDate: opts.sinceDate,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[orchestrator] Pipeline threw for ${township.id}:`, err);
      summary.errors.push({ townshipId: township.id, message: msg });
      hadPipelineError = true;
      // Always advance the queue even on error so we don't retry immediately
      await markTownshipScraped(township.id, { hadError: true }).catch((e) =>
        console.warn("[orchestrator] markTownshipScraped (error path) failed:", e)
      );
      continue;
    }

    summary.ran += 1;
    summary.totalFound += scraperResult.documents.length;

    let inserted = 0;
    let upsertedIds: string[] = [];
    if (scraperResult.documents.length > 0) {
      try {
        const result = await upsertDocuments(
          scraperResult.documents.map((d) => ({
            township_id: township.id,
            type: d.type,
            title: d.title,
            date: d.date,
            source_url: d.sourceUrl,
            content: d.content,
            file_url: d.fileUrl,
            ai_summary: null,
            scraped_at: new Date().toISOString(),
          }))
        );
        inserted = result.inserted;
        upsertedIds = result.ids;
        summary.totalInserted += inserted;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[orchestrator] upsertDocuments failed for ${township.id}:`, err);
        summary.errors.push({ townshipId: township.id, message: `upsert: ${msg}` });
        hadPipelineError = true;
      }
    }

    // Fire-and-forget summarization — never blocks document persistence
    if (upsertedIds.length > 0 && process.env.ANTHROPIC_API_KEY) {
      summarizeUpsertedDocs(upsertedIds, township.id).catch((err) =>
        console.warn("[orchestrator] Summarization failed (non-fatal):", err)
      );
    }

    // Fire-and-forget area insights — synthesizes recent docs into a township-level overview
    if (inserted > 0 && process.env.ANTHROPIC_API_KEY) {
      generateInsightsForTownship(township).catch((err) =>
        console.warn("[orchestrator] Area insights failed (non-fatal):", err)
      );
    }

    // Always advance the queue — pass actual counts so back-off is correct
    await markTownshipScraped(township.id, {
      newDocsInserted: inserted,
      hadError: hadPipelineError,
    }).catch((err) =>
      console.warn("[orchestrator] markTownshipScraped failed:", err)
    );

    for (const e of scraperResult.errors) {
      summary.errors.push({ townshipId: township.id, message: `[${e.type}] ${e.message}` });
    }
  }

  return summary;
}

/**
 * Generate a township-level area insight from recent documents.
 * Runs fire-and-forget — errors are caught by the caller.
 */
async function generateInsightsForTownship(township: Township): Promise<void> {
  const { generateAreaInsights } = await import("../src/lib/ai/insights");
  const { setTownshipInsights } = await import("../src/lib/db/townships");
  const { getRecentDocumentsWithContent } = await import("../src/lib/db/documents");

  const docs = await getRecentDocumentsWithContent(township.id, 10);
  const insights = await generateAreaInsights(township.name, township.state, docs);
  if (insights) await setTownshipInsights(township.id, insights);
}

/**
 * Generate AI summaries for documents that were just upserted.
 * Runs fire-and-forget — errors are caught by the caller.
 */
async function summarizeUpsertedDocs(
  ids: string[],
  townshipId: string
): Promise<void> {
  const { generateDocumentSummary, isSummarizable } = await import(
    "../src/lib/ai/summarize"
  );
  const { setDocumentSummary, getDocumentsNeedingSummary } = await import(
    "../src/lib/db/documents"
  );

  // Fetch back DB rows so we have canonical content + IDs
  const needsSummary = await getDocumentsNeedingSummary({ townshipId, limit: 100 });
  const inThisRun = needsSummary.filter((d) => ids.includes(d.id));

  for (const doc of inThisRun) {
    if (!isSummarizable(doc.content)) continue;
    try {
      const summary = await generateDocumentSummary({
        title: doc.title,
        type: doc.type,
        date: doc.date,
        content: doc.content!,
      });
      if (summary) await setDocumentSummary(doc.id, summary);
    } catch (err) {
      console.warn(`[orchestrator] Summary failed for ${doc.id}:`, err);
    }
  }
}
