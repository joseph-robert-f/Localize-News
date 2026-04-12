export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/analyze-area
 * Body: { townshipId: string }
 * Auth: x-admin-secret header must match ADMIN_SECRET env var
 * Returns: { ok: true; insights: string | null }
 *
 * Fetches the most recent documents for the township, synthesizes them with
 * Claude Haiku into a 3–5 sentence area insight, and persists to townships.ai_insights.
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

  let body: { townshipId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — caught below
  }

  const townshipId = typeof body.townshipId === "string" ? body.townshipId : undefined;
  if (!townshipId) {
    return NextResponse.json({ error: "townshipId is required" }, { status: 400 });
  }

  const { getTownshipById, setTownshipInsights } = await import("@/lib/db/townships");
  const { getRecentDocumentsWithContent } = await import("@/lib/db/documents");
  const { generateAreaInsights } = await import("@/lib/ai/insights");

  const township = await getTownshipById(townshipId);
  if (!township) {
    return NextResponse.json({ error: "Township not found" }, { status: 404 });
  }

  const docs = await getRecentDocumentsWithContent(townshipId, 10);
  const insights = await generateAreaInsights(township.name, township.state, docs);

  if (insights) {
    await setTownshipInsights(townshipId, insights);
  }

  return NextResponse.json({ ok: true, insights });
}
