import type { ScrapedDocument } from "./types";

/**
 * Returns true if a scraped document falls within the requested date window.
 * Documents with no parseable date are always included (we keep unknowns).
 */
export function isDocumentRecent(doc: ScrapedDocument, sinceDate: Date | undefined): boolean {
  if (!sinceDate || !doc.date) return true;
  const d = new Date(doc.date);
  return !isNaN(d.getTime()) && d >= sinceDate;
}
