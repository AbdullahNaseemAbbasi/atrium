import { usesSupabase } from "@/lib/supabase/config";
import { createSeed } from "./seed";
import type { Database } from "./types";

/**
 * Data access entry point.
 *
 * - Supabase mode: a request-scoped snapshot of the viewer's organizations,
 *   loaded from Postgres once per request (lib/data/supabase/request.ts).
 *   Changes are saved with `saveDb()`.
 * - Memory mode: one in-memory database on `globalThis` (survives hot
 *   reloads), seeded with the synthetic demo data. `saveDb()` does nothing.
 *
 * Both return the same `Database` shape, so queries, actions and access
 * rules don't care which backend is running.
 */
const globalStore = globalThis as typeof globalThis & { __atriumDb?: Database };

export function memoryDb(): Database {
  if (!globalStore.__atriumDb) {
    globalStore.__atriumDb = createSeed(new Date());
  }
  return globalStore.__atriumDb;
}

export async function getDb(): Promise<Database> {
  if (!usesSupabase()) return memoryDb();
  const { requestSnapshot } = await import("./supabase/request");
  return (await requestSnapshot()).db;
}

/** Like `getDb()`, but also loads organizations the viewer isn't a member of yet (invitations, webhooks). */
export async function getDbWith(orgIds: string[]): Promise<Database> {
  if (!usesSupabase()) return memoryDb();
  const { requestSnapshotWith } = await import("./supabase/request");
  return (await requestSnapshotWith(orgIds)).db;
}

/** `getDb()` plus the workspace an invitation link belongs to (the invitee isn't a member yet). */
export async function getDbForInvitation(token: string): Promise<Database> {
  if (!usesSupabase()) return memoryDb();
  const { invitationOrganizations, requestSnapshotWith } = await import("./supabase/request");
  return (await requestSnapshotWith(await invitationOrganizations({ token }))).db;
}

/** `getDb()` plus every workspace that invited `email` (onboarding lists them). */
export async function getDbForInvitesTo(email: string): Promise<Database> {
  if (!usesSupabase()) return memoryDb();
  const { invitationOrganizations, requestSnapshotWith } = await import("./supabase/request");
  return (await requestSnapshotWith(await invitationOrganizations({ email }))).db;
}

/** Workspace addresses are unique across every organization. */
export async function isSlugTaken(slug: string): Promise<boolean> {
  if (!usesSupabase()) return memoryDb().organizations.some((org) => org.slug === slug);
  const { slugTaken } = await import("./supabase/request");
  return slugTaken(slug);
}

/** Persists this request's changes (Supabase mode). Call it before redirecting or refreshing. */
export async function saveDb(): Promise<void> {
  if (!usesSupabase()) return;
  const { saveRequest } = await import("./supabase/request");
  await saveRequest();
}

/** Restores the deterministic demo data in memory mode (tests and the memory build's reset control). */
export function resetDb(now: Date = new Date()): Database {
  globalStore.__atriumDb = createSeed(now);
  return globalStore.__atriumDb;
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
