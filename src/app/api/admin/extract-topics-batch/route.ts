export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/extract-topics-batch
 * Body: { townshipId?: string; limit?: number }
 * Auth: x-admin-secret header must match ADMIN_SECRET env var
 * Returns: { ok: true; processed: number; failed: number }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
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

  const limit = Math.min(body.limit ?? 50, 200);
  const townshipId = typeof body.townshipId === "string" ? body.townshipId : undefined;

  const { getDocumentsNeedingTopics, setDocumentTopics } = await import(
    "@/lib/db/documents"
  );
  const { generateDocumentTopics } = await import("@/lib/ai/topics");

  const docs = await getDocumentsNeedingTopics({ limit, townshipId });

  let processed = 0;
  let failed = 0;

  for (const doc of docs) {
    // Prefer ai_summary as input (already cleaned), fall back to raw content
    const content = doc.ai_summary ?? doc.content;
    if (!content) continue;

    try {
      const topics = await generateDocumentTopics({
        title: doc.title,
        type: doc.type,
        date: doc.date,
        content,
      });
      if (topics) {
        await setDocumentTopics(doc.id, topics);
        processed += 1;
      }
    } catch (err) {
      console.error(`[extract-topics-batch] Failed for ${doc.id}:`, err);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, processed, failed });
}
