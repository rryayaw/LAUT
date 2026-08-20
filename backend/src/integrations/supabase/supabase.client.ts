import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient | undefined {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return undefined;
  }

  client ??= createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  return client;
}
