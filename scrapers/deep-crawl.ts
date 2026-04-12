/**
 * Deep-crawl utility for PDF-only township websites.
 *
 * Problem with the naive site crawler:
 *   - Only visits the homepage — misses /clerk/, /meetings/, /agendas/ sub-pages
 *   - Returns documents with content: null (URLs only, never downloads PDFs)
 *   - Uses raw filenames / anchor text for titles instead of PDF metadata
 *
 * This module replaces crawlTownshipSite with a keyword-guided multi-level
 * crawl that:
 *   1. Visits the homepage and finds all internal links
 *   2. Follows links whose URL or anchor text contains document-related keywords
 *      (agendas, minutes, clerk, meetings, etc.) — up to maxDepth levels
 *   3. Collects all PDF links discovered on each page
 *   4. Downloads each PDF and extracts text + metadata immediately
 *   5. Builds clean titles from: PDF metadata > anchor text > filename cleanup
 *   6. Extracts dates from: PDF metadata > anchor text > filename
 *
 * Safety limits:
 *   - maxDepth = 2  (avoids runaway crawling)
 *   - maxPdfs  = 30 (avoids excessive downloads per run)
 *   - Same-host only (never follows external links)
 *   - Deduplication via the shared `seen` Set passed in by the pipeline
 */

import type { Browser } from "@playwright/test";
import { fetchBuffer, extractPdfText } from "./ocr";
import type { ScrapedDocument } from "./types";
import type { DocumentType } from "../src/lib/db/types";

// ── Config ─────────────────────────────────────────────────────────────────

const PDF_EXT = /\.pdf(\?.*)?$/i;

/**
 * URL path segments and anchor text patterns that suggest a page will contain
 * meeting documents. Checked case-insensitively against both the href and
 * the link's visible text.
 */
const DOC_PAGE_PATTERNS = [
  "agenda", "minute", "meeting", "council", "board",
  "commission", "clerk", "document", "record", "ordinance",
  "resolution", "budget", "finance", "government", "legislative",
  "public-notice", "notice", "calendar",
];

const DOC_PAGE_RE = new RegExp(DOC_PAGE_PATTERNS.join("|"), "i");

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Crawl a township website, find PDFs, extract their text, and return
 * structured documents. Drop-in replacement for the shallow `crawlTownshipSite`.
 *
 * @param siteUrl   Township's website_url from the DB
 * @param browser   Shared Playwright browser instance (already launched)
 * @param seen      Deduplication Set — URLs already processed this run
 * @param maxDepth  How many levels of internal links to follow (default 2)
 * @param maxPdfs   Maximum PDFs to download per run (default 30)
 */
export async function deepCrawl(
  siteUrl: string,
  browser: Browser,
  seen: Set<string>,
  maxDepth = 2,
  maxPdfs = 30
): Promise<ScrapedDocument[]> {
  const docs: ScrapedDocument[] = [];
  const visitedPages = new Set<string>();

  let host: string;
  try {
    host = new URL(siteUrl).hostname;
  } catch {
    console.warn("[deep-crawl] Invalid siteUrl:", siteUrl);
    return docs;
  }

  // BFS queue: [pageUrl, depth]
  const queue: Array<[string, number]> = [[siteUrl, 0]];

  while (queue.length > 0 && docs.length < maxPdfs) {
    const entry = queue.shift();
    if (!entry) break;
    const [pageUrl, depth] = entry;

    if (visitedPages.has(pageUrl)) continue;
    visitedPages.add(pageUrl);

    console.log(`[deep-crawl] Visiting (depth=${depth}): ${pageUrl}`);

    let pageLinks: PageLink[] = [];
    try {
      pageLinks = await extractLinksFromPage(pageUrl, browser, host);
    } catch (err) {
      console.warn(`[deep-crawl] Failed to load ${pageUrl}:`, err);
      continue;
    }

    // ── Process PDFs found on this page ───────────────────────────────────
    const pdfLinks = pageLinks.filter((l) => PDF_EXT.test(l.href));

    for (const link of pdfLinks) {
      if (seen.has(link.href) || docs.length >= maxPdfs) break;
      seen.add(link.href);

      const doc = await downloadAndExtract(link);
      if (doc) docs.push(doc);
    }

    // ── Enqueue document-adjacent sub-pages ───────────────────────────────
    if (depth < maxDepth) {
      const subPages = pageLinks.filter(
        (l) => !PDF_EXT.test(l.href) && DOC_PAGE_RE.test(l.href + " " + l.text)
      );

      for (const link of subPages) {
        if (!visitedPages.has(link.href)) {
          queue.push([link.href, depth + 1]);
        }
      }
    }
  }

  console.log(`[deep-crawl] Finished: ${docs.length} PDFs from ${visitedPages.size} pages`);
  return docs;
}

// ── Link extraction ────────────────────────────────────────────────────────

interface PageLink {
  href: string;
  text: string;
}

async function extractLinksFromPage(
  url: string,
  browser: Browser,
  sameHost: string
): Promise<PageLink[]> {
  const context = await browser.newContext({
    userAgent: "LocalizeNewsBot/1.0 (+https://localizenews.app/bot)",
  });
  const page = await context.newPage();

  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    if (!res?.ok()) {
      console.warn(`[deep-crawl] ${url} returned HTTP ${res?.status()}`);
      return [];
    }

    const links: PageLink[] = await page.evaluate((host) => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: (a.textContent ?? "").replace(/\s+/g, " ").trim(),
        }))
        .filter(({ href }) => {
          try {
            const u = new URL(href);
            // Same host only; skip mailto/tel/javascript
            return u.hostname === host && (u.protocol === "http:" || u.protocol === "https:");
          } catch {
            return false;
          }
        });
    }, sameHost);

    return links;
  } finally {
    await context.close();
  }
}

// ── PDF download + metadata extraction ────────────────────────────────────

async function downloadAndExtract(link: PageLink): Promise<ScrapedDocument | null> {
  const buffer = await fetchBuffer(link.href);
  if (!buffer) return null;

  const extraction = await extractPdfText(buffer);

  // Try to pull metadata from the PDF itself
  const metadata = await extractPdfMetadata(buffer);

  const title = buildTitle(link.text, link.href, metadata.title);
  const date  = buildDate(link.text, link.href, metadata.creationDate);
  const type  = classifyDocument(title, link.href);

  return {
    type,
    title,
    date,
    sourceUrl: link.href,
    fileUrl: link.href,
    content: extraction.text,
  };
}

// ── PDF metadata ───────────────────────────────────────────────────────────

interface PdfMetadata {
  title: string | null;
  creationDate: string | null;
}

async function extractPdfMetadata(buffer: Buffer): Promise<PdfMetadata> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await (parser as unknown as {
      getText(): Promise<{ text: string; info?: Record<string, string> }>;
    }).getText();
    await (parser as unknown as { destroy(): Promise<void> }).destroy().catch(() => {});

    const info = result.info ?? {};
    const rawTitle = info["Title"]?.trim() || null;
    const rawDate  = info["CreationDate"] || info["ModDate"] || null;

    return {
      title: rawTitle && rawTitle.length > 3 ? rawTitle : null,
      creationDate: rawDate ? parsePdfDate(rawDate) : null,
    };
  } catch {
    return { title: null, creationDate: null };
  }
}

/**
 * PDF dates are encoded as "D:YYYYMMDDHHmmSSOHH'mm'" or plain ISO strings.
 * Returns "YYYY-MM-DD" or null.
 */
function parsePdfDate(raw: string): string | null {
  // "D:20260115120000+00'00'" → "2026-01-15"
  const dMatch = raw.match(/^D:(\d{4})(\d{2})(\d{2})/);
  if (dMatch) return `${dMatch[1]}-${dMatch[2]}-${dMatch[3]}`;
  // ISO or near-ISO
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

// ── Title / date / type helpers ────────────────────────────────────────────

function buildTitle(
  anchorText: string,
  url: string,
  pdfTitle: string | null
): string {
  // Prefer PDF metadata title if it looks meaningful (more than 5 chars)
  if (pdfTitle && pdfTitle.length > 5) return pdfTitle;

  // Clean anchor text: non-empty and not just the filename
  const cleaned = anchorText.trim();
  if (cleaned && cleaned.length > 4 && !cleaned.toLowerCase().endsWith(".pdf")) {
    return cleaned;
  }

  // Fall back to filename, cleaned up
  const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return filename || "Document";
}

function buildDate(
  anchorText: string,
  url: string,
  pdfDate: string | null
): string | null {
  if (pdfDate) return pdfDate;

  // Search anchor text + URL for recognisable date patterns
  const haystack = anchorText + " " + url;

  // YYYY-MM-DD
  const iso = haystack.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  // MM/DD/YYYY or M/D/YYYY
  const slash = haystack.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;

  // "January 15 2026" / "Jan-15-2026" / compact "20260115"
  const long = haystack.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s\-](\d{1,2})[,\s\-]*(\d{4})\b/i
  );
  if (long) {
    const d = new Date(`${long[1]} ${long[2]}, ${long[3]}`);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }

  // Compact 8-digit: 20260115
  const compact = haystack.match(/\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  return null;
}

function classifyDocument(title: string, url: string): DocumentType {
  const text = (title + " " + url).toLowerCase();
  if (/\bbudget\b/.test(text)) return "budget";
  if (/\bproposal\b|\brfp\b|\bbid\b/.test(text)) return "proposal";
  if (/\bminutes?\b/.test(text)) return "minutes";
  if (/\bagenda\b/.test(text)) return "agenda";
  return "other";
}
