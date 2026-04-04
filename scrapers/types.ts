import type { DocumentType } from "../src/lib/db/types";

/** Result returned by every scraper — does NOT write directly to the DB. */
export interface ScraperResult {
  townshipId: string;
  documents: ScrapedDocument[];
  errors: string[];
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
}
