import { createServerClient } from "../supabase";
import type { ScrapeRequest, ScrapeRequestStatus } from "./types";

/** Submit a new township scrape request (public). */
export async function submitScrapeRequest(data: {
  township_name: string;
  website_url: string;
  contact_email?: string;
  notes?: string;
}): Promise<ScrapeRequest> {
  const db = createServerClient();
  const { data: created, error } = await db
    .from("scrape_requests")
    .insert({ ...data, status: "pending" })
    .select()
    .single();
  if (error) throw new Error(`submitScrapeRequest: ${error.message}`);
  return created;
}

/** Fetch all pending requests — admin only. */
export async function getPendingRequests(): Promise<ScrapeRequest[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("scrape_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at");
  if (error) throw new Error(`getPendingRequests: ${error.message}`);
  return data ?? [];
}

/** Update a request's review status — admin only. */
export async function reviewRequest(
  id: string,
  status: Extract<ScrapeRequestStatus, "approved" | "rejected">
): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("scrape_requests")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`reviewRequest: ${error.message}`);
}
