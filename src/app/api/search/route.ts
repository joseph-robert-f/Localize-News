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
import type { DocumentType } from "@/lib/db/types";

const VALID_TYPES = new Set<DocumentType>(["agenda", "minutes", "proposal", "budget", "other"]);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters." },
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
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/search] GET failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
