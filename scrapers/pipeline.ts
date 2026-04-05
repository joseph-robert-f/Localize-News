/**
 * Core scraper pipeline.
 *
 * Flow for each township:
 *   1. Build search queries from the township name/state
 *   2. Run searches → collect candidate document URLs
 *   3. Process each URL concurrently (capped at CONCURRENCY limit):
 *      a. If .pdf: download buffer → pdf-parse → OCR fallback (if enabled)
 *      b. If HTML: Playwright page → extract visible text + any linked PDFs
 *   4. Classify documents (agenda / minutes / budget / etc.)
 *   5. Return structured ScraperResult (no DB writes here)
 *
 * The pipeline is intentionally stateless. The caller (API route or scraper script)
 * is responsible for persisting results via lib/db helpers.
 */

import { chromium } from "@playwright/test";
import {
  buildSearchQueries,
  getSearchProvider,
  filterDocumentUrls,
} from "./search";
import {
  fetchBuffer,
  extractPdfText,
  ocrPdfWithPlaywright,
  extractHtmlText,
} from "./ocr";
import type { ScraperConfig, ScraperResult, ScrapedDocument } from "./types";
import { classifyError } from "./types";
import type { DocumentType } from "../src/lib/db/types";

// ─── Config ──────────────────────────────────────────────────────────────────

const PDF_EXT = /\.pdf(\?.*)?$/i;
const MAX_URLS_PER_QUERY = 5;
const MAX_TOTAL_DOCS = 40;      // safety cap per run
const CONCURRENCY = 3;          // max simultaneous PDF downloads / HTML fetches

// ─── Concurrency semaphore ────────────────────────────────────────────────────

/**
 * A minimal async semaphore — avoids adding p-limit as a dependency.
 * Limits concurrent async tasks to `limit` at a time.
 */
function createSemaphore(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function release() {
    active--;
    if (queue.length > 0) {
      active++;
      queue.shift()!();
    }
  }

  return async function acquire<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        fn().then(resolve, reject).finally(release);
      };
      if (active < limit) {
        active++;
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

// ─── Document classification & date parsing ───────────────────────────────────

function classifyDocument(title: string, url: string): DocumentType {
  const text = (title + " " + url).toLowerCase();
  if (/\bbudget\b/.test(text)) return "budget";
  if (/\bproposal\b|\brfp\b|\bbid\b/.test(text)) return "proposal";
  if (/\bminutes?\b/.test(text)) return "minutes";
  if (/\bagenda\b/.test(text)) return "agenda";
  return "other";
}

function parseDate(text: string): string | null {
  const patterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4}\b/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const d = new Date(m[0]);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }
  }
  return null;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runScraperPipeline(
  config: ScraperConfig & { state: string }
): Promise<ScraperResult> {
  const result: ScraperResult = {
    townshipId: config.townshipId,
    documents: [],
    errors: [],
  };

  const browser = await chromium.launch({ headless: true });
  const searchProvider = getSearchProvider();
  const throttle = createSemaphore(CONCURRENCY);

  try {
    const queries = buildSearchQueries(config.townshipName, config.state);
    const seen = new Set<string>();

    // ── Collect all candidate URLs across all search queries ────────────────
    const candidates: Array<{ url: string; title: string }> = [];

    for (const query of queries) {
      if (candidates.length >= MAX_TOTAL_DOCS * 2) break; // avoid over-fetching

      console.log(`[pipeline] Searching: "${query}"`);
      const searchResults = await searchProvider.search(query);
      const filtered = filterDocumentUrls(searchResults).slice(0, MAX_URLS_PER_QUERY);

      for (const hit of filtered) {
        if (!seen.has(hit.url)) {
          seen.add(hit.url);
          candidates.push({ url: hit.url, title: hit.title });
        }
      }
    }

    // Also crawl the township's own website
    console.log(`[pipeline] Crawling township site: ${config.websiteUrl}`);
    const siteDocs = await crawlTownshipSite(config.websiteUrl, browser, seen);
    result.documents.push(...siteDocs.slice(0, MAX_TOTAL_DOCS - result.documents.length));

    // ── Process all candidates concurrently (capped) ────────────────────────
    const tasks = candidates
      .slice(0, MAX_TOTAL_DOCS)
      .map(({ url, title }) =>
        throttle(async () => {
          console.log(`[pipeline] Processing: ${url}`);
          const doc = await processUrl(url, title, browser, config.skipOcr ?? false);
          if (doc) result.documents.push(doc);
        })
      );

    const settled = await Promise.allSettled(tasks);
    for (const outcome of settled) {
      if (outcome.status === "rejected") {
        result.errors.push(classifyError(outcome.reason));
      }
    }

    console.log(
      `[pipeline] Done: ${result.documents.length} docs, ${result.errors.length} errors for ${config.townshipName}`
    );
  } catch (err) {
    result.errors.push(classifyError(err));
    console.error(`[pipeline] Fatal error for ${config.townshipName}:`, err);
  } finally {
    await browser.close();
  }

  return result;
}

// ─── Per-URL processing ───────────────────────────────────────────────────────

async function processUrl(
  url: string,
  title: string,
  browser: Parameters<typeof ocrPdfWithPlaywright>[1],
  skipOcr: boolean
): Promise<ScrapedDocument | null> {
  try {
    if (PDF_EXT.test(url)) {
      return await processPdfUrl(url, title, browser, skipOcr);
    }
    return await processHtmlUrl(url, title, browser);
  } catch (err) {
    console.warn(`[pipeline] Failed to process ${url}:`, err);
    return null;
  }
}

async function processPdfUrl(
  url: string,
  title: string,
  browser: Parameters<typeof ocrPdfWithPlaywright>[1],
  skipOcr: boolean
): Promise<ScrapedDocument | null> {
  const buffer = await fetchBuffer(url);
  if (!buffer) return null;

  let extraction = await extractPdfText(buffer);

  if (!extraction.text && !skipOcr) {
    console.log(`[pipeline] Falling back to OCR for ${url}`);
    extraction = await ocrPdfWithPlaywright(url, browser);
  }

  return {
    type: classifyDocument(title, url),
    title: title || url.split("/").pop() || "Document",
    date: parseDate(title) ?? parseDate(url),
    sourceUrl: url,
    fileUrl: url,
    content: extraction.text,
  };
}

async function processHtmlUrl(
  url: string,
  title: string,
  browser: Parameters<typeof extractHtmlText>[1]
): Promise<ScrapedDocument | null> {
  const extraction = await extractHtmlText(url, browser);
  return {
    type: classifyDocument(title, url),
    title: title || url,
    date: parseDate(title) ?? parseDate(url),
    sourceUrl: url,
    fileUrl: null,
    content: extraction.text,
  };
}

// ─── Township site crawler ───────────────────────────────────────────────────

async function crawlTownshipSite(
  siteUrl: string,
  browser: Parameters<typeof extractHtmlText>[1],
  seen: Set<string>
): Promise<ScrapedDocument[]> {
  const docs: ScrapedDocument[] = [];
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });

    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors
        .map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: a.textContent?.trim() ?? "",
        }))
        .filter(
          ({ href, text }) =>
            href.startsWith("http") &&
            (href.endsWith(".pdf") ||
              /agenda|minutes|budget|proposal/i.test(text) ||
              /agenda|minutes|budget|proposal/i.test(href))
        )
        .slice(0, 30);
    });

    for (const { href, text } of links) {
      if (seen.has(href) || docs.length >= 20) break;
      seen.add(href);
      docs.push({
        type: classifyDocument(text, href),
        title: text || href.split("/").pop() || "Document",
        date: parseDate(text) ?? parseDate(href),
        sourceUrl: href,
        fileUrl: PDF_EXT.test(href) ? href : null,
        content: null,
      });
    }
  } catch (err) {
    console.warn(`[pipeline] crawlTownshipSite failed for ${siteUrl}:`, err);
  } finally {
    await context.close();
  }

  return docs;
}
