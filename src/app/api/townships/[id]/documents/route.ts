/**
 * GET /api/townships/[id]/documents
 *
 * Returns documents for a specific township.
 * Query params:
 *   - type: filter by document type (agenda|minutes|proposal|budget|other)
 *   - limit: number of results (default 20, max 100)
 */

import { NextRequest, NextResponse } from "next/server";
import { getDocumentsByTownship } from "@/lib/db/documents";
import type { DocumentType } from "@/lib/db/types";

const VALID_TYPES = new Set(["agenda", "minutes", "proposal", "budget", "other"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;

  const rawType = searchParams.get("type");
  const type: DocumentType | undefined =
    rawType && VALID_TYPES.has(rawType) ? (rawType as DocumentType) : undefined;

  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(Math.max(rawLimit, 1), 100);

  try {
    const docs = await getDocumentsByTownship(id, { type, limit });
    return NextResponse.json(docs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[api/townships/${id}/documents] GET failed:`, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
