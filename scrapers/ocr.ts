/**
 * Text extraction pipeline for documents found during scraping.
 *
 * Strategy (in order of preference):
 *   1. Direct PDF text extraction via pdf-parse (fast, no external calls)
 *   2. Tesseract.js OCR on rendered page images (for scanned/image-only PDFs)
 *   3. Return null — caller logs the failure and stores the document without content
 *
 * The caller decides whether to attempt OCR based on ScraperConfig.skipOcr.
 */

import type { Browser } from "@playwright/test";

/** Result from any extraction method. */
export interface ExtractionResult {
  text: string | null;
  method: "pdf-parse" | "ocr" | "html" | "none";
  pageCount?: number;
}

/**
 * Extract text from a PDF buffer using pdf-parse v2's PDFParse class.
 * Returns null if extraction fails or the PDF has no selectable text.
 */
export async function extractPdfText(buffer: Buffer): Promise<ExtractionResult> {
  let parser: { destroy(): Promise<void> } | null = null;
  try {
    // pdf-parse v2 uses a named class export, not a default function
    const { PDFParse } = await import("pdf-parse");
    parser = new PDFParse({ data: buffer });
    const result = await (parser as { getText(): Promise<{ text: string; numpages?: number }> }).getText();
    const text = result.text.trim();
    if (!text) {
      return { text: null, method: "pdf-parse", pageCount: result.numpages };
    }
    return { text, method: "pdf-parse", pageCount: result.numpages };
  } catch (err) {
    console.warn("[ocr] pdf-parse failed:", err);
    return { text: null, method: "none" };
  } finally {
    await parser?.destroy().catch(() => {});
  }
}

/**
 * Render a PDF page as an image using Playwright, then OCR it with Tesseract.js.
 * Only called when direct PDF text extraction returns empty content.
 *
 * @param pdfUrl - URL to the PDF (Playwright will navigate to it)
 * @param browser - existing Playwright Browser instance (shared with caller)
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

    const text = await runTesseract(screenshot);
    return { text: text || null, method: "ocr" };
  } catch (err) {
    console.warn("[ocr] Playwright OCR failed for", pdfUrl, ":", err);
    return { text: null, method: "none" };
  } finally {
    await context.close();
  }
}

/**
 * Extract visible text from a plain HTML page using Playwright.
 * Used for township pages that list documents inline (no PDF).
 */
export async function extractHtmlText(
  url: string,
  browser: Browser
): Promise<ExtractionResult> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    // Remove nav, header, footer noise; grab main content
    const text = await page.evaluate(() => {
      const selectors = ["main", "article", "#content", ".content", "body"];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el.innerText;
      }
      return document.body.innerText;
    });
    return { text: text?.trim() || null, method: "html" };
  } catch (err) {
    console.warn("[ocr] HTML extraction failed for", url, ":", err);
    return { text: null, method: "none" };
  } finally {
    await context.close();
  }
}

/**
 * Download a remote file as a Buffer.
 */
export async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LocalizeNewsBot/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.warn(`[ocr] fetchBuffer ${url} returned HTTP ${res.status}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn("[ocr] fetchBuffer failed for", url, ":", err);
    return null;
  }
}

/**
 * Run Tesseract.js OCR on a PNG/JPEG buffer.
 * Returns the recognised text string (may be empty).
 */
async function runTesseract(imageBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import — tesseract.js is large; only load when OCR is needed
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
