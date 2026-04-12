import type { DocumentType } from "../src/lib/db/types";

/** Result returned by every scraper — does NOT write directly to the DB. */
export interface ScraperResult {
  townshipId: string;
  documents: ScrapedDocument[];
  errors: ScraperError[];
}

/** Classification of what went wrong in a scraper error. */
export type ScraperErrorType = "network" | "timeout" | "parse" | "auth" | "unknown";

/** A structured error from a scraper run (replaces plain strings). */
export interface ScraperError {
  type: ScraperErrorType;
  message: string;
  url?: string;
}

/** A single document discovered during a scrape run. */
export interface ScrapedDocument {
  type: DocumentType;
  title: string;
  date: string | null;        // ISO 8601 date string, or null if unknown
  sourceUrl: string;          // canonical URL where the document was found
  fileUrl: string | null;     // direct link to the PDF/file, if different from sourceUrl
  content: string | null;     // extracted text (PDF parse or OCR result)
}

/** Configuration for a township-specific scraper. */
export interface ScraperConfig {
  townshipId: string;
  townshipName: string;
  websiteUrl: string;
  /** Keywords to append to web searches (e.g. ["agenda", "minutes", "budget"]) */
  searchKeywords?: string[];
  /** Skip OCR even if text extraction fails (useful for well-structured sites). */
  skipOcr?: boolean;
  /** Only include documents on or after this date. Undated documents are always kept. */
  sinceDate?: Date;
}

/** Classify a caught error into a ScraperErrorType. */
export function classifyError(err: unknown, url?: string): ScraperError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  let type: ScraperErrorType = "unknown";
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("abort")) {
    type = "timeout";
  } else if (
    lower.includes("network") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("fetch failed")
  ) {
    type = "network";
  } else if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized")) {
    type = "auth";
  } else if (
    lower.includes("parse") ||
    lower.includes("invalid pdf") ||
    lower.includes("unexpected token")
  ) {
    type = "parse";
  }

  return { type, message, url };
}
