import { createSeed } from "./seed";
import type { Database } from "./types";

/**
 * In-memory database used until Supabase is connected.
 *
 * The store lives on `globalThis` so it survives hot reloads in development.
 * On a serverless host each instance keeps its own copy, which is fine for a
 * demo: all reads and writes still go through the same access rules that the
 * Postgres version will enforce with row-level security.
 */
const globalStore = globalThis as typeof globalThis & { __atriumDb?: Database };

export function getDb(): Database {
  if (!globalStore.__atriumDb) {
    globalStore.__atriumDb = createSeed(new Date());
  }
  return globalStore.__atriumDb;
}

/** Restores the deterministic demo data. Used by tests and the "reset demo" control. */
export function resetDb(now: Date = new Date()): Database {
  globalStore.__atriumDb = createSeed(now);
  return globalStore.__atriumDb;
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
