import { createServerClient } from "../supabase";
import type { TownshipDocument, DocumentType } from "./types";
import { DOCUMENT_TYPES } from "./types";
import { MIN_SUMMARIZABLE_LENGTH } from "../ai/summarize";

export const PAGE_SIZE = 24; // default page size for document lists

/**
 * Cursor shape: ISO date string + document UUID, joined with "|".
 * Example: "2026-01-15|550e8400-e29b-41d4-a716-446655440000"
 *
 * We encode both date and id so the cursor survives ties in date values.
 */
export type DocumentCursor = string;

export interface DocumentPage {
  documents: TownshipDocument[];
  /** Pass this as `cursor` in the next call to get the next page. Null if no more pages. */
  nextCursor: DocumentCursor | null;
}

/** Encode the cursor from the last document in a page. */
function encodeCursor(doc: TownshipDocument): DocumentCursor {
  return `${doc.date ?? "0000-00-00"}|${doc.id}`;
}

// Cursor format: ISO date (YYYY-MM-DD or 0000-00-00) + "|" + UUID v4
const CURSOR_RE = /^\d{4}-\d{2}-\d{2}\|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Decode a cursor back into its parts. Returns null if format is invalid. */
function decodeCursor(cursor: DocumentCursor): { date: string; id: string } | null {
  if (!CURSOR_RE.test(cursor)) return null;
  const idx = cursor.lastIndexOf("|");
  return { date: cursor.slice(0, idx), id: cursor.slice(idx + 1) };
}

/** Fetch recent documents for a township, newest first, with cursor pagination. */
export async function getDocumentsByTownship(
  townshipId: string,
  opts: { pageSize?: number; cursor?: DocumentCursor; type?: DocumentType } = {}
): Promise<DocumentPage> {
  const db = createServerClient();
  const pageSize = opts.pageSize ?? PAGE_SIZE;

  let query = db
    .from("documents")
    .select("*")
    .eq("township_id", townshipId)
    .order("date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false }) // tie-break by id for stable pagination
    .limit(pageSize + 1); // fetch one extra to detect if there's a next page

  if (opts.type) query = query.eq("type", opts.type);

  // Apply cursor: return documents older than (date, id) of the last seen doc
  if (opts.cursor) {
    const decoded = decodeCursor(opts.cursor);
    if (decoded) {
      // Documents where date < cursor.date, OR (date = cursor.date AND id < cursor.id)
      query = query.or(
        `date.lt.${decoded.date},and(date.eq.${decoded.date},id.lt.${decoded.id})`
      );
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`getDocumentsByTownship: ${error.message}`);

  const rows = data ?? [];
  const hasMore = rows.length > pageSize;
  const documents = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor =
    hasMore && documents.length > 0 ? encodeCursor(documents[documents.length - 1]) : null;

  return { documents, nextCursor };
}

/** Strip null bytes and other control characters PostgreSQL JSON rejects. */
function sanitizeText(text: string | null): string | null {
  if (!text) return text;
  // \u0000 (null byte) causes "unsupported Unicode escape sequence" in Postgres JSON
  return text.replace(/\u0000/g, "").replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/** Upsert a batch of documents for a township (idempotent — keyed on township_id + source_url). */
export async function upsertDocuments(
  docs: (Omit<TownshipDocument, "id" | "created_at" | "ai_summary" | "topics"> & {
    ai_summary?: string | null;
    topics?: string[] | null;
  })[]
): Promise<{ inserted: number; ids: string[] }> {
  if (docs.length === 0) return { inserted: 0, ids: [] };
  const db = createServerClient();
  const sanitized = docs.map((d) => ({
    ...d,
    title: sanitizeText(d.title) ?? d.title,
    content: sanitizeText(d.content),
    // Preserve existing ai_summary/topics on re-scrape — only set if explicitly provided
    ai_summary: d.ai_summary !== undefined ? sanitizeText(d.ai_summary) : null,
    topics: d.topics ?? null,
  }));
  const { data, error } = await db
    .from("documents")
    .upsert(sanitized, { onConflict: "township_id,source_url", ignoreDuplicates: false })
    .select("id");
  if (error) throw new Error(`upsertDocuments: ${error.message}`);
  return { inserted: data?.length ?? 0, ids: data?.map((r) => r.id) ?? [] };
}

/** Persist an AI-generated summary for a document. */
export async function setDocumentSummary(id: string, summary: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("documents")
    .update({ ai_summary: summary })
    .eq("id", id);
  if (error) throw new Error(`setDocumentSummary: ${error.message}`);
}

/** Return documents that have content but no AI summary yet (for batch summarization). */
export async function getDocumentsNeedingSummary(
  opts: { limit?: number; townshipId?: string } = {}
): Promise<TownshipDocument[]> {
  const db = createServerClient();
  let q = db
    .from("documents")
    .select("*")
    .is("ai_summary", null)
    .not("content", "is", null)
    .limit(opts.limit ?? 50);
  if (opts.townshipId) q = q.eq("township_id", opts.townshipId);
  const { data, error } = await q;
  if (error) throw new Error(`getDocumentsNeedingSummary: ${error.message}`);
  // Filter by minimum content length in JS (PostgREST has no char_length filter)
  return (data ?? []).filter((d) => (d.content?.length ?? 0) >= MIN_SUMMARIZABLE_LENGTH);
}

/** Return the most recent minutes/agenda documents that have an AI summary. */
export async function getRecentSummaries(
  townshipId: string,
  limit = 3
): Promise<TownshipDocument[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("documents")
    .select("*")
    .eq("township_id", townshipId)
    .in("type", ["minutes", "agenda"])
    .not("ai_summary", "is", null)
    .order("date", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`getRecentSummaries: ${error.message}`);
  return data ?? [];
}

/**
 * Return the most recent documents for a township that have content or an AI summary.
 * Used by the area insights generator to feed Claude cross-document synthesis.
 */
export async function getRecentDocumentsWithContent(
  townshipId: string,
  limit = 10
): Promise<TownshipDocument[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("documents")
    .select("*")
    .eq("township_id", townshipId)
    .or("content.not.is.null,ai_summary.not.is.null")
    .order("date", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`getRecentDocumentsWithContent: ${error.message}`);
  return data ?? [];
}

/** Persist AI-extracted topic tags for a document. */
export async function setDocumentTopics(id: string, topics: string[]): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("documents")
    .update({ topics })
    .eq("id", id);
  if (error) throw new Error(`setDocumentTopics: ${error.message}`);
}

/**
 * Return documents that have enough content/summary for topic extraction
 * but have not yet had topics generated (topics IS NULL).
 */
export async function getDocumentsNeedingTopics(
  opts: { limit?: number; townshipId?: string } = {}
): Promise<TownshipDocument[]> {
  const db = createServerClient();
  let q = db
    .from("documents")
    .select("*")
    .is("topics", null)
    .or("ai_summary.not.is.null,content.not.is.null")
    .limit(opts.limit ?? 50);
  if (opts.townshipId) q = q.eq("township_id", opts.townshipId);
  const { data, error } = await q;
  if (error) throw new Error(`getDocumentsNeedingTopics: ${error.message}`);
  // Must have at least some usable text
  return (data ?? []).filter(
    (d) => (d.ai_summary?.length ?? 0) >= 20 || (d.content?.length ?? 0) >= MIN_SUMMARIZABLE_LENGTH
  );
}

/**
 * Return the most common topic tags for a township, sorted by frequency.
 * Aggregated in JS from the topics[] array on each document.
 */
export async function getTopTopics(
  townshipId: string,
  limit = 10
): Promise<Array<{ topic: string; count: number }>> {
  const db = createServerClient();
  const { data, error } = await db
    .from("documents")
    .select("topics")
    .eq("township_id", townshipId)
    .not("topics", "is", null);
  if (error) throw new Error(`getTopTopics: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    for (const topic of row.topics ?? []) {
      counts[topic] = (counts[topic] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }));
}

/** Count documents grouped by type for a township. */
export async function getDocumentCounts(
  townshipId: string
): Promise<Record<DocumentType, number>> {
  const db = createServerClient();
  const { data, error } = await db
    .from("documents")
    .select("type")
    .eq("township_id", townshipId);
  if (error) throw new Error(`getDocumentCounts: ${error.message}`);

  const counts: Record<DocumentType, number> = {
    agenda: 0, minutes: 0, proposal: 0, budget: 0, other: 0,
  };
  for (const row of data ?? []) {
    counts[row.type as DocumentType] += 1;
  }
  return counts;
}

/** Search documents by full-text across title and content. */
export async function searchDocuments(
  query: string,
  opts: { townshipId?: string; limit?: number } = {}
): Promise<TownshipDocument[]> {
  const db = createServerClient();
  let q = db
    .from("documents")
    .select("*")
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order("date", { ascending: false })
    .limit(opts.limit ?? 20);

  if (opts.townshipId) q = q.eq("township_id", opts.townshipId);

  const { data, error } = await q;
  if (error) throw new Error("searchDocuments failed");
  return data ?? [];
}

/** Count all indexed documents across active townships — used by the home page stats bar. */
export async function getTotalDocumentCount(): Promise<number> {
  const db = createServerClient();
  const { count, error } = await db
    .from("documents")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error("getTotalDocumentCount failed");
  return count ?? 0;
}

/**
 * Return monthly document counts for the last 12 months for a given township.
 * Zero-fills months with no documents so charts always have 12 data points.
 */
export async function getDocumentMonthCounts(
  townshipId: string
): Promise<Array<{ month: string; label: string; count: number }>> {
  const db = createServerClient();
  const { data, error } = await db
    .from("documents")
    .select("date")
    .eq("township_id", townshipId)
    .not("date", "is", null);
  if (error) throw new Error("getDocumentMonthCounts failed");

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const month = (row.date as string).slice(0, 7); // "YYYY-MM"
    counts[month] = (counts[month] ?? 0) + 1;
  }

  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const result: Array<{ month: string; label: string; count: number }> = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ month, label: MONTH_LABELS[d.getMonth()], count: counts[month] ?? 0 });
  }
  return result;
}

/**
 * Return the most recent document for each type that has at least one document.
 * Used by the township page "Quick links" section.
 */
export async function getMostRecentByType(
  townshipId: string
): Promise<Partial<Record<DocumentType, TownshipDocument>>> {
  const db = createServerClient();
  const results = await Promise.all(
    DOCUMENT_TYPES.map(async (type) => {
      const { data } = await db
        .from("documents")
        .select("*")
        .eq("township_id", townshipId)
        .eq("type", type)
        .order("date", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      return [type, data] as const;
    })
  );
  return Object.fromEntries(
    results.filter(([, doc]) => doc !== null)
  ) as Partial<Record<DocumentType, TownshipDocument>>;
}

/** Search documents joined with township name — used by the /search page. */
export interface DocumentWithTownship extends TownshipDocument {
  township_name: string;
  township_state: string;
}

export async function searchDocumentsWithTownship(
  query: string,
  opts: { type?: DocumentType; limit?: number; days?: number } = {}
): Promise<DocumentWithTownship[]> {
  if (!query.trim()) return [];

  const db = createServerClient();
  let q = db
    .from("documents")
    .select(
      `*, townships!inner(name, state, status)`
    )
    // Use fts column when available (after migration 003), fall back to ILIKE
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    // Only return documents from active townships
    .eq("townships.status", "active")
    .order("date", { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 30);

  if (opts.type) q = q.eq("type", opts.type);

  if (opts.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - opts.days);
    q = q.gte("date", cutoff.toISOString().slice(0, 10));
  }

  const { data, error } = await q;
  if (error) throw new Error(`searchDocumentsWithTownship: ${error.message}`);

  return (data ?? []).map((row) => {
    const typedRow = row as Record<string, unknown> & {
      townships: { name: string; state: string; status: string };
    };
    const { townships: t, ...doc } = typedRow;
    return {
      ...doc,
      township_name: t.name,
      township_state: t.state,
    } as DocumentWithTownship;
  });
}
