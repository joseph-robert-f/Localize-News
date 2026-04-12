/**
 * Scraper: City of Portland, OR
 *
 * Target: https://www.portland.gov
 * Documents: City Council ordinances, resolutions, and reports
 *
 * Portland uses a custom Next.js-based document portal (not Legistar).
 * Documents at /council/documents — ordinances and resolutions map to "proposal",
 * reports map to "other". Agendas scraped from /council/agenda.
 *
 * Run in isolation:
 *   npx tsx scrapers/portland-or.ts
 */

import { chromium } from "@playwright/test";
import type { ScraperResult, ScrapedDocument } from "./types";
import type { DocumentType } from "../src/lib/db/types";

const TOWNSHIP_ID_PLACEHOLDER = "00000000-0000-0000-0000-000000000014";
const BASE_URL = "https://www.portland.gov";

const PAGES = {
  documents: `${BASE_URL}/council/documents`,
  agenda: `${BASE_URL}/council/agenda`,
};

/** Map Portland document type strings to our DocumentType enum. */
function mapPortlandType(rawType: string): DocumentType {
  const t = rawType.toLowerCase();
  if (t.includes("ordinance") || t.includes("resolution")) return "proposal";
  if (t.includes("budget") || t.includes("financial")) return "budget";
  if (t.includes("agenda")) return "agenda";
  if (t.includes("minutes")) return "minutes";
  return "other";
}

export async function scrapePortlandOR(
  townshipId = TOWNSHIP_ID_PLACEHOLDER
): Promise<ScraperResult> {
  const result: ScraperResult = { townshipId, documents: [], errors: [] };
  const browser = await chromium.launch({ headless: true });

  try {
    console.log("[portland-or] Scraping council documents list…");
    result.documents.push(
      ...(await scrapeDocumentList(PAGES.documents, browser, result))
    );

    console.log("[portland-or] Scraping current agenda…");
    result.documents.push(
      ...(await scrapeAgendaPage(PAGES.agenda, browser, result))
    );

    console.log(
      `[portland-or] Done: ${result.documents.length} documents, ${result.errors.length} errors`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[portland-or] Fatal error:", err);
    result.errors.push({ type: "unknown", message: msg });
  } finally {
    await browser.close();
  }

  return result;
}

async function scrapeDocumentList(
  pageUrl: string,
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
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    if (!response?.ok()) {
      result.errors.push({
        type: "network",
        message: `Documents list returned HTTP ${response?.status()}`,
        url: pageUrl,
      });
      return docs;
    }

    // Extract document links from the listing
    const items = await page.evaluate((base) => {
      const anchors = Array.from(
        document.querySelectorAll("a[href*='/council/documents/']")
      ) as HTMLAnchorElement[];

      return anchors
        .map((a) => {
          const href = a.href;
          const text = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
          // Infer type from URL path: /council/documents/{type}/...
          const pathParts = new URL(href).pathname.split("/").filter(Boolean);
          const rawType = pathParts[2] ?? "other"; // e.g. "ordinance", "resolution"
          return { href, text, rawType };
        })
        .filter((item) => item.text.length > 3 && !item.href.includes("?"));
    }, BASE_URL);

    console.log(`[portland-or] Found ${items.length} document links`);

    if (items.length === 0) {
      result.errors.push({
        type: "parse",
        message: "No document links found — page structure may have changed",
        url: pageUrl,
      });
      return docs;
    }

    // Fetch content from individual document pages (limit to avoid long runs)
    for (const { href, text, rawType } of items.slice(0, 20)) {
      const docPage = await context.newPage();
      let content: string | null = null;
      let date: string | null = null;

      try {
        const res = await docPage.goto(href, {
          waitUntil: "domcontentloaded",
          timeout: 15_000,
        });
        if (res?.ok()) {
          // Extract main content and date from the document detail page
          const extracted = await docPage.evaluate(() => {
            const main =
              document.querySelector("main") ??
              document.querySelector("article") ??
              document.body;
            const dateEl = document.querySelector(
              "time, [datetime], .field--name-field-date, .date"
            ) as HTMLElement | null;
            return {
              content: main?.innerText?.replace(/\s+/g, " ").slice(0, 4000) ?? null,
              dateAttr:
                dateEl?.getAttribute("datetime") ??
                dateEl?.textContent?.trim() ??
                null,
            };
          });
          content = extracted.content;
          if (extracted.dateAttr) date = parsePortlandDate(extracted.dateAttr);
        }
      } catch (err) {
        console.warn(`[portland-or] Failed to fetch doc page ${href}:`, err);
      } finally {
        await docPage.close();
      }

      docs.push({
        type: mapPortlandType(rawType),
        title: text || href.split("/").pop()?.replace(/-/g, " ") || "Document",
        date,
        sourceUrl: href,
        fileUrl: null,
        content,
      });
    }
  } catch (err) {
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

async function scrapeAgendaPage(
  pageUrl: string,
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
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    if (!response?.ok()) {
      result.errors.push({
        type: "network",
        message: `Agenda page returned HTTP ${response?.status()}`,
        url: pageUrl,
      });
      return docs;
    }

    const content = await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      return main?.innerText?.replace(/\s+/g, " ").slice(0, 4000) ?? null;
    });

    const title = await page.title();
    const dateMatch = pageUrl.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    const date = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : null;

    if (content) {
      docs.push({
        type: "agenda",
        title: title.replace(/ [-|].*$/, "").trim() || "City Council Agenda",
        date,
        sourceUrl: pageUrl,
        fileUrl: null,
        content,
      });
    }
  } catch (err) {
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

function parsePortlandDate(value: string): string | null {
  // ISO datetime: "2026-04-08T..." or "2026-04-08"
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  // "April 8, 2026"
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

// ── Standalone runner ─────────────────────────────────────────────────────────
if (require.main === module) {
  scrapePortlandOR()
    .then((result) => {
      console.log("\n─── Result ───");
      console.log(`Documents: ${result.documents.length}`);
      console.log(`Errors:    ${result.errors.length}`);
      for (const doc of result.documents.slice(0, 5)) {
        console.log(`  [${doc.type}] ${doc.title} (${doc.date ?? "no date"})`);
      }
      if (result.errors.length > 0) console.log("Errors:", result.errors);
    })
    .catch(console.error);
}
