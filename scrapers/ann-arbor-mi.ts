/**
 * Scraper: City of Ann Arbor, MI
 *
 * Target: https://www.a2gov.org
 * Documents: City Council agendas, meeting minutes, city budget documents
 *
 * Ann Arbor is known for strong government transparency and maintains
 * a well-organized public records portal.
 *
 * Run in isolation:
 *   npx tsx scrapers/ann-arbor-mi.ts
 */

import { chromium } from "@playwright/test";
import { fetchBuffer, extractPdfText } from "./ocr";
import type { ScraperResult, ScrapedDocument } from "./types";
import type { DocumentType } from "../src/lib/db/types";

const TOWNSHIP_ID_PLACEHOLDER = "00000000-0000-0000-0000-000000000005";
const BASE_URL = "https://www.a2gov.org";

const PAGES = {
  agendas: `${BASE_URL}/departments/city-clerk/Pages/City-Council-Agendas.aspx`,
  minutes: `${BASE_URL}/departments/city-clerk/Pages/City-Council-Minutes.aspx`,
  budgets: `${BASE_URL}/departments/finance/Pages/Budget.aspx`,
};

export async function scrapeAnnArborMI(
  townshipId = TOWNSHIP_ID_PLACEHOLDER
): Promise<ScraperResult> {
  const result: ScraperResult = { townshipId, documents: [], errors: [] };
  const browser = await chromium.launch({ headless: true });

  try {
    console.log("[ann-arbor-mi] Scraping agendas…");
    result.documents.push(...await scrapeDocumentPage(PAGES.agendas, "agenda", browser, result));

    console.log("[ann-arbor-mi] Scraping minutes…");
    result.documents.push(...await scrapeDocumentPage(PAGES.minutes, "minutes", browser, result));

    console.log("[ann-arbor-mi] Scraping budget documents…");
    result.documents.push(...await scrapeDocumentPage(PAGES.budgets, "budget", browser, result));

    console.log(
      `[ann-arbor-mi] Done: ${result.documents.length} documents, ${result.errors.length} errors`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ann-arbor-mi] Fatal error:", err);
    result.errors.push({ type: "unknown", message: msg });
  } finally {
    await browser.close();
  }

  return result;
}

async function scrapeDocumentPage(
  pageUrl: string,
  type: DocumentType,
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  result: ScraperResult
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
      console.warn(`[ann-arbor-mi] ${pageUrl} returned ${response?.status()}`);
      result.errors.push({
        type: "network",
        message: `Page returned ${response?.status() ?? "no response"}`,
        url: pageUrl,
      });
      return docs;
    }

    // Ann Arbor's site uses SharePoint-style links; also check for direct PDF hrefs
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors
        .map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: a.textContent?.replace(/\s+/g, " ").trim() ?? "",
        }))
        .filter(({ href }) =>
          href.endsWith(".pdf") ||
          href.includes(".pdf?") ||
          href.includes("agenda") ||
          href.includes("minutes") ||
          href.includes("budget") ||
          href.includes("document") ||
          href.includes("Agenda") ||
          href.includes("Minutes")
        );
    });

    console.log(`[ann-arbor-mi] Found ${links.length} candidate links on ${pageUrl}`);

    if (links.length === 0) {
      result.errors.push({
        type: "parse",
        message: `No document links found on ${pageUrl} — site structure may have changed`,
        url: pageUrl,
      });
      return docs;
    }

    for (const { href, text } of links.slice(0, 25)) {
      let content: string | null = null;
      let fileUrl: string | null = null;

      const isPdf = /\.pdf(\?.*)?$/i.test(href);
      if (isPdf) {
        fileUrl = href;
        const buffer = await fetchBuffer(href);
        if (buffer) {
          const extracted = await extractPdfText(buffer);
          content = extracted.text;
        }
      }

      docs.push({
        type,
        title: text || href.split("/").pop()?.replace(/[-_]/g, " ") || "Document",
        date: parseDateFromText(text) ?? parseDateFromUrl(href),
        sourceUrl: href,
        fileUrl,
        content,
      });
    }
  } catch (err) {
    console.warn(`[ann-arbor-mi] Error scraping ${pageUrl}:`, err);
    result.errors.push({
      type: "unknown",
      message: err instanceof Error ? err.message : String(err),
      url: pageUrl,
    });
  } finally {
    await context.close();
  }

  return docs;
}

function parseDateFromText(text: string): string | null {
  const match = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+\d{1,2},?\s+\d{4}\b/i
  );
  if (match) {
    const d = new Date(match[0].replace(/\.$/, ""));
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

function parseDateFromUrl(url: string): string | null {
  const slug = url.split("/").pop() ?? "";
  const iso = slug.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = slug.match(/(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return null;
}

// ── Standalone runner ─────────────────────────────────────────────────────────
if (require.main === module) {
  scrapeAnnArborMI()
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
