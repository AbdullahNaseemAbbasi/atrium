import "server-only";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import { notFound } from "next/navigation";
import { requireTeamContext } from "@/lib/auth/context";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { exportCounts } from "@/lib/export/workspace";
import { auditActionLabel, AUDIT_ACTION_LABELS, INTEGRATIONS, TIMEZONES } from "@/lib/settings/options";
import { formatRelative } from "@/lib/utils";
import type { TeamContext } from "../access";
import { getDb } from "../store";
import { newestFirst, paginate, userLite, type UserLite } from "../views";
import type { AuditLog, Database, NotificationPreference, OrgRole } from "../types";

/* ---------- Navigation ---------- */

export type SettingsSection = "profile" | "notifications" | "workspace" | "integrations" | "audit-log" | "data";

export interface SettingsNavData {
  base: string;
  role: OrgRole;
  roleLabel: string;
  sections: { key: SettingsSection; group: "Account" | "Workspace"; label: string; description: string; href: string }[];
  billingHref: string | null;
}

/** Which settings sections a role may open. Pages re-check their own permission. */
export function settingsSectionsFor(role: OrgRole) {
  const sections: { key: SettingsSection; group: "Account" | "Workspace"; label: string; description: string }[] = [
    { key: "profile", group: "Account", label: "Profile", description: "Name, timezone, password" },
    { key: "notifications", group: "Account", label: "Notifications", description: "What reaches you and how" },
    { key: "workspace", group: "Workspace", label: "Workspace", description: can(role, "workspace.update") ? "Name, brand, timezone" : "Read only" },
    { key: "integrations", group: "Workspace", label: "Integrations", description: "Slack, Drive, Figma…" },
  ];
  if (can(role, "audit.view")) sections.push({ key: "audit-log", group: "Workspace", label: "Audit log", description: "Security-relevant changes" });
  if (can(role, "data.export")) sections.push({ key: "data", group: "Workspace", label: "Data & privacy", description: "Export and retention" });
  return sections;
}

export async function getSettingsNav(orgSlug: string): Promise<SettingsNavData> {
  const ctx = await requireTeamContext(orgSlug);
  const base = `/w/${ctx.org.slug}`;
  return {
    base,
    role: ctx.role,
    roleLabel: ROLE_LABELS[ctx.role],
    sections: settingsSectionsFor(ctx.role).map((section) => ({ ...section, href: `${base}/settings/${section.key}` })),
    billingHref: can(ctx.role, "billing.view") ? `${base}/billing` : null,
  };
}

/** `/settings` opens the workspace section for people who can edit it, otherwise the profile. */
export async function getSettingsLanding(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  return `/w/${ctx.org.slug}/settings/${can(ctx.role, "workspace.update") ? "workspace" : "profile"}`;
}

/* ---------- Profile ---------- */

function timezoneOptions(current: string) {
  return TIMEZONES.some((zone) => zone.value === current) ? TIMEZONES : [{ value: current, label: current }, ...TIMEZONES];
}

export async function getProfileSettings(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  const { user } = ctx;
  return {
    orgSlug: ctx.org.slug,
    user: { id: user.id, name: user.name, email: user.email, title: user.title ?? "", timezone: user.timezone, avatarHue: user.avatarHue },
    roleLabel: ROLE_LABELS[ctx.role],
    memberSince: ctx.membership.joinedAt,
    timezones: timezoneOptions(user.timezone),
  };
}

/* ---------- Workspace ---------- */

export async function getWorkspaceSettings(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  const owner = db.memberships.find((item) => item.organizationId === ctx.org.id && item.role === "owner" && item.status === "active");
  return {
    orgSlug: ctx.org.slug,
    org: {
      id: ctx.org.id,
      name: ctx.org.name,
      slug: ctx.org.slug,
      timezone: ctx.org.timezone,
      industry: ctx.org.industry,
      website: ctx.org.website ?? "",
      brandHue: ctx.org.brandHue,
      createdAt: ctx.org.createdAt,
    },
    ownerName: owner ? (db.users.find((user) => user.id === owner.userId)?.name ?? null) : null,
    canEdit: can(ctx.role, "workspace.update"),
    isOwner: ctx.role === "owner",
    timezones: timezoneOptions(ctx.org.timezone),
  };
}

/* ---------- Notifications ---------- */

export function defaultPreference(userId: string, organizationId: string): NotificationPreference {
  return { userId, organizationId, muted: { inApp: [], email: [] }, digest: "weekly" };
}

export function preferenceFor(db: Database, ctx: TeamContext) {
  return (
    db.notificationPreferences.find((item) => item.userId === ctx.user.id && item.organizationId === ctx.org.id) ??
    defaultPreference(ctx.user.id, ctx.org.id)
  );
}

export async function getNotificationSettings(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  const preference = preferenceFor(db, ctx);
  return {
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    email: ctx.user.email,
    muted: { inApp: [...preference.muted.inApp], email: [...preference.muted.email] },
    digest: preference.digest,
    seesBilling: can(ctx.role, "billing.view"),
    saved: db.notificationPreferences.some((item) => item.userId === ctx.user.id && item.organizationId === ctx.org.id),
  };
}

/* ---------- Integrations ---------- */

export async function getIntegrations(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  const now = new Date();
  const connections = db.integrations.filter((item) => item.organizationId === ctx.org.id);
  const subscription = db.subscriptions.find((item) => item.organizationId === ctx.org.id);
  return {
    orgSlug: ctx.org.slug,
    canManage: can(ctx.role, "integrations.manage"),
    billingHref: can(ctx.role, "billing.view") ? `/w/${ctx.org.slug}/billing` : null,
    stripeConnected: Boolean(subscription?.providerCustomerId),
    items: INTEGRATIONS.map((meta) => {
      const connection = connections.find((item) => item.key === meta.key);
      const by = connection ? userLite(db, connection.connectedByUserId) : null;
      return {
        ...meta,
        connection: connection
          ? { account: connection.account, connectedAt: connection.connectedAt, when: formatRelative(connection.connectedAt, now), byName: by?.name ?? "A former member" }
          : null,
      };
    }),
  };
}

/* ---------- Audit log ---------- */

export interface AuditQuery {
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: string;
}

export interface AuditRow {
  id: string;
  action: string;
  actionLabel: string;
  summary: string;
  entityType: string;
  entityId: string;
  actor: UserLite | null;
  actorLabel: string;
  ip: string | null;
  metadata: { key: string; value: string }[];
  createdAt: string;
  when: string;
}

function parseDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

/** Normalised filters shared by the page and the CSV export, so both return the same rows. */
export function normaliseAuditQuery(query: AuditQuery) {
  const from = parseDay(query.from);
  const to = parseDay(query.to);
  return {
    action: query.action && query.action in AUDIT_ACTION_LABELS ? query.action : "",
    actor: query.actor && /^[\w-]{1,40}$/.test(query.actor) ? query.actor : "",
    from: from ? query.from! : "",
    to: to ? query.to! : "",
    fromTime: from ? startOfDay(from).getTime() : null,
    toTime: to ? endOfDay(to).getTime() : null,
  };
}

/** Pure filter over one organization's audit rows. `actor=system` matches entries without a person. */
export function filterAuditLogs(logs: AuditLog[], organizationId: string, filters: ReturnType<typeof normaliseAuditQuery>) {
  return newestFirst(
    logs.filter((log) => {
      if (log.organizationId !== organizationId) return false;
      if (filters.action && log.action !== filters.action) return false;
      if (filters.actor === "system" ? Boolean(log.actorUserId) : filters.actor && log.actorUserId !== filters.actor) return false;
      const at = Date.parse(log.createdAt);
      if (filters.fromTime !== null && at < filters.fromTime) return false;
      if (filters.toTime !== null && at > filters.toTime) return false;
      return true;
    }),
  );
}

export function toAuditRow(db: Database, log: AuditLog, now: Date): AuditRow {
  const actor = userLite(db, log.actorUserId);
  return {
    id: log.id,
    action: log.action,
    actionLabel: auditActionLabel(log.action),
    summary: log.summary,
    entityType: log.entityType,
    entityId: log.entityId,
    actor,
    actorLabel: actor?.name ?? (log.actorUserId ? "Deleted user" : "System"),
    ip: log.ip && log.ip !== "demo" ? log.ip : log.ip === "demo" ? "Demo session" : null,
    metadata: Object.entries(log.metadata).map(([key, value]) => ({ key, value: String(value) })),
    createdAt: log.createdAt,
    when: formatRelative(log.createdAt, now),
  };
}

/** Requires `audit.view`; anyone else gets a 404. */
export async function requireAuditContext(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "audit.view")) notFound();
  return ctx;
}

export async function getAuditLog(orgSlug: string, query: AuditQuery) {
  const ctx = await requireAuditContext(orgSlug);
  const db = getDb();
  const now = new Date();
  const filters = normaliseAuditQuery(query);
  const all = db.auditLogs.filter((log) => log.organizationId === ctx.org.id);
  const rows = filterAuditLogs(db.auditLogs, ctx.org.id, filters);
  const page = paginate(rows, Number(query.page) || 1, 12);

  const actorIds = [...new Set(all.map((log) => log.actorUserId).filter((value): value is string => Boolean(value)))];
  const actors = actorIds
    .map((id) => userLite(db, id))
    .filter((user): user is UserLite => Boolean(user))
    .sort((a, b) => a.name.localeCompare(b.name));
  const actions = [...new Set(all.map((log) => log.action))].sort().map((value) => ({ value, label: auditActionLabel(value) }));

  const params = new URLSearchParams();
  for (const key of ["action", "actor", "from", "to"] as const) if (filters[key]) params.set(key, filters[key]);

  return {
    base: `/w/${ctx.org.slug}`,
    orgSlug: ctx.org.slug,
    filters: { action: filters.action, actor: filters.actor, from: filters.from, to: filters.to },
    filtered: Boolean(filters.action || filters.actor || filters.from || filters.to),
    total: all.length,
    page: { ...page, items: page.items.map((log) => toAuditRow(db, log, now)) },
    actors,
    hasSystem: all.some((log) => !log.actorUserId),
    actions,
    exportHref: `/api/w/${ctx.org.slug}/audit/export${params.size ? `?${params}` : ""}`,
    queryString: params.toString(),
  };
}

/* ---------- Data ---------- */

export async function getDataSettings(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "data.export")) notFound();
  const db = getDb();
  const lastExport = newestFirst(db.auditLogs.filter((log) => log.organizationId === ctx.org.id && log.action === "data.exported"))[0];
  return {
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    counts: exportCounts(db, ctx.org.id),
    exportHref: `/api/w/${ctx.org.slug}/export`,
    lastExport: lastExport
      ? { summary: lastExport.summary, at: lastExport.createdAt, by: userLite(db, lastExport.actorUserId)?.name ?? "System" }
      : null,
  };
}
