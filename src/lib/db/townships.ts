import { createServerClient } from "../supabase";
import type { Township, TownshipStatus } from "./types";

/** Fetch all active townships ordered by state + name. */
export async function getActiveTownships(): Promise<Township[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("townships")
    .select("*")
    .eq("status", "active")
    .order("state")
    .order("name");
  if (error) throw new Error(`getActiveTownships: ${error.message}`);
  return data ?? [];
}

/** Fetch a single township by ID. Returns null if not found. */
export async function getTownshipById(id: string): Promise<Township | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("townships")
    .select("*")
    .eq("id", id)
    .single();
  if (error?.code === "PGRST116") return null; // not found
  if (error) throw new Error(`getTownshipById: ${error.message}`);
  return data;
}

/** Fetch all townships (any status) — admin use only. */
export async function getAllTownships(): Promise<Township[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("townships")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getAllTownships: ${error.message}`);
  return data ?? [];
}

/** Update a township's status. */
export async function setTownshipStatus(id: string, status: TownshipStatus): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("townships")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`setTownshipStatus: ${error.message}`);
}

/** Record that a township was scraped successfully. */
export async function markTownshipScraped(id: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("townships")
    .update({ last_scraped_at: new Date().toISOString(), status: "active" })
    .eq("id", id);
  if (error) throw new Error(`markTownshipScraped: ${error.message}`);
}

/** Insert a new township. Returns the created record. */
export async function createTownship(
  data: Pick<Township, "name" | "state" | "website_url">
): Promise<Township> {
  const db = createServerClient();
  const { data: created, error } = await db
    .from("townships")
    .insert({ ...data, status: "pending" })
    .select()
    .single();
  if (error) throw new Error(`createTownship: ${error.message}`);
  return created;
}
