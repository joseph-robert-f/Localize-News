/**
 * Shared TypeScript types for the data model.
 * Keep this in sync with the Supabase schema (migrations/001_initial_schema.sql).
 */

export type TownshipStatus = "pending" | "active" | "error" | "unsupported";
export type DocumentType = "agenda" | "minutes" | "proposal" | "budget" | "other";

/** Canonical ordered list of all document types — use this instead of re-declaring in each file. */
export const DOCUMENT_TYPES: readonly DocumentType[] = [
  "agenda", "minutes", "proposal", "budget", "other",
];
export type ScrapeRequestStatus = "pending" | "approved" | "rejected";
export type ScrapeRunStatus = "running" | "success" | "error";
export type ScrapeRunTrigger = "cron" | "admin" | "manual";

export interface Township {
  id: string;
  name: string;
  state: string;
  website_url: string;
  status: TownshipStatus;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TownshipDocument {
  id: string;
  township_id: string;
  type: DocumentType;
  title: string;
  date: string | null;           // ISO 8601 date string
  source_url: string;
  content: string | null;        // extracted text, if available
  file_url: string | null;       // original PDF/file link, if available
  scraped_at: string;
  created_at: string;
}

export interface ScrapeRequest {
  id: string;
  township_name: string;
  website_url: string;
  contact_email: string | null;
  notes: string | null;
  status: ScrapeRequestStatus;
  reviewed_at: string | null;
  created_at: string;
}

export interface ScrapeRun {
  id: string;
  township_id: string | null;
  triggered_by: ScrapeRunTrigger;
  status: ScrapeRunStatus;
  documents_found: number;
  documents_inserted: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

/** Minimal DB type wrapper for Supabase generics — expand as the schema grows. */
export interface Database {
  public: {
    Tables: {
      townships: { Row: Township; Insert: Omit<Township, "id" | "created_at" | "updated_at">; Update: Partial<Township> };
      documents: { Row: TownshipDocument; Insert: Omit<TownshipDocument, "id" | "created_at">; Update: Partial<TownshipDocument> };
      scrape_requests: { Row: ScrapeRequest; Insert: Omit<ScrapeRequest, "id" | "created_at">; Update: Partial<ScrapeRequest> };
      scrape_runs: { Row: ScrapeRun; Insert: Omit<ScrapeRun, "id">; Update: Partial<ScrapeRun> };
    };
  };
}
