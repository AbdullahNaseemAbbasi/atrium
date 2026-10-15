"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Browser client (a singleton inside @supabase/ssr). It carries the user's
 * session from the auth cookies, so Realtime and Storage calls are checked
 * against row-level security. Returns null when Supabase isn't configured.
 */
export function supabaseBrowser() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
