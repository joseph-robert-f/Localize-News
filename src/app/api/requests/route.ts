/**
 * POST /api/requests
 *
 * Public endpoint — anyone can submit a township scrape request.
 * Requests are queued for admin review before any scraping occurs.
 */

import { NextRequest, NextResponse } from "next/server";
import { submitScrapeRequest } from "@/lib/db/scrapeRequests";

const MAX_TOWNSHIP_NAME = 255;
const MAX_WEBSITE_URL = 2048;
const MAX_EMAIL = 254;
const MAX_NOTES = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (township_name.length > MAX_TOWNSHIP_NAME) {
    return NextResponse.json({ error: "township_name is too long" }, { status: 400 });
  }

  if (typeof website_url !== "string") {
    return NextResponse.json({ error: "website_url is required" }, { status: 400 });
  }
  if (website_url.length > MAX_WEBSITE_URL) {
    return NextResponse.json({ error: "website_url is too long" }, { status: 400 });
  }
  try {
    const parsed = new URL(website_url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    if (!parsed.hostname || parsed.hostname === "localhost") throw new Error();
  } catch {
    return NextResponse.json({ error: "website_url must be a valid http/https URL" }, { status: 400 });
  }

  let validatedEmail: string | undefined;
  if (typeof contact_email === "string" && contact_email.trim()) {
    const trimmed = contact_email.trim();
    if (trimmed.length > MAX_EMAIL || !EMAIL_RE.test(trimmed)) {
      return NextResponse.json({ error: "contact_email is not a valid email address" }, { status: 400 });
    }
    validatedEmail = trimmed;
  }

  let validatedNotes: string | undefined;
  if (typeof notes === "string" && notes.trim()) {
    if (notes.length > MAX_NOTES) {
      return NextResponse.json({ error: "notes is too long (max 5000 characters)" }, { status: 400 });
    }
    validatedNotes = notes.trim();
  }

  try {
    const request = await submitScrapeRequest({
      township_name: township_name.trim(),
      website_url: website_url.trim(),
      contact_email: validatedEmail,
      notes: validatedNotes,
    });
    return NextResponse.json(request, { status: 201 });
  } catch (err) {
    console.error("[api/requests] POST failed:", err);
    return NextResponse.json({ error: "Failed to submit request. Please try again." }, { status: 500 });
  }
}
