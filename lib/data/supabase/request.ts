import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { after, connection } from "next/server";
import { createSupabaseServerClient, supabaseAdmin } from "@/lib/supabase/server";
import type { User } from "../types";
import { extendSnapshot, loadSnapshot, saveSnapshot, viewerWithOrganizations, type Snapshot } from "./snapshot";

/**
 * Request-scoped state for Supabase mode, so the data is loaded once and
 * every change is saved once per HTTP request.
 *
 * The key is the request's `headers()` object. React `cache` isn't enough:
 * it gives server actions a fresh scope on every call and route handlers no
 * scope at all. The headers object exists once per request and is shared by
 * a server action and the render that follows it, so that render shows the
 * saved changes straight away.
 */
interface RequestState {
  /** The signed-in profile and the organizations it belongs to (one query). */
  viewer?: Promise<{ user: User; orgIds: string[] } | null>;
  snapshot?: Promise<Snapshot>;
  /** Set once `snapshot` has loaded; the after-response save only looks at this. */
  loaded?: Snapshot;
  saveScheduled: boolean;
}

const states = new WeakMap<object, RequestState>();

/**
 * Within one render, later lookups reuse the first one. That skips the
 * request APIs, which throw if a render is still finishing after the browser
 * dropped the request (a newer refresh replaced it).
 */
const renderMemo = cache((): { state?: RequestState } => ({}));

async function requestState(): Promise<RequestState> {
  const memo = renderMemo();
  if (memo.state) return memo.state;
  // Request data, token checks and relative dates read the clock, so nothing
  // here may run in a prerender (runtime prefetches can read headers, but not
  // the clock). `connection()` defers it to the real request.
  await connection();
  const key = await headers();
  let state = states.get(key);
  if (!state) {
    state = { saveScheduled: false };
    states.set(key, state);
  }
  memo.state = state;
  return state;
}

/**
 * The signed-in person's profile, from verified JWT claims (`getClaims`
 * checks the token signature; the cookie alone is never trusted).
 */
export async function currentViewer(): Promise<User | null> {
  return (await viewerRecord())?.user ?? null;
}

async function viewerRecord() {
  const state = await requestState();
  state.viewer ??= (async () => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const authUserId = !error ? (data?.claims?.sub as string | undefined) : undefined;
    if (!authUserId) return null;
    return viewerWithOrganizations(supabaseAdmin(), authUserId);
  })();
  return state.viewer;
}

/** The viewer's data for this request (every organization they belong to). */
export async function requestSnapshot(): Promise<Snapshot> {
  const state = await requestState();
  if (!state.snapshot) {
    state.snapshot = (async () => {
      const viewer = await viewerRecord();
      const admin = supabaseAdmin();
      if (!viewer) return loadSnapshot(admin, { orgIds: [] });
      if (viewer.user.isPlatformAdmin) return loadSnapshot(admin, { orgIds: [], everything: true, viewer: viewer.user });
      return loadSnapshot(admin, { orgIds: viewer.orgIds, viewer: viewer.user });
    })().then((snapshot) => (state.loaded = snapshot));
    scheduleSave(state);
  }
  return state.snapshot;
}

/** Makes sure the rows of `orgId` are loaded (invitations, webhooks, onboarding). */
export async function requestSnapshotWith(orgIds: string[]): Promise<Snapshot> {
  const snapshot = await requestSnapshot();
  await extendSnapshot(supabaseAdmin(), snapshot, orgIds);
  return snapshot;
}

/**
 * Organizations reached through an invitation rather than a membership: the
 * invitation link's workspace, or every workspace that invited this email.
 */
export async function invitationOrganizations(filter: { token: string } | { email: string }): Promise<string[]> {
  const query = supabaseAdmin().from("invitations").select("organization_id");
  const { data, error } =
    "token" in filter
      ? await query.eq("id", filter.token).limit(1)
      : await query.ilike("email", filter.email.replace(/[\\%_]/g, (char) => `\\${char}`)).limit(50);
  if (error) throw new Error(`Looking up invitations failed: ${error.message}`);
  return [...new Set((data as { organization_id: string }[]).map((row) => row.organization_id))];
}

/** Workspace addresses are global, so this checks every organization, not only the viewer's. */
export async function slugTaken(slug: string) {
  const { count, error } = await supabaseAdmin().from("organizations").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (error) throw new Error(`Checking the workspace address failed: ${error.message}`);
  return (count ?? 0) > 0;
}

/** Saves this request's changes now. Server actions call this before responding. */
export async function saveRequest() {
  const state = await requestState();
  if (!state.snapshot) return;
  await saveSnapshot(supabaseAdmin(), await state.snapshot);
}

/**
 * Safety net: anything changed but not saved explicitly is saved after the
 * response. Saving twice is harmless because a save resets the baseline.
 */
function scheduleSave(state: RequestState) {
  if (state.saveScheduled) return;
  state.saveScheduled = true;
  try {
    after(async () => {
      // A load still running here was abandoned by the render (a 404, for example): nothing to save.
      if (!state.loaded) return;
      try {
        await saveSnapshot(supabaseAdmin(), state.loaded);
      } catch (error) {
        console.error("[atrium] saving changes after the response failed", error);
      }
    });
  } catch {
    // `after` isn't available in this context (for example during a build); explicit saves still work.
  }
}
