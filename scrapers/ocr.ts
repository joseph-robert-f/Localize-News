/**
 * Text extraction pipeline for documents found during scraping.
 *
 * Strategy (in order of preference):
 *   1. Direct PDF text extraction via pdf-parse v2 (fast, no external calls)
 *   2. Tesseract.js OCR on rendered page images (for scanned/image-only PDFs)
 *   3. Return null — caller logs the failure and stores the document without content
 *
 * fetchBuffer has retry + backoff logic: retries up to MAX_RETRIES times on
 * network/timeout errors; does NOT retry on 4xx (client errors).
 */

import type { Browser } from "@playwright/test";

// ─── Config ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000; // 1s → 2s → 4s

/** Cap extracted text at ~500 KB to avoid exceeding DB column / payload limits. */
const MAX_CONTENT_CHARS = 500_000;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Result from any extraction method. */
export interface ExtractionResult {
  text: string | null;
  method: "pdf-parse" | "ocr" | "html" | "none";
  pageCount?: number;
}

// ─── Retry utility ───────────────────────────────────────────────────────────

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true for errors that are worth retrying (transient network/timeout).
 * 4xx responses are NOT retried — they indicate a permanent client error.
 */
function isRetryable(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("abort") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    // 5xx server errors are transient and worth retrying
    /http 5\d\d/.test(msg)
  );
}

// ─── fetchBuffer ─────────────────────────────────────────────────────────────

/**
 * Download a remote file as a Buffer.
 * Retries up to MAX_RETRIES times on transient network/timeout errors
 * with exponential backoff. Does not retry on 4xx responses.
 */
export async function fetchBuffer(url: string): Promise<Buffer | null> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`[ocr] fetchBuffer retry ${attempt}/${MAX_RETRIES} for ${url} (waiting ${delay}ms)`);
      await sleep(delay);
    }

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "LocalizeNewsBot/1.0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      // Client errors (4xx) → not retryable
      if (res.status >= 400 && res.status < 500) {
        console.warn(`[ocr] fetchBuffer ${url} → HTTP ${res.status} (not retrying)`);
        return null;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) {
        console.warn(`[ocr] fetchBuffer non-retryable error for ${url}:`, err);
        return null;
      }
    }
  }

  console.warn(`[ocr] fetchBuffer exhausted retries for ${url}:`, lastErr);
  return null;
}

// ─── PDF extraction ──────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer using pdf-parse v2's PDFParse class.
 * Returns null if extraction fails or the PDF has no selectable text.
 */
export async function extractPdfText(buffer: Buffer): Promise<ExtractionResult> {
  let parser: { destroy(): Promise<void> } | null = null;
  try {
    const { PDFParse } = await import("pdf-parse");
    parser = new PDFParse({ data: buffer });
    const result = await (
      parser as unknown as { getText(): Promise<{ text: string; total?: number }> }
    ).getText();
    const text = result.text.trim();
    if (!text) {
      return { text: null, method: "pdf-parse", pageCount: result.total };
    }
    const truncated = text.length > MAX_CONTENT_CHARS ? text.slice(0, MAX_CONTENT_CHARS) : text;
    return { text: truncated, method: "pdf-parse", pageCount: result.total };
  } catch (err) {
    console.warn("[ocr] pdf-parse failed:", err);
    return { text: null, method: "none" };
  } finally {
    await parser?.destroy().catch(() => {});
  }
}

// ─── OCR via Playwright ──────────────────────────────────────────────────────

/**
 * Render a PDF page as an image using Playwright, then OCR it with Tesseract.js.
 * Only called when direct PDF text extraction returns empty content.
 */
export async function ocrPdfWithPlaywright(
  pdfUrl: string,
  browser: Browser
): Promise<ExtractionResult> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(pdfUrl, { waitUntil: "networkidle", timeout: 30_000 });
    const screenshot = await page.screenshot({ fullPage: true });
    const raw = await runTesseract(screenshot);
    const text = raw.length > MAX_CONTENT_CHARS ? raw.slice(0, MAX_CONTENT_CHARS) : raw;
    return { text: text || null, method: "ocr" };
  } catch (err) {
    console.warn("[ocr] Playwright OCR failed for", pdfUrl, ":", err);
    return { text: null, method: "none" };
  } finally {
    await context.close();
  }
}

// ─── HTML extraction ─────────────────────────────────────────────────────────

/**
 * Extract visible text from a plain HTML page using Playwright.
 */
export async function extractHtmlText(
  url: string,
  browser: Browser
): Promise<ExtractionResult> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    const raw = await page.evaluate(() => {
      const selectors = ["main", "article", "#content", ".content", "body"];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return (el as HTMLElement).innerText;
      }
      return document.body.innerText;
    });
    const trimmed = raw?.trim() ?? "";
    const text = trimmed.length > MAX_CONTENT_CHARS ? trimmed.slice(0, MAX_CONTENT_CHARS) : trimmed;
    return { text: text || null, method: "html" };
  } catch (err) {
    console.warn("[ocr] HTML extraction failed for", url, ":", err);
    return { text: null, method: "none" };
  } finally {
    await context.close();
  }
}

// ─── Tesseract ───────────────────────────────────────────────────────────────

async function runTesseract(imageBuffer: Buffer): Promise<string> {
  try {
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng");
    const { data } = await worker.recognize(imageBuffer);
    await worker.terminate();
    return data.text.trim();
  } catch (err) {
    console.warn("[ocr] Tesseract failed:", err);
    return "";
  }
}
