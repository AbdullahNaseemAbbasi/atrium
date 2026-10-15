# ADR 0004: Supabase behind the existing data layer

Date: 2026-10-15 · Status: accepted

## Context

Phase 1 built every page, action and access rule against one in-memory
`Database` object. Phase 2 moves the data to Supabase. Rewriting each query
and action as SQL would touch about 40 files and risk drifting from the
access rules that the unit tests cover.

## Decision

1. **Keep the `Database` shape.** In Supabase mode `getDb()` returns a
   snapshot of the rows of every workspace the signed-in person belongs to,
   loaded with the secret key per request. Queries, actions and
   `lib/data/access.ts` stay as they are.
2. **Writes are diffs.** `saveDb()` compares the snapshot with what was
   loaded and upserts or deletes only the changed rows, parents before
   children. Actions save before they refresh, redirect or return.
3. **One scope per HTTP request,** keyed by the request's `headers()`
   object, so an action and the render after it share the snapshot.
4. **The server writes, the browser only reads.** All writes use the secret
   key after the application checks. RLS has SELECT policies only and is the
   backstop for what the browser reads with the user's own session
   (Realtime). Composite foreign keys keep rows inside their workspace even
   for service-role writes.
5. **Memory mode stays** for unit tests, E2E tests and keyless demos
   (`ATRIUM_BACKEND=memory`).
6. **Deploy next to the database.** Every page load waits on those round
   trips, so the app server should run in the database's region (Mumbai,
   `ap-south-1`); from far away each trip costs about 200 ms.

## Consequences

- Each request costs one snapshot load: two round trips to Postgres (the
  profile with its memberships, then every table in parallel). Pages a
  person has already visited are kept in the browser for 30 seconds and
  emptied on any change (see "Browser page cache" in `docs/supabase.md`).
  That is fine for agency-sized workspaces (hundreds to low thousands of rows). A
  workspace with tens of thousands of tasks would need per-page queries;
  the read models in `lib/data/queries` are the place to add them.
- Two writers can overwrite each other's change to the same row (last write
  wins). The approval flow is protected by its version check; other edits
  are single-field forms where this is acceptable.
- Authorization lives in one place (`access.ts`), and RLS mirrors it for the
  browser. A policy change needs both, which `docs/supabase.md` lists.
