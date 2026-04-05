/**
 * GET /api/townships/[id]/documents
 *
 * Returns documents for a specific township with cursor-based pagination.
 * Query params:
 *   - type:     filter by document type (agenda|minutes|proposal|budget|other)
 *   - pageSize: number of results per page (default 24, max 100)
 *   - cursor:   opaque cursor from a previous response's nextCursor field
 */

import { NextRequest, NextResponse } from "next/server";
import { getDocumentsByTownship, PAGE_SIZE } from "@/lib/db/documents";
import { DOCUMENT_TYPES } from "@/lib/db/types";
import type { DocumentType } from "@/lib/db/types";

const VALID_TYPES = new Set<DocumentType>(DOCUMENT_TYPES);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = req.nextUrl;

  const rawType = searchParams.get("type");
  const type: DocumentType | undefined =
    rawType && VALID_TYPES.has(rawType) ? (rawType as DocumentType) : undefined;

  const rawPageSize = parseInt(searchParams.get("pageSize") ?? String(PAGE_SIZE), 10);
  const pageSize = Math.min(Math.max(rawPageSize, 1), 100);

  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const page = await getDocumentsByTownship(id, { type, pageSize, cursor });
    return NextResponse.json(page);
  } catch (err) {
    console.error(`[api/townships/${id}/documents] GET failed:`, err);
    return NextResponse.json({ error: "Failed to load documents. Please try again." }, { status: 500 });
  }
}
