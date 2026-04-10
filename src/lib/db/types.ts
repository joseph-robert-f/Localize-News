/**
 * Shared TypeScript types for the data model.
 * Keep this in sync with the Supabase schema (migrations/001_initial_schema.sql).
 *
 * Note: All model types must be `type` aliases (not `interface`) so they satisfy
 * Record<string, unknown> constraints required by @supabase/supabase-js generics.
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

export type Township = {
  id: string;
  name: string;
  state: string;
  website_url: string;
  status: TownshipStatus;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TownshipDocument = {
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
};

export type ScrapeRequest = {
  id: string;
  township_name: string;
  website_url: string;
  contact_email: string | null;
  notes: string | null;
  status: ScrapeRequestStatus;
  reviewed_at: string | null;
  created_at: string;
};

export type ScrapeRun = {
  id: string;
  township_id: string | null;
  triggered_by: ScrapeRunTrigger;
  status: ScrapeRunStatus;
  documents_found: number;
  documents_inserted: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

/** Minimal DB type wrapper for Supabase generics — expand as the schema grows. */
export type Database = {
  public: {
    Tables: {
      townships: {
        Row: Township;
        // last_scraped_at is NULL by default — optional on insert
        Insert: Omit<Township, "id" | "created_at" | "updated_at" | "last_scraped_at"> & {
          last_scraped_at?: string | null;
        };
        Update: Partial<Township>;
        Relationships: [];
      };
      documents: {
        Row: TownshipDocument;
        Insert: Omit<TownshipDocument, "id" | "created_at">;
        Update: Partial<TownshipDocument>;
        Relationships: [];
      };
      scrape_requests: {
        Row: ScrapeRequest;
        // reviewed_at/contact_email/notes are NULL by default — optional on insert
        Insert: Omit<ScrapeRequest, "id" | "created_at" | "reviewed_at" | "contact_email" | "notes"> & {
          reviewed_at?: string | null;
          contact_email?: string | null;
          notes?: string | null;
        };
        Update: Partial<ScrapeRequest>;
        Relationships: [];
      };
      scrape_runs: {
        Row: ScrapeRun;
        // All fields except township_id/triggered_by/status have DB defaults — optional on insert
        Insert: Omit<ScrapeRun, "id" | "documents_found" | "documents_inserted" | "error_message" | "started_at" | "finished_at"> & {
          documents_found?: number;
          documents_inserted?: number;
          error_message?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: Partial<ScrapeRun>;
        Relationships: [];
      };
    };
    // Required by @supabase/supabase-js GenericSchema — empty but must be present
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
