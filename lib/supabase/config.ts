/**
 * Which data backend the app runs on.
 *
 * - "supabase": Postgres, Auth, Storage and Realtime from Supabase. Used when
 *   the project URL and keys are configured (see .env.example).
 * - "memory": the original in-memory demo store with a signed cookie session.
 *   Used for unit tests, CI and anyone cloning the repo without Supabase.
 *
 * `ATRIUM_BACKEND=memory` forces memory mode even when keys are present
 * (the end-to-end suite does this so it never touches the shared database).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

/** Server-side check. The browser only needs `isSupabaseConfigured()`. */
export function usesSupabase() {
  if (process.env.ATRIUM_BACKEND === "memory") return false;
  return isSupabaseConfigured() && Boolean(process.env.SUPABASE_SECRET_KEY);
}

export const AVATARS_BUCKET = "avatars";
export const PROJECT_FILES_BUCKET = "project-files";
