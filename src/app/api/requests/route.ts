/**
 * POST /api/requests
 *
 * Public endpoint — anyone can submit a township scrape request.
 * Requests are queued for admin review before any scraping occurs.
 */

import { NextRequest, NextResponse } from "next/server";
import { submitScrapeRequest } from "@/lib/db/scrapeRequests";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { township_name, website_url, contact_email, notes } = body as Record<string, unknown>;

  if (typeof township_name !== "string" || !township_name.trim()) {
    return NextResponse.json({ error: "township_name is required" }, { status: 400 });
  }
  if (typeof website_url !== "string" || !website_url.startsWith("http")) {
    return NextResponse.json({ error: "website_url must be a valid URL" }, { status: 400 });
  }

  try {
    const request = await submitScrapeRequest({
      township_name: township_name.trim(),
      website_url: website_url.trim(),
      contact_email: typeof contact_email === "string" ? contact_email.trim() : undefined,
      notes: typeof notes === "string" ? notes.trim() : undefined,
    });
    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/requests] POST failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
