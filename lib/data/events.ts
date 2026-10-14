import type { AccessContext } from "./access";
import { newId } from "./store";
import type { ActivityEvent, AuditLog, Database, ID, Notification } from "./types";

/**
 * Side effects every mutation records: audit trail (security-relevant
 * changes), activity feed (what happened on a project) and notifications.
 */

export function recordAudit(
  db: Database,
  ctx: AccessContext,
  entry: Pick<AuditLog, "action" | "entityType" | "entityId" | "summary"> & { metadata?: AuditLog["metadata"]; ip?: string },
) {
  db.auditLogs.push({
    id: newId("aud"),
    organizationId: ctx.org.id,
    actorUserId: ctx.user.id,
    metadata: {},
    ip: "demo",
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

export function recordActivity(
  db: Database,
  ctx: AccessContext,
  entry: Pick<ActivityEvent, "verb" | "targetType" | "targetId" | "targetLabel"> & {
    projectId?: ID;
    visibility?: ActivityEvent["visibility"];
  },
) {
  db.activity.push({
    id: newId("act"),
    organizationId: ctx.org.id,
    actorUserId: ctx.user.id,
    visibility: entry.visibility ?? "client",
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

const DEDUP_WINDOW_MS = 10 * 60 * 1000;

/**
 * Creates a notification unless one with the same deduplication key reached
 * the same person within the last ten minutes. Never notifies the actor.
 */
export function notify(
  db: Database,
  ctx: AccessContext,
  recipients: ID[],
  entry: Pick<Notification, "type" | "title" | "body" | "href"> & { deduplicationKey?: string },
) {
  const now = Date.now();
  for (const recipientUserId of new Set(recipients)) {
    if (recipientUserId === ctx.user.id) continue;
    if (
      entry.deduplicationKey &&
      db.notifications.some(
        (item) =>
          item.recipientUserId === recipientUserId &&
          item.deduplicationKey === entry.deduplicationKey &&
          now - Date.parse(item.createdAt) < DEDUP_WINDOW_MS,
      )
    ) {
      continue;
    }
    db.notifications.push({
      id: newId("ntf"),
      organizationId: ctx.org.id,
      recipientUserId,
      createdAt: new Date(now).toISOString(),
      ...entry,
    });
  }
}

/** Team members who should hear about a project: its members plus owners and managers. */
export function projectAudience(db: Database, orgId: ID, projectId: ID) {
  const members = db.projectMembers.filter((item) => item.projectId === projectId).map((item) => item.userId);
  const leaders = db.memberships
    .filter((item) => item.organizationId === orgId && (item.role === "owner" || item.role === "manager") && item.status === "active")
    .map((item) => item.userId);
  return [...new Set([...members, ...leaders])];
}

/** Client users of the project's client (only if the project is shared). */
export function clientAudience(db: Database, orgId: ID, projectId: ID) {
  const project = db.projects.find((item) => item.id === projectId);
  if (!project || !project.clientId || !project.sharedWithClient) return [];
  return db.clientMemberships
    .filter((item) => item.organizationId === orgId && item.clientId === project.clientId && item.status === "active")
    .map((item) => item.userId);
}
