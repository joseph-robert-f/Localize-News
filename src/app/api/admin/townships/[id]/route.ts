/**
 * PATCH /api/admin/townships/[id]
 *
 * Update a township's status. Used by the admin panel to promote
 * pending → active (or demote/suspend).
 *
 * Body: { status: "pending" | "active" | "error" | "unsupported" }
 * Auth: x-admin-secret header must match ADMIN_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { setTownshipStatus } from "@/lib/db/townships";
import type { TownshipStatus } from "@/lib/db/types";

const VALID_STATUSES: TownshipStatus[] = ["pending", "active", "error", "unsupported"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { status?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as TownshipStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await setTownshipStatus(id, body.status as TownshipStatus);
    return NextResponse.json({ ok: true, id, status: body.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
