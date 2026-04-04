/**
 * Core scraper pipeline.
 *
 * Flow for each township:
 *   1. Build search queries from the township name/state
 *   2. Run searches → collect candidate document URLs
 *   3. For each URL:
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
  searchDuckDuckGo,
  filterDocumentUrls,
} from "./search";
import {
  fetchBuffer,
  extractPdfText,
  ocrPdfWithPlaywright,
  extractHtmlText,
} from "./ocr";
import type { ScraperConfig, ScraperResult, ScrapedDocument } from "./types";
import type { DocumentType } from "../src/lib/db/types";

const PDF_EXT = /\.pdf(\?.*)?$/i;
const MAX_URLS_PER_QUERY = 5;
const MAX_TOTAL_DOCS = 40; // safety cap per run

/** Infer document type from URL and title text. */
function classifyDocument(title: string, url: string): DocumentType {
  const text = (title + " " + url).toLowerCase();
  if (/\bbudget\b/.test(text)) return "budget";
  if (/\bproposal\b|\brfp\b|\bbid\b/.test(text)) return "proposal";
  if (/\bminutes?\b/.test(text)) return "minutes";
  if (/\bagenda\b/.test(text)) return "agenda";
  return "other";
}

/** Parse a date string from a title or URL (best-effort). */
function parseDate(text: string): string | null {
  // Match patterns like "2025-03-15", "March 15, 2025", "03/15/2025"
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

/**
 * Run the full discovery pipeline for a single township.
 */
export async function runScraperPipeline(
  config: ScraperConfig & { state: string }
): Promise<ScraperResult> {
  const result: ScraperResult = {
    townshipId: config.townshipId,
    documents: [],
    errors: [],
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const queries = buildSearchQueries(config.townshipName, config.state);
    const seen = new Set<string>();

    for (const query of queries) {
      if (result.documents.length >= MAX_TOTAL_DOCS) break;

      console.log(`[pipeline] Searching: "${query}"`);
      const searchResults = await searchDuckDuckGo(query);
      const filtered = filterDocumentUrls(searchResults).slice(0, MAX_URLS_PER_QUERY);

      for (const hit of filtered) {
        if (result.documents.length >= MAX_TOTAL_DOCS) break;
        if (seen.has(hit.url)) continue;
        seen.add(hit.url);

        console.log(`[pipeline] Processing: ${hit.url}`);
        const doc = await processUrl(hit.url, hit.title, browser, config.skipOcr ?? false);
        if (doc) result.documents.push(doc);
      }
    }

    // Also crawl the township's own website for linked documents
    console.log(`[pipeline] Crawling township site: ${config.websiteUrl}`);
    const siteDocs = await crawlTownshipSite(config.websiteUrl, browser, seen);
    for (const doc of siteDocs) {
      if (result.documents.length >= MAX_TOTAL_DOCS) break;
      result.documents.push(doc);
    }

    console.log(
      `[pipeline] Done: ${result.documents.length} documents found for ${config.townshipName}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error(`[pipeline] Fatal error for ${config.townshipName}:`, err);
  } finally {
    await browser.close();
  }

  return result;
}

/** Process a single URL — download and extract content. */
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

  // If no text was extracted and OCR is allowed, try rendering + OCR
  if (!extraction.text && !skipOcr) {
    console.log(`[pipeline] Falling back to OCR for ${url}`);
    extraction = await ocrPdfWithPlaywright(url, browser);
  }

  const type = classifyDocument(title, url);
  const date = parseDate(title) ?? parseDate(url);

  return {
    type,
    title: title || url.split("/").pop() || "Document",
    date,
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
  const type = classifyDocument(title, url);
  const date = parseDate(title) ?? parseDate(url);

  return {
    type,
    title: title || url,
    date,
    sourceUrl: url,
    fileUrl: null,
    content: extraction.text,
  };
}

/**
 * Crawl a township's own website and collect links to documents.
 * Visits the homepage and looks for PDF links up to 2 levels deep.
 */
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

    // Collect all links to PDFs and likely-document pages
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors
        .map((a) => ({ href: (a as HTMLAnchorElement).href, text: a.textContent?.trim() ?? "" }))
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
      const type = classifyDocument(text, href);
      const date = parseDate(text) ?? parseDate(href);
      docs.push({
        type,
        title: text || href.split("/").pop() || "Document",
        date,
        sourceUrl: href,
        fileUrl: PDF_EXT.test(href) ? href : null,
        content: null, // defer extraction to avoid crawl timeout
      });
    }
  } catch (err) {
    console.warn(`[pipeline] crawlTownshipSite failed for ${siteUrl}:`, err);
  } finally {
    await context.close();
  }

  return docs;
}
