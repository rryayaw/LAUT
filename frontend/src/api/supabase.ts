// Supabase browser client.
//
// Used for authentication only. LAUT data is never read directly from Postgres by
// the frontend — every domain read and write goes through the backend at
// `NEXT_PUBLIC_API_BASE_URL`, which owns the row-level-security context, the
// deterministic calculations, and the audit trail.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | undefined;

/** Returns undefined when the environment is not configured, so the UI can say so. */
export function getSupabaseClient(): SupabaseClient | undefined {
  if (!url || !publishableKey) return undefined;
  client ??= createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && publishableKey);
}
