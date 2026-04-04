import { createClient } from "@supabase/supabase-js";
import type { Database } from "./db/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Browser client — use in Client Components that need auth or real-time.
 * Uses the anon key; subject to RLS.
 */
export function createBrowserClient() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey)
  );
}

/**
 * Server client — use in Server Components, API routes, and scrapers.
 * Uses the service role key; bypasses RLS — handle access control in code.
 */
export function createServerClient() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", supabaseServiceKey),
    { auth: { persistSession: false } }
  );
}
