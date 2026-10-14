import type { Database, ID } from "@/lib/data/types";

function withoutStorageKey<T extends { storageKey: string }>(row: T): Omit<T, "storageKey"> {
  const copy: Partial<T> = { ...row };
  delete copy.storageKey;
  return copy as Omit<T, "storageKey">;
}

/**
 * Full workspace export (JSON) for the owner. Contains every tenant row of
 * one organization and nothing from any other tenant. Left out on purpose:
 * private storage keys (files are exported as metadata), other people's
 * notification inboxes and preferences, and provider secrets.
 */
export function buildWorkspaceExport(db: Database, organizationId: ID, now: Date, exportedByUserId: ID) {
  const org = db.organizations.find((item) => item.id === organizationId);
  if (!org) throw new Error("Unknown organization");
  const own = <T extends { organizationId: ID }>(rows: T[]) => rows.filter((row) => row.organizationId === organizationId);
  const person = (userId: ID) => {
    const user = db.users.find((item) => item.id === userId);
    return user ? { id: user.id, name: user.name, email: user.email } : { id: userId, name: "Unknown user", email: null };
  };
  const subscription = db.subscriptions.find((item) => item.organizationId === organizationId);

  return {
    format: "atrium.workspace-export",
    version: 1,
    exportedAt: now.toISOString(),
    exportedBy: person(exportedByUserId),
    organization: org,
    members: own(db.memberships).map((item) => ({ ...person(item.userId), role: item.role, status: item.status, joinedAt: item.joinedAt })),
    invitations: own(db.invitations),
    clients: own(db.clients),
    clientUsers: own(db.clientMemberships).map((item) => ({ ...person(item.userId), clientId: item.clientId, role: item.role, status: item.status, joinedAt: item.joinedAt })),
    projects: own(db.projects),
    projectMembers: own(db.projectMembers),
    milestones: own(db.milestones),
    tasks: own(db.tasks),
    deliverables: own(db.deliverables),
    deliverableVersions: own(db.deliverableVersions).map(withoutStorageKey),
    approvals: own(db.approvals),
    comments: own(db.comments),
    files: own(db.files).map(withoutStorageKey),
    activity: own(db.activity),
    auditLog: own(db.auditLogs),
    subscription: subscription
      ? {
          planKey: subscription.planKey,
          status: subscription.status,
          interval: subscription.interval,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          trialEndsAt: subscription.trialEndsAt ?? null,
        }
      : null,
    invoices: own(db.invoices),
    integrations: own(db.integrations).map((item) => ({ key: item.key, account: item.account, connectedAt: item.connectedAt, connectedBy: person(item.connectedByUserId) })),
  };
}

export type WorkspaceExport = ReturnType<typeof buildWorkspaceExport>;

/** Row counts shown on the Data page before exporting. */
export function exportCounts(db: Database, organizationId: ID) {
  const count = (rows: { organizationId: ID }[]) => rows.filter((row) => row.organizationId === organizationId).length;
  return [
    { label: "Projects", value: count(db.projects) },
    { label: "Tasks", value: count(db.tasks) },
    { label: "Deliverables", value: count(db.deliverables) },
    { label: "File versions", value: count(db.deliverableVersions) + count(db.files) },
    { label: "Comments", value: count(db.comments) },
    { label: "Clients", value: count(db.clients) },
    { label: "Members", value: count(db.memberships) },
    { label: "Audit entries", value: count(db.auditLogs) },
  ];
}
