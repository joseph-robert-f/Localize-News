/**
 * POST /api/admin/dispatch-scrape
 *
 * Triggers the scrape.yml GitHub Actions workflow for a specific township.
 * The workflow installs Chromium and runs scripts/scrape.ts — Playwright
 * cannot run on Vercel's serverless runtime so scraping must happen in CI.
 *
 * Required env vars:
 *   GITHUB_PAT   — Personal access token with `workflow` scope
 *   GITHUB_REPO  — e.g. "joseph-robert-f/Localize-News"
 *
 * Body: { townshipId: string; force?: boolean }
 * Auth: x-admin-secret header must match ADMIN_SECRET env var
 * Returns: { ok: true; runUrl: string } on success
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pat = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO;

  if (!pat || !repo) {
    return NextResponse.json(
      { error: "GITHUB_PAT and GITHUB_REPO must be set to dispatch scrape jobs." },
      { status: 503 }
    );
  }

  let body: { townshipId?: string; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.townshipId) {
    return NextResponse.json({ error: "townshipId is required" }, { status: 400 });
  }

  const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/scrape.yml/dispatches`;

  const ghRes = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: {
        township_id: body.townshipId,
        force: body.force ? "true" : "false",
      },
    }),
  });

  if (!ghRes.ok) {
    const text = await ghRes.text().catch(() => "");
    console.error(`[dispatch-scrape] GitHub API error ${ghRes.status}:`, text);
    return NextResponse.json(
      { error: `GitHub API returned ${ghRes.status}. Check GITHUB_PAT scope (needs 'workflow').` },
      { status: 502 }
    );
  }

  // GitHub returns 204 No Content on success — no run ID in the response.
  // Build the Actions tab URL so the user can watch progress.
  const actionsUrl = `https://github.com/${repo}/actions/workflows/scrape.yml`;

  return NextResponse.json({ ok: true, actionsUrl });
}
