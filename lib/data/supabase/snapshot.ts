import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import { REFERENCED_TABLES, TABLES, WRITE_ORDER, columnName, fromRow, rowKey, type CollectionName, type TableSpec } from "./tables";

/**
 * A request-scoped copy of the rows one viewer can reach, loaded from
 * Supabase into the same `Database` shape the rest of the app was written
 * against. The app's access rules (lib/data/access.ts) still decide what is
 * shown; writes are diffed against the loaded copy and saved in one pass.
 */
export interface Snapshot {
  db: Database;
  /** Deep copy of `db` as last loaded or saved, used to find changes. */
  original: Database;
  /** Organizations whose rows are loaded. */
  orgIds: Set<string>;
  /** Every row of every table (platform operators only). */
  everything: boolean;
}

const PAGE = 1000;
/** Optional boolean fields stored in NOT NULL columns with a false default. */
const OPTIONAL_BOOLEANS = new Set(["isPlatformAdmin", "hasPreview", "stale"]);

export function emptyDatabase(): Database {
  return Object.fromEntries(Object.keys(TABLES).map((name) => [name, []])) as unknown as Database;
}

type Filter = { column: string; values: string[] } | null;

async function selectAll(admin: SupabaseClient, spec: TableSpec, filter: Filter): Promise<Record<string, unknown>[]> {
  if (filter && filter.values.length === 0) return [];
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = admin.from(spec.table).select("*").range(from, from + PAGE - 1);
    if (filter) query = query.in(filter.column, filter.values);
    const { data, error } = await query;
    if (error) throw new Error(`Loading ${spec.table} failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((row) => fromRow<Record<string, unknown>>(row));
}

/** Organizations a profile belongs to, as a team member or a client user. */
export async function organizationsFor(admin: SupabaseClient, profileId: string) {
  const [memberships, clientMemberships] = await Promise.all([
    admin.from("memberships").select("organization_id").eq("user_id", profileId),
    admin.from("client_memberships").select("organization_id").eq("user_id", profileId),
  ]);
  if (memberships.error) throw new Error(`Loading memberships failed: ${memberships.error.message}`);
  if (clientMemberships.error) throw new Error(`Loading client memberships failed: ${clientMemberships.error.message}`);
  return [...new Set([...(memberships.data ?? []), ...(clientMemberships.data ?? [])].map((row) => row.organization_id as string))];
}

/**
 * Loads tenant rows for `orgIds` (or everything) plus the profiles those rows
 * refer to, and always the viewer's own profile.
 */
export async function loadSnapshot(
  admin: SupabaseClient,
  opts: { orgIds: string[]; everything?: boolean; viewerId?: string | null },
): Promise<Snapshot> {
  const db = emptyDatabase();
  const orgIds = [...new Set(opts.orgIds)];
  await fillOrganizations(admin, db, orgIds, Boolean(opts.everything), opts.viewerId ?? null);
  return { db, original: structuredClone(db), orgIds: new Set(orgIds), everything: Boolean(opts.everything) };
}

/** Adds the rows of more organizations to an already loaded snapshot. */
export async function extendSnapshot(admin: SupabaseClient, snapshot: Snapshot, orgIds: string[]) {
  const missing = orgIds.filter((id) => !snapshot.orgIds.has(id));
  if (snapshot.everything || missing.length === 0) return;
  const extra = emptyDatabase();
  await fillOrganizations(admin, extra, missing, false, null);
  for (const name of Object.keys(TABLES) as CollectionName[]) {
    const spec = TABLES[name];
    const have = new Set((snapshot.db[name] as unknown as Record<string, unknown>[]).map((row) => rowKey(spec, row)));
    const add = (extra[name] as unknown as Record<string, unknown>[]).filter((row) => !have.has(rowKey(spec, row)));
    (snapshot.db[name] as unknown[]).push(...add);
    (snapshot.original[name] as unknown[]).push(...structuredClone(add));
  }
  for (const id of missing) snapshot.orgIds.add(id);
}

async function fillOrganizations(admin: SupabaseClient, db: Database, orgIds: string[], everything: boolean, viewerId: string | null) {
  const tenantNames = (Object.keys(TABLES) as CollectionName[]).filter((name) => TABLES[name].tenant);
  const byOrg: Filter = everything ? null : { column: "organization_id", values: orgIds };

  const [organizations, webhookEvents, ...tenant] = await Promise.all([
    selectAll(admin, TABLES.organizations, everything ? null : { column: "id", values: orgIds }),
    selectAll(admin, TABLES.webhookEvents, byOrg),
    ...tenantNames.map((name) => selectAll(admin, TABLES[name], byOrg)),
  ]);
  (db.organizations as unknown[]) = organizations;
  (db.webhookEvents as unknown[]) = webhookEvents;
  tenantNames.forEach((name, index) => {
    (db[name] as unknown[]) = tenant[index];
  });

  // Profiles referenced by the loaded rows, plus the viewer.
  const ids = new Set<string>();
  if (viewerId) ids.add(viewerId);
  for (const name of tenantNames) {
    for (const row of db[name] as unknown as Record<string, unknown>[]) {
      for (const [field, value] of Object.entries(row)) {
        if (typeof value === "string" && (field === "userId" || field.endsWith("UserId"))) ids.add(value);
      }
    }
  }
  db.users = everything
    ? await selectAll(admin, TABLES.users, null) as unknown as Database["users"]
    : await selectAll(admin, TABLES.users, { column: "id", values: [...ids] }) as unknown as Database["users"];
}

/* ---------- Saving ---------- */

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${key}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function rowFor(next: Record<string, unknown>, previous?: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  const fields = new Set([...Object.keys(next), ...(previous ? Object.keys(previous) : [])]);
  for (const field of fields) {
    const value = next[field];
    if (value === undefined) {
      if (!previous) continue; // new row: let the column default apply
      row[columnName(field)] = OPTIONAL_BOOLEANS.has(field) ? false : null;
    } else {
      row[columnName(field)] = typeof value === "number" && !Number.isInteger(value) && /size|cents|position|version/i.test(field) ? Math.round(value) : value;
    }
  }
  return row;
}

export interface SaveSummary {
  upserted: number;
  deleted: number;
}

/** Writes every change made to `snapshot.db` since it was loaded or last saved. */
export async function saveSnapshot(admin: SupabaseClient, snapshot: Snapshot): Promise<SaveSummary> {
  const plans = WRITE_ORDER.map((name): WritePlan => {
    const spec: TableSpec = TABLES[name];
    const before = new Map((snapshot.original[name] as unknown as Record<string, unknown>[]).map((row) => [rowKey(spec, row), row]));
    const after = new Map((snapshot.db[name] as unknown as Record<string, unknown>[]).map((row) => [rowKey(spec, row), row]));
    const upserts: Record<string, unknown>[] = [];
    for (const [key, row] of after) {
      const previous = before.get(key);
      if (!previous) upserts.push(rowFor(row));
      else if (stable(previous) !== stable(row)) upserts.push(rowFor(row, previous));
    }
    const deletes = [...before.entries()].filter(([key]) => !after.has(key)).map(([, row]) => row);
    return { name, spec, upserts, deletes };
  });

  // Leaf tables first (in parallel), then referenced tables children-first.
  const deleting = plans.filter((plan) => plan.deletes.length > 0);
  await Promise.all(deleting.filter((plan) => !REFERENCED_TABLES.has(plan.name)).map((plan) => deleteRows(admin, plan)));
  for (const plan of deleting.filter((plan) => REFERENCED_TABLES.has(plan.name)).reverse()) await deleteRows(admin, plan);

  // Referenced tables in order (parents before children), then leaf tables in parallel.
  const upserting = plans.filter((plan) => plan.upserts.length > 0);
  for (const plan of upserting.filter((plan) => REFERENCED_TABLES.has(plan.name))) await upsertRows(admin, plan);
  await Promise.all(upserting.filter((plan) => !REFERENCED_TABLES.has(plan.name)).map((plan) => upsertRows(admin, plan)));

  const deleted = deleting.reduce((sum, plan) => sum + plan.deletes.length, 0);
  const upserted = upserting.reduce((sum, plan) => sum + plan.upserts.length, 0);
  snapshot.original = structuredClone(snapshot.db);
  return { upserted, deleted };
}

interface WritePlan {
  name: CollectionName;
  spec: TableSpec;
  upserts: Record<string, unknown>[];
  deletes: Record<string, unknown>[];
}

async function deleteRows(admin: SupabaseClient, plan: WritePlan) {
  if (plan.spec.key.length === 1) {
    const field = plan.spec.key[0];
    const { error } = await admin.from(plan.spec.table).delete().in(columnName(field), plan.deletes.map((row) => row[field] as string));
    if (error) throw new Error(`Deleting from ${plan.spec.table} failed: ${error.message}`);
    return;
  }
  for (const row of plan.deletes) {
    const match = Object.fromEntries(plan.spec.key.map((field) => [columnName(field), row[field]]));
    const { error } = await admin.from(plan.spec.table).delete().match(match);
    if (error) throw new Error(`Deleting from ${plan.spec.table} failed: ${error.message}`);
  }
}

async function upsertRows(admin: SupabaseClient, plan: WritePlan) {
  const { error } = await admin
    .from(plan.spec.table)
    .upsert(plan.upserts, { onConflict: plan.spec.key.map(columnName).join(","), defaultToNull: false });
  if (error) throw new Error(`Saving ${plan.spec.table} failed: ${error.message}`);
}
