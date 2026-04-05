/**
 * GET /api/search?q=...&type=...&limit=...
 *
 * Public endpoint. Searches documents across all active townships.
 * Returns documents with their township name and state joined in.
 *
 * Query params:
 *   q      — search query (required, min 2 chars)
 *   type   — filter by document type (optional)
 *   limit  — number of results, 1–50, default 30 (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { searchDocumentsWithTownship } from "@/lib/db/documents";
import { DOCUMENT_TYPES } from "@/lib/db/types";
import type { DocumentType } from "@/lib/db/types";

const VALID_TYPES = new Set<DocumentType>(DOCUMENT_TYPES);
const MAX_QUERY_LENGTH = 500;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters." },
      { status: 400 }
    );
  }
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Query must be at most ${MAX_QUERY_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const rawType = searchParams.get("type");
  const type = rawType && VALID_TYPES.has(rawType as DocumentType)
    ? (rawType as DocumentType)
    : undefined;

  const rawLimit = parseInt(searchParams.get("limit") ?? "30", 10);
  const limit = Math.min(Math.max(rawLimit, 1), 50);

  try {
    const results = await searchDocumentsWithTownship(q, { type, limit });
    return NextResponse.json(results);
  } catch (err) {
    console.error("[api/search] GET failed:", err);
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}
