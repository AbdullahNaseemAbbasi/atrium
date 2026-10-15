import type { SupabaseClient } from "@supabase/supabase-js";
import { createSeed, DEMO_PASSWORD } from "../seed";
import type { Database, User } from "../types";
import { TABLES, WRITE_ORDER, toRow, type CollectionName, type TableSpec } from "./tables";
import { portraitUrl } from "../portraits";

/**
 * Loads the synthetic demo (lib/data/seed.ts) into Supabase.
 *
 * Server-only: `admin` must be created with the secret (service role) key, which bypasses
 * RLS. Never import this from client code. It doesn't import "server-only" because
 * `pnpm seed` runs it with tsx, outside Next.js.
 */

export const DEMO_ORGANIZATION_IDS = ["org_kinetic", "org_lumen"];
export const AVATARS_BUCKET = "avatars";
export const PROJECT_FILES_BUCKET = "project-files";

const INSERT_BATCH = 500;
const PAGE_SIZE = 1000;
const CONCURRENCY = 6;

/**
 * Fields stored in integer/bigint columns. Seed sizes such as `2.1 * MB` are fractional and
 * Postgres rejects "2202009.6" for a bigint, so they are rounded before insert.
 */
const INTEGER_FIELDS = new Set(["sizeBytes", "amountCents", "budgetCents", "avatarHue", "brandHue", "position", "version", "currentVersion"]);

export interface DemoTableRows {
  collection: CollectionName;
  table: string;
  rows: Record<string, unknown>[];
}

/** Table rows for every seeded collection in insert order (profiles excluded, see `ensureDemoUsers`). */
export function demoTableRows(seed: Database): DemoTableRows[] {
  return WRITE_ORDER.filter((collection) => collection !== "users").map((collection) => {
    const spec: TableSpec = TABLES[collection];
    const objects = seed[collection] as object[];
    return { collection, table: spec.table, rows: objects.map((object) => toRow(spec, wholeNumbers(object))) };
  });
}

function wholeNumbers(object: object): object {
  const copy: Record<string, unknown> = { ...object };
  for (const [field, value] of Object.entries(copy)) {
    if (INTEGER_FIELDS.has(field) && typeof value === "number" && !Number.isInteger(value)) copy[field] = Math.round(value);
  }
  return copy;
}

export interface ResetSummary {
  /** Rows inserted per table. */
  inserted: Record<string, number>;
  /** Placeholder objects uploaded to the project-files bucket. */
  objects: number;
  /** Objects removed because rows created during the demo pointed at them. */
  removedObjects: number;
}

/**
 * Puts the demo workspaces (Kinetic Studio, Lumen Labs) back to the seed: deletes their rows in
 * reverse write order, inserts the seed and uploads a placeholder object for every stored file.
 * Profiles must exist first (`ensureDemoUsers`). Throws with the table name on the first error.
 */
export async function resetDemoData(admin: SupabaseClient, now = new Date()): Promise<ResetSummary> {
  const seed = createSeed(now);
  const removedObjects = await removeDemoUploads(admin, seed);
  await deleteDemoRows(admin, seed);

  const inserted: Record<string, number> = {};
  for (const { table, rows } of demoTableRows(seed)) {
    for (let start = 0; start < rows.length; start += INSERT_BATCH) {
      const { error } = await admin.from(table).insert(rows.slice(start, start + INSERT_BATCH), { defaultToNull: false });
      if (error) throw new Error(`Seeding ${table} failed: ${error.message}${error.details ? ` (${error.details})` : ""}`);
    }
    inserted[table] = rows.length;
  }

  const objects = await uploadPlaceholders(admin, seed);
  await restoreDemoProfiles(admin, seed);
  return { inserted, objects, removedObjects };
}

/**
 * Puts demo people's names, titles and photos back (visitors can edit their
 * profile) and deletes photos they uploaded. Auth users and passwords are
 * untouched: demo accounts can't change their password.
 */
async function restoreDemoProfiles(admin: SupabaseClient, seed: Database) {
  const bucket = admin.storage.from(AVATARS_BUCKET);
  const { data: portraits } = await bucket.list("", { limit: 1000 });
  const seeded = new Set((portraits ?? []).map((object) => object.name));

  const { data: folders } = await bucket.list("users", { limit: 1000 });
  const demoIds = new Set(seed.users.map((user) => user.id));
  const uploaded: string[] = [];
  for (const folder of folders ?? []) {
    if (!demoIds.has(folder.name)) continue;
    const { data: files } = await bucket.list(`users/${folder.name}`, { limit: 1000 });
    for (const file of files ?? []) uploaded.push(`users/${folder.name}/${file.name}`);
  }
  if (uploaded.length > 0) {
    const { error } = await bucket.remove(uploaded);
    if (error) throw new Error(`Removing uploaded demo photos failed: ${error.message}`);
  }

  const rows = seed.users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title ?? null,
    timezone: user.timezone,
    avatar_hue: user.avatarHue,
    avatar_url: seeded.has(`${user.id}.jpg`) ? bucket.getPublicUrl(`${user.id}.jpg`).data.publicUrl : portraitUrl(user),
  }));
  const { error } = await admin.from(TABLES.users.table).upsert(rows, { onConflict: "id", defaultToNull: false });
  if (error) throw new Error(`Restoring demo profiles failed: ${error.message}`);
}

async function deleteDemoRows(admin: SupabaseClient, seed: Database) {
  const check = (table: string, error: { message: string } | null) => {
    if (error) throw new Error(`Clearing ${table} failed: ${error.message}`);
  };

  for (const collection of [...WRITE_ORDER].reverse()) {
    if (collection === "users") continue;
    const { table } = TABLES[collection];

    if (collection === "organizations") {
      const { error } = await admin.from(table).delete().in("id", DEMO_ORGANIZATION_IDS);
      check(table, error);
    } else if (collection === "webhookEvents") {
      // Not a tenant table: clear the demo workspaces' events plus the seeded ones by id and event id.
      const byOrg = await admin.from(table).delete().in("organization_id", DEMO_ORGANIZATION_IDS);
      check(table, byOrg.error);
      const byId = await admin.from(table).delete().in("id", seed.webhookEvents.map((event) => event.id));
      check(table, byId.error);
      const byEvent = await admin.from(table).delete().in("provider_event_id", seed.webhookEvents.map((event) => event.providerEventId));
      check(table, byEvent.error);
    } else {
      const { error } = await admin.from(table).delete().in("organization_id", DEMO_ORGANIZATION_IDS);
      check(table, error);
    }
  }
}

/** Objects uploaded during the demo (not part of the seed) would otherwise stay in the bucket forever. */
async function removeDemoUploads(admin: SupabaseClient, seed: Database) {
  const seeded = new Set([...seed.deliverableVersions, ...seed.files].map((item) => item.storageKey));
  const stray = new Set<string>();
  for (const table of [TABLES.deliverableVersions.table, TABLES.files.table]) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from(table)
        .select("storage_key")
        .in("organization_id", DEMO_ORGANIZATION_IDS)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
      for (const row of data as { storage_key: string }[]) if (!seeded.has(row.storage_key)) stray.add(row.storage_key);
      if (data.length < PAGE_SIZE) break;
    }
  }

  const keys = [...stray];
  for (let start = 0; start < keys.length; start += 100) {
    const { error } = await admin.storage.from(PROJECT_FILES_BUCKET).remove(keys.slice(start, start + 100));
    if (error) throw new Error(`Removing demo uploads from ${PROJECT_FILES_BUCKET} failed: ${error.message}`);
  }
  return keys.length;
}

async function uploadPlaceholders(admin: SupabaseClient, seed: Database) {
  const objects = [
    ...seed.deliverableVersions.map((version) => ({
      key: version.storageKey,
      name: version.fileName,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      context: `Deliverable ${version.deliverableId}, version ${version.version}`,
    })),
    ...seed.files.map((file) => ({
      key: file.storageKey,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      context: `Project file ${file.id} in ${file.projectId}`,
    })),
  ];

  await inParallel(objects, async (object) => {
    const text = [
      "Atrium demo placeholder",
      "",
      `File: ${object.name}`,
      `Type: ${object.mimeType}`,
      `Size of the real file: ${formatBytes(object.sizeBytes)}`,
      `${object.context}`,
      "",
      "The demo stores this short text file instead of the real upload.",
      "",
    ].join("\n");
    const { error } = await admin.storage
      .from(PROJECT_FILES_BUCKET)
      .upload(object.key, new Blob([text], { type: "text/plain" }), { contentType: "text/plain", upsert: true });
    if (error) throw new Error(`Uploading ${PROJECT_FILES_BUCKET}/${object.key} failed: ${error.message}`);
  });
  return objects.length;
}

/* ---------- Demo users ---------- */

export interface EnsureDemoUsersOptions {
  /** Download a portrait per user into the public avatars bucket and store its URL. */
  avatars?: boolean;
  now?: Date;
}

export interface EnsureDemoUsersSummary {
  users: number;
  /** Auth users created by this run (the rest already existed and got the demo password back). */
  created: number;
  avatars: number;
  warnings: string[];
}

/**
 * Makes sure every seed user can sign in: finds or creates the Supabase Auth user (confirmed,
 * password DEMO_PASSWORD), then upserts the profile with the seed id (usr_alex, ...) and its
 * auth_user_id. Existing demo users get the demo password back so a shared demo keeps working.
 */
export async function ensureDemoUsers(admin: SupabaseClient, opts: EnsureDemoUsersOptions = {}): Promise<EnsureDemoUsersSummary> {
  const { users } = createSeed(opts.now ?? new Date());
  const existing = await authUsersByEmail(admin);
  const warnings: string[] = [];
  const authIds = new Map<string, string>();
  let created = 0;

  for (const user of users) {
    const known = existing.get(user.email.toLowerCase());
    if (known) {
      const { error } = await admin.auth.admin.updateUserById(known, { password: DEMO_PASSWORD, email_confirm: true });
      if (error) throw new Error(`Updating auth user ${user.email} failed: ${error.message}`);
      authIds.set(user.id, known);
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name: user.name },
    });
    if (error || !data.user) throw new Error(`Creating auth user ${user.email} failed: ${error?.message ?? "no user returned"}`);
    authIds.set(user.id, data.user.id);
    created += 1;
  }

  const avatarUrls = new Map<string, string>();
  if (opts.avatars) {
    await inParallel(users, async (user) => {
      try {
        avatarUrls.set(user.id, await uploadPortrait(admin, user));
      } catch (error) {
        warnings.push(`No portrait for ${user.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  const rows = users.map((user) => ({
    ...toRow(TABLES.users, user),
    is_platform_admin: Boolean(user.isPlatformAdmin),
    auth_user_id: authIds.get(user.id),
    ...(opts.avatars ? { avatar_url: avatarUrls.get(user.id) ?? null } : {}),
  }));
  const { error } = await admin.from(TABLES.users.table).upsert(rows, { onConflict: "id" });
  if (error) {
    throw new Error(
      `Upserting ${TABLES.users.table} failed: ${error.message}. A profile with the same email or auth user but a different id blocks the demo profile; delete it and run again.`,
    );
  }

  return { users: users.length, created, avatars: avatarUrls.size, warnings };
}

async function authUsersByEmail(admin: SupabaseClient) {
  const byEmail = new Map<string, string>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`Listing auth users failed: ${error.message}`);
    for (const user of data.users) if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    if (data.users.length < PAGE_SIZE) break;
  }
  return byEmail;
}

async function uploadPortrait(admin: SupabaseClient, user: User) {
  const response = await fetch(portraitUrl(user));
  if (!response.ok) throw new Error(`download returned HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const path = `${user.id}.jpg`;
  const { error } = await admin.storage
    .from(AVATARS_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true, cacheControl: "86400" });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return admin.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ---------- Helpers ---------- */

async function inParallel<T>(items: T[], work: (item: T) => Promise<void>, limit = CONCURRENCY) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function formatBytes(bytes: number) {
  const units = ["bytes", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${Math.round(value)} bytes` : `${value.toFixed(1)} ${units[unit]}`;
}
