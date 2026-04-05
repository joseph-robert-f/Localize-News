import { createServerClient } from "../supabase";
import type { TownshipDocument, DocumentType } from "./types";

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

/** Decode a cursor back into its parts. */
function decodeCursor(cursor: DocumentCursor): { date: string; id: string } | null {
  const idx = cursor.lastIndexOf("|");
  if (idx === -1) return null;
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

/** Upsert a batch of documents for a township (idempotent — keyed on township_id + source_url). */
export async function upsertDocuments(
  docs: Omit<TownshipDocument, "id" | "created_at">[]
): Promise<{ inserted: number }> {
  if (docs.length === 0) return { inserted: 0 };
  const db = createServerClient();
  const { data, error } = await db
    .from("documents")
    .upsert(docs, { onConflict: "township_id,source_url", ignoreDuplicates: false })
    .select("id");
  if (error) throw new Error(`upsertDocuments: ${error.message}`);
  return { inserted: data?.length ?? 0 };
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
  if (error) throw new Error(`searchDocuments: ${error.message}`);
  return data ?? [];
}

/** Search documents joined with township name — used by the /search page. */
export interface DocumentWithTownship extends TownshipDocument {
  township_name: string;
  township_state: string;
}

export async function searchDocumentsWithTownship(
  query: string,
  opts: { type?: DocumentType; limit?: number } = {}
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

  const { data, error } = await q;
  if (error) throw new Error(`searchDocumentsWithTownship: ${error.message}`);

  return (data ?? []).map((row) => {
    const { townships: t, ...doc } = row as typeof row & {
      townships: { name: string; state: string; status: string };
    };
    return {
      ...doc,
      township_name: t.name,
      township_state: t.state,
    } as DocumentWithTownship;
  });
}
