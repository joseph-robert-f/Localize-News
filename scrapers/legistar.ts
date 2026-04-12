/**
 * Shared Legistar scraper utility.
 *
 * Legistar is a common municipal government platform used by Boston, Nashville,
 * Denver, Columbus, and many other US cities. All instances share the same
 * calendar URL structure and document download pattern.
 *
 * Calendar: https://{subdomain}.legistar.com/Calendar.aspx
 * Documents: https://{subdomain}.legistar.com/View.ashx?M=A&ID=...&GUID=...
 */

import { chromium } from "@playwright/test";
import { fetchBuffer, extractPdfText } from "./ocr";
import type { ScrapedDocument, ScraperError } from "./types";

const USER_AGENT = "LocalizeNewsBot/1.0 (+https://localizenews.app/bot)";

/** Max meetings to process per scraper run — prevents runaway PDF downloads */
const MAX_MEETINGS = 20;

interface LegistarMeeting {
  body: string;
  date: string;
  agendaUrl: string | null;
  minutesUrl: string | null;
}

/**
 * Scrape a Legistar-based municipal calendar for agenda and minutes documents.
 * Returns structured documents and any non-fatal errors encountered.
 */
export async function scrapeLegistar(
  subdomain: string
): Promise<{ documents: ScrapedDocument[]; errors: ScraperError[] }> {
  const baseUrl = `https://${subdomain}.legistar.com`;
  const calendarUrl = `${baseUrl}/Calendar.aspx`;
  const documents: ScrapedDocument[] = [];
  const errors: ScraperError[] = [];

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    console.log(`[legistar:${subdomain}] Loading calendar…`);
    const response = await page.goto(calendarUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    if (!response?.ok()) {
      errors.push({
        type: "network",
        message: `Calendar returned HTTP ${response?.status() ?? "no response"}`,
        url: calendarUrl,
      });
      await context.close();
      return { documents, errors };
    }

    // Extract meeting rows that have linked agenda or minutes PDFs.
    // Legistar renders server-side HTML; anchor .href gives absolute URLs in-browser.
    const meetings: LegistarMeeting[] = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      const results: LegistarMeeting[] = [];

      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 4) continue;

        const anchors = Array.from(row.querySelectorAll("a[href]")) as HTMLAnchorElement[];
        const agendaAnchor = anchors.find(
          (a) => a.textContent?.trim() === "Agenda" && a.href.includes("View.ashx")
        );
        const minutesAnchor = anchors.find(
          (a) => a.textContent?.trim() === "Minutes" && a.href.includes("View.ashx")
        );

        if (!agendaAnchor && !minutesAnchor) continue;

        const bodyText = cells[0]?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const dateText = cells[1]?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (!bodyText || !dateText) continue;

        results.push({
          body: bodyText,
          date: dateText,
          agendaUrl: agendaAnchor?.href ?? null,
          minutesUrl: minutesAnchor?.href ?? null,
        });
      }

      return results;
    });

    await context.close();
    console.log(`[legistar:${subdomain}] Found ${meetings.length} meetings with documents`);

    if (meetings.length === 0) {
      errors.push({
        type: "parse",
        message: "No meetings with documents found — calendar structure may have changed",
        url: calendarUrl,
      });
      return { documents, errors };
    }

    // Fetch PDFs for each meeting (capped to avoid long runs)
    for (const meeting of meetings.slice(0, MAX_MEETINGS)) {
      const dateStr = parseDateFromText(meeting.date);

      const pairs: Array<["agenda" | "minutes", string]> = [];
      if (meeting.agendaUrl) pairs.push(["agenda", meeting.agendaUrl]);
      if (meeting.minutesUrl) pairs.push(["minutes", meeting.minutesUrl]);

      for (const [docType, url] of pairs) {
        let content: string | null = null;
        try {
          const buffer = await fetchBuffer(url);
          if (buffer) {
            const extracted = await extractPdfText(buffer);
            content = extracted.text;
          }
        } catch (err) {
          console.warn(`[legistar:${subdomain}] PDF fetch failed for ${url}:`, err);
          errors.push({
            type: "network",
            message: err instanceof Error ? err.message : String(err),
            url,
          });
        }

        const label = docType === "agenda" ? "Agenda" : "Minutes";
        documents.push({
          type: docType,
          title: `${meeting.body} — ${label} ${meeting.date}`.replace(/\s+/g, " ").trim(),
          date: dateStr,
          sourceUrl: url,
          fileUrl: url,
          content,
        });
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[legistar:${subdomain}] Done: ${documents.length} documents, ${errors.length} errors`);
  return { documents, errors };
}

/** Parse "M/D/YYYY" or "Month D, YYYY" date strings into ISO 8601. */
export function parseDateFromText(text: string): string | null {
  // MM/DD/YYYY
  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // "January 8, 2026" or "Jan. 8, 2026"
  const longMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (longMatch) {
    const d = new Date(`${longMatch[1]} ${longMatch[2]} ${longMatch[3]}`);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}
