/**
 * Scraper: Springfield Township, IL
 *
 * This is the reference implementation. Copy and adapt it for each new township.
 *
 * Pattern:
 *   1. Navigate to the township's meetings/documents page.
 *   2. Collect all relevant links (agendas, minutes, budgets) with titles and dates.
 *   3. Return a structured ScraperResult — never write to the DB directly.
 *
 * The orchestrator (scrapers/index.ts) handles persistence via lib/db helpers.
 *
 * Run in isolation:
 *   npx tsx scrapers/springfield-il.ts
 */

import { chromium } from "@playwright/test";
import { fetchBuffer, extractPdfText } from "./ocr";
import type { ScraperResult, ScrapedDocument } from "./types";
import type { DocumentType } from "../src/lib/db/types";

const TOWNSHIP_ID_PLACEHOLDER = "00000000-0000-0000-0000-000000000001"; // replaced by DB at runtime
const BASE_URL = "https://www.springfield.il.us";

// Page paths to check — update these when the site structure changes
const PAGES = {
  agendas:  `${BASE_URL}/government/city-council/agendas`,
  minutes:  `${BASE_URL}/government/city-council/minutes`,
  budgets:  `${BASE_URL}/departments/finance/budget`,
};

export async function scrapeSpringfieldIL(townshipId = TOWNSHIP_ID_PLACEHOLDER): Promise<ScraperResult> {
  const result: ScraperResult = { townshipId, documents: [], errors: [] };
  const browser = await chromium.launch({ headless: true });

  try {
    // ── Agendas ───────────────────────────────────────────────────────────────
    console.log("[springfield-il] Scraping agendas…");
    const agendaDocs = await scrapeDocumentPage(
      PAGES.agendas,
      "agenda",
      browser
    );
    result.documents.push(...agendaDocs);

    // ── Minutes ───────────────────────────────────────────────────────────────
    console.log("[springfield-il] Scraping minutes…");
    const minuteDocs = await scrapeDocumentPage(
      PAGES.minutes,
      "minutes",
      browser
    );
    result.documents.push(...minuteDocs);

    // ── Budget ────────────────────────────────────────────────────────────────
    console.log("[springfield-il] Scraping budget documents…");
    const budgetDocs = await scrapeDocumentPage(
      PAGES.budgets,
      "budget",
      browser
    );
    result.documents.push(...budgetDocs);

    console.log(
      `[springfield-il] Done: ${result.documents.length} documents, ${result.errors.length} errors`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[springfield-il] Fatal error:", err);
    result.errors.push(msg);
  } finally {
    await browser.close();
  }

  return result;
}

/**
 * Visit a township listing page and collect all PDF/document links.
 * Extracts text content for PDFs that have selectable text.
 */
async function scrapeDocumentPage(
  pageUrl: string,
  type: DocumentType,
  browser: Awaited<ReturnType<typeof chromium.launch>>
): Promise<ScrapedDocument[]> {
  const docs: ScrapedDocument[] = [];
  const context = await browser.newContext({
    userAgent: "LocalizeNewsBot/1.0 (+https://localizenews.app/bot)",
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    if (!response || !response.ok()) {
      console.warn(`[springfield-il] ${pageUrl} returned ${response?.status()}`);
      return docs;
    }

    // Collect all anchor links that look like documents
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors
        .map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: a.textContent?.replace(/\s+/g, " ").trim() ?? "",
        }))
        .filter(
          ({ href }) =>
            href.endsWith(".pdf") ||
            href.includes("document") ||
            href.includes("agenda") ||
            href.includes("minutes") ||
            href.includes("budget")
        );
    });

    console.log(`[springfield-il] Found ${links.length} candidate links on ${pageUrl}`);

    for (const { href, text } of links.slice(0, 25)) {
      // Attempt PDF text extraction for PDFs
      let content: string | null = null;
      let fileUrl: string | null = null;

      if (href.toLowerCase().endsWith(".pdf")) {
        fileUrl = href;
        const buffer = await fetchBuffer(href);
        if (buffer) {
          const extracted = await extractPdfText(buffer);
          content = extracted.text;
        }
      }

      docs.push({
        type,
        title: text || href.split("/").pop()?.replace(/-|_/g, " ") || "Document",
        date: parseDateFromText(text) ?? parseDateFromUrl(href),
        sourceUrl: href,
        fileUrl,
        content,
      });
    }
  } catch (err) {
    console.warn(`[springfield-il] Error scraping ${pageUrl}:`, err);
  } finally {
    await context.close();
  }

  return docs;
}

/** Try to extract a date from a link's visible text. */
function parseDateFromText(text: string): string | null {
  // "January 15, 2026" or "Jan. 15, 2026"
  const match = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+\d{1,2},?\s+\d{4}\b/i
  );
  if (match) {
    const d = new Date(match[0].replace(/\.$/, ""));
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

/** Try to extract a date from a URL slug. */
function parseDateFromUrl(url: string): string | null {
  // "2026-01-15" or "20260115"
  const slug = url.split("/").pop() ?? "";
  const iso = slug.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = slug.match(/(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return null;
}

// ── Standalone runner ─────────────────────────────────────────────────────────
// Run with: npx tsx scrapers/springfield-il.ts
if (require.main === module) {
  scrapeSpringfieldIL()
    .then((result) => {
      console.log("\n─── Result ───");
      console.log(`Documents: ${result.documents.length}`);
      console.log(`Errors: ${result.errors.length}`);
      for (const doc of result.documents.slice(0, 5)) {
        console.log(`  [${doc.type}] ${doc.title} (${doc.date ?? "no date"})`);
      }
      if (result.errors.length > 0) {
        console.log("Errors:", result.errors);
      }
    })
    .catch(console.error);
}
