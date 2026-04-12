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
  ai_summary: string | null;     // Claude-generated 2–3 sentence summary
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

/**
 * Converts an interface to a homomorphic mapped type.
 * Required for Supabase v2 + TypeScript 5.9: the client's GenericSchema constraint
 * uses `extends Record<string, unknown>`, which TS 5.9 only satisfies for mapped types,
 * not for plain interfaces. Without this, Schema resolves to `never` and all db calls break.
 */
type AsRow<T> = { [K in keyof T]: T[K] };

/**
 * Insert shapes — omit DB-generated fields (id, created_at, updated_at) and mark
 * nullable/DB-defaulted columns as optional so callers don't have to supply them.
 */
type TownshipInsert = {
  name: string;
  state: string;
  website_url: string;
  status?: TownshipStatus;
  last_scraped_at?: string | null;
};

type DocumentInsert = {
  township_id: string;
  type: DocumentType;
  title: string;
  source_url: string;
  scraped_at: string;
  date?: string | null;
  content?: string | null;
  file_url?: string | null;
  ai_summary?: string | null;
};

type ScrapeRequestInsert = {
  township_name: string;
  website_url: string;
  status?: ScrapeRequestStatus;
  contact_email?: string | null;
  notes?: string | null;
  reviewed_at?: string | null;
};

type ScrapeRunInsert = {
  triggered_by: ScrapeRunTrigger;
  township_id?: string | null;
  status?: ScrapeRunStatus;
  documents_found?: number;
  documents_inserted?: number;
  error_message?: string | null;
  started_at?: string;
  finished_at?: string | null;
};

/** DB type wrapper for Supabase generics (v2.101+ / TypeScript 5.9 compatible). */
export interface Database {
  public: {
    Tables: {
      townships: {
        Row: AsRow<Township>;
        Insert: AsRow<TownshipInsert>;
        Update: AsRow<Partial<Township>>;
        Relationships: [];
      };
      documents: {
        Row: AsRow<TownshipDocument>;
        Insert: AsRow<DocumentInsert>;
        Update: AsRow<Partial<TownshipDocument>>;
        Relationships: [];
      };
      scrape_requests: {
        Row: AsRow<ScrapeRequest>;
        Insert: AsRow<ScrapeRequestInsert>;
        Update: AsRow<Partial<ScrapeRequest>>;
        Relationships: [];
      };
      scrape_runs: {
        Row: AsRow<ScrapeRun>;
        Insert: AsRow<ScrapeRunInsert>;
        Update: AsRow<Partial<ScrapeRun>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
