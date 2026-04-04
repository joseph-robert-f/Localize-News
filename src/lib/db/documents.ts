import { createServerClient } from "../supabase";
import type { TownshipDocument, DocumentType } from "./types";

/** Fetch recent documents for a township, newest first. */
export async function getDocumentsByTownship(
  townshipId: string,
  opts: { limit?: number; type?: DocumentType } = {}
): Promise<TownshipDocument[]> {
  const db = createServerClient();
  let query = db
    .from("documents")
    .select("*")
    .eq("township_id", townshipId)
    .order("date", { ascending: false, nullsFirst: false })
    .order("scraped_at", { ascending: false });

  if (opts.type) query = query.eq("type", opts.type);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(`getDocumentsByTownship: ${error.message}`);
  return data ?? [];
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
