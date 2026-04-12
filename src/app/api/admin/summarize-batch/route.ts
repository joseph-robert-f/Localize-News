export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/summarize-batch
 * Body: { townshipId?: string; limit?: number }
 * Auth: x-admin-secret header must match ADMIN_SECRET env var
 * Returns: { ok: true; processed: number; failed: number }
 */
export async function POST(req: NextRequest) {
  // Auth check
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: { townshipId?: string; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const limit = Math.min(body.limit ?? 20, 100);
  const townshipId = typeof body.townshipId === "string" ? body.townshipId : undefined;

  const { getDocumentsNeedingSummary, setDocumentSummary } = await import(
    "@/lib/db/documents"
  );
  const { generateDocumentSummary, isSummarizable } = await import(
    "@/lib/ai/summarize"
  );

  const docs = await getDocumentsNeedingSummary({ limit, townshipId });

  let processed = 0;
  let failed = 0;

  for (const doc of docs) {
    if (!isSummarizable(doc.content)) continue;
    try {
      const summary = await generateDocumentSummary({
        title: doc.title,
        type: doc.type,
        date: doc.date,
        content: doc.content!,
      });
      if (summary) {
        await setDocumentSummary(doc.id, summary);
        processed += 1;
      }
    } catch (err) {
      console.error(`[summarize-batch] Failed for ${doc.id}:`, err);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, processed, failed });
}
