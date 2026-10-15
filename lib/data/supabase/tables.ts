import type { Database } from "../types";

/**
 * How each collection of the in-app `Database` maps to a Postgres table.
 * Column names are the snake_case form of the TypeScript field names
 * (`organizationId` -> `organization_id`). Nested objects and records are
 * stored as jsonb and keep their camelCase keys.
 */
export interface TableSpec {
  table: string;
  /** Fields that identify a row (camelCase). */
  key: string[];
  /** Fields stored as jsonb (kept as-is, not converted). */
  json?: string[];
  /** True when rows belong to a workspace through `organizationId`. */
  tenant: boolean;
}

export const TABLES = {
  users: { table: "profiles", key: ["id"], tenant: false },
  organizations: { table: "organizations", key: ["id"], tenant: false },
  memberships: { table: "memberships", key: ["id"], tenant: true },
  invitations: { table: "invitations", key: ["id"], tenant: true },
  clients: { table: "clients", key: ["id"], tenant: true },
  clientMemberships: { table: "client_memberships", key: ["id"], tenant: true },
  projects: { table: "projects", key: ["id"], tenant: true },
  projectMembers: { table: "project_members", key: ["id"], tenant: true },
  milestones: { table: "milestones", key: ["id"], tenant: true },
  tasks: { table: "tasks", key: ["id"], tenant: true },
  deliverables: { table: "deliverables", key: ["id"], tenant: true },
  deliverableVersions: { table: "deliverable_versions", key: ["id"], tenant: true },
  approvals: { table: "approvals", key: ["id"], tenant: true },
  comments: { table: "comments", key: ["id"], tenant: true },
  files: { table: "project_files", key: ["id"], tenant: true },
  activity: { table: "activity_events", key: ["id"], tenant: true },
  notifications: { table: "notifications", key: ["id"], tenant: true },
  notificationPreferences: { table: "notification_preferences", key: ["userId", "organizationId"], json: ["muted"], tenant: true },
  auditLogs: { table: "audit_logs", key: ["id"], json: ["metadata"], tenant: true },
  subscriptions: { table: "subscriptions", key: ["id"], json: ["paymentMethod"], tenant: true },
  invoices: { table: "invoices", key: ["id"], tenant: true },
  webhookEvents: { table: "webhook_events", key: ["id"], tenant: false },
  integrations: { table: "integrations", key: ["organizationId", "key"], tenant: true },
} as const satisfies Record<keyof Database, TableSpec>;

export type CollectionName = keyof typeof TABLES;

/** Insert order that satisfies foreign keys (deletes run in reverse). */
/**
 * Tables that other tables point at with foreign keys. Their writes keep
 * WRITE_ORDER; every other table is a leaf and is written in parallel.
 */
export const REFERENCED_TABLES = new Set<CollectionName>([
  "users",
  "organizations",
  "clients",
  "projects",
  "milestones",
  "tasks",
  "deliverables",
  "deliverableVersions",
]);

export const WRITE_ORDER: CollectionName[] = [
  "users",
  "organizations",
  "memberships",
  "clients",
  "clientMemberships",
  "invitations",
  "projects",
  "projectMembers",
  "milestones",
  "tasks",
  "deliverables",
  "deliverableVersions",
  "approvals",
  "comments",
  "files",
  "activity",
  "notifications",
  "notificationPreferences",
  "auditLogs",
  "subscriptions",
  "invoices",
  "webhookEvents",
  "integrations",
];

const toSnake = (field: string) => field.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
const toCamel = (column: string) => column.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());

/** App object -> table row. `undefined` becomes null only when `forUpdate` (so cleared fields are written). */
export function toRow(spec: TableSpec, object: object, forUpdate = false): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(object)) {
    if (value === undefined) {
      if (forUpdate) row[toSnake(field)] = null;
      continue;
    }
    row[toSnake(field)] = value;
  }
  return row;
}

/** Table row -> app object. Nulls are dropped so optional fields stay `undefined`. */
export function fromRow<T>(row: Record<string, unknown>): T {
  const object: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    if (value === null) continue;
    object[toCamel(column)] = value;
  }
  return object as T;
}

/** Stable identity string for a row, used to diff snapshots. */
export function rowKey(spec: TableSpec, object: Record<string, unknown>) {
  return spec.key.map((field) => String(object[field])).join("::");
}

export const columnName = toSnake;
