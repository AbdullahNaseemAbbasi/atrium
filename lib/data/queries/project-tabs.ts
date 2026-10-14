import "server-only";
import { notFound } from "next/navigation";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { describeBlocker } from "@/lib/domain/rules";
import { dueLabel, formatDate, formatRelative } from "@/lib/utils";
import { canManageProject, canWorkOnProject, visibleActivity } from "../access";
import { isVersionSentToClient } from "../client-review";
import { storageUsage } from "../storage";
import { newestFirst, toActivityView, toMilestoneView, toUserLite, userLite, type UserLite } from "../views";
import type { Visibility } from "../types";
import { loadProject } from "./projects";

/* ---------- Milestones ---------- */

export async function getProjectMilestones(orgSlug: string, projectId: string) {
  const { ctx, db, project, projectBase } = await loadProject(orgSlug, projectId);
  const now = new Date();
  const ordered = db.milestones.filter((item) => item.projectId === project.id).sort((a, b) => a.position - b.position);
  const rows = ordered.map((milestone, index) => {
    const view = toMilestoneView(db, milestone);
    const overdue = milestone.status !== "completed" && Boolean(milestone.dueAt) && differenceInCalendarDays(parseISO(milestone.dueAt!), now) < 0;
    return {
      id: milestone.id,
      title: milestone.title,
      description: milestone.description ?? "",
      status: milestone.status,
      approvalRequired: milestone.approvalRequired,
      dueAt: milestone.dueAt ?? null,
      dueText: milestone.status === "completed" ? `Completed ${formatDate(milestone.completedAt ?? milestone.dueAt)}` : dueLabel(milestone.dueAt, now),
      overdue,
      progress: view.progress,
      taskCount: view.taskCount,
      doneTasks: view.doneTasks,
      deliverables: view.deliverables.map((item) => ({ ...item, href: `${projectBase}/deliverables/${item.id}` })),
      blockers: view.blockers.map(describeBlocker),
      isFirst: index === 0,
      isLast: index === ordered.length - 1,
    };
  });
  const client = db.clients.find((item) => item.id === project.clientId);
  return {
    projectBase,
    orgSlug: ctx.org.slug,
    projectId: project.id,
    rows,
    canManage: canManageProject(db, ctx, project),
    clientName: client?.companyName ?? null,
    sharedWithClient: project.sharedWithClient,
    summary: {
      total: rows.length,
      completed: rows.filter((row) => row.status === "completed").length,
      awaiting: rows.filter((row) => row.status === "awaiting_approval").length,
      overdue: rows.filter((row) => row.overdue).length,
    },
  };
}

/* ---------- Files ---------- */

export interface ProjectFileRow {
  key: string;
  kind: "file" | "version";
  objectId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  visibility: Visibility;
  /** Deliverable versions that are still private drafts. */
  draft: boolean;
  deliverable: { id: string; title: string; version: number; href: string } | null;
  uploadedBy: UserLite | null;
  createdAt: string;
  when: string;
}

export async function getProjectFiles(orgSlug: string, projectId: string, query: { visibility?: string; kind?: string }) {
  const { ctx, db, project, projectBase } = await loadProject(orgSlug, projectId);
  const now = new Date();
  const rows: ProjectFileRow[] = [];

  for (const file of db.files.filter((item) => item.projectId === project.id && item.organizationId === ctx.org.id)) {
    rows.push({
      key: `file-${file.id}`,
      kind: "file",
      objectId: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      visibility: file.visibility,
      draft: false,
      deliverable: null,
      uploadedBy: userLite(db, file.uploadedByUserId),
      createdAt: file.createdAt,
      when: formatRelative(file.createdAt, now),
    });
  }
  for (const deliverable of db.deliverables.filter((item) => item.projectId === project.id && item.organizationId === ctx.org.id)) {
    for (const version of db.deliverableVersions.filter((item) => item.deliverableId === deliverable.id)) {
      const sent = isVersionSentToClient(deliverable, version.version);
      rows.push({
        key: `version-${version.id}`,
        kind: "version",
        objectId: version.id,
        name: version.fileName,
        mimeType: version.mimeType,
        sizeBytes: version.sizeBytes,
        visibility: sent ? "client" : "internal",
        draft: !sent,
        deliverable: {
          id: deliverable.id,
          title: deliverable.title,
          version: version.version,
          href: `${projectBase}/deliverables/${deliverable.id}`,
        },
        uploadedBy: userLite(db, version.uploadedByUserId),
        createdAt: version.createdAt,
        when: formatRelative(version.createdAt, now),
      });
    }
  }

  const visibility = query.visibility === "client" || query.visibility === "internal" ? query.visibility : "all";
  const kind = query.kind === "file" || query.kind === "version" ? query.kind : "all";
  const byKind = kind === "all" ? rows : rows.filter((row) => row.kind === kind);
  const filtered = newestFirst(visibility === "all" ? byKind : byKind.filter((row) => row.visibility === visibility));
  const storage = storageUsage(db, ctx.org.id);

  return {
    projectBase,
    orgSlug: ctx.org.slug,
    projectId: project.id,
    sharedWithClient: project.sharedWithClient,
    hasClient: Boolean(project.clientId),
    visibility,
    kind,
    counts: {
      all: byKind.length,
      client: byKind.filter((row) => row.visibility === "client").length,
      internal: byKind.filter((row) => row.visibility === "internal").length,
      files: rows.filter((row) => row.kind === "file").length,
      versions: rows.filter((row) => row.kind === "version").length,
    },
    totalSize: rows.reduce((sum, row) => sum + row.sizeBytes, 0),
    rows: filtered,
    storage: { used: storage.used, limit: storage.limit, planName: storage.planName },
    can: {
      upload: canWorkOnProject(db, ctx, project) && can(ctx.role, "deliverables.upload"),
      delete: canManageProject(db, ctx, project),
    },
  };
}

/* ---------- Activity ---------- */

export async function getProjectActivity(orgSlug: string, projectId: string, query: { show?: string }) {
  const { ctx, db, project, base, projectBase } = await loadProject(orgSlug, projectId);
  const now = new Date();
  const show = query.show === "client" || query.show === "internal" ? query.show : "all";
  const all = newestFirst(visibleActivity(db, ctx, db.activity.filter((event) => event.projectId === project.id)));
  const events = show === "all" ? all : all.filter((event) => event.visibility === show);

  const groups: { key: string; label: string; items: (ReturnType<typeof toActivityView> & { visibility: Visibility; time: string; when: string })[] }[] = [];
  for (const event of events) {
    const date = parseISO(event.createdAt);
    const key = format(date, "yyyy-MM-dd");
    const daysAgo = differenceInCalendarDays(now, date);
    const label = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : daysAgo < 7 ? format(date, "EEEE") : format(date, "EEEE, MMM d");
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push({
      ...toActivityView(db, event, base),
      visibility: event.visibility,
      time: format(date, "HH:mm"),
      when: formatRelative(event.createdAt, now),
    });
  }

  return {
    projectBase,
    show,
    sharedWithClient: project.sharedWithClient,
    hasClient: Boolean(project.clientId),
    counts: {
      all: all.length,
      client: all.filter((event) => event.visibility === "client").length,
      internal: all.filter((event) => event.visibility === "internal").length,
    },
    groups,
  };
}

/* ---------- Settings ---------- */

export async function getProjectSettings(orgSlug: string, projectId: string) {
  const { ctx, db, project, base, projectBase } = await loadProject(orgSlug, projectId);
  if (!canManageProject(db, ctx, project)) notFound();

  const team = db.memberships
    .filter((item) => item.organizationId === ctx.org.id && item.status === "active" && item.role !== "billing")
    .map((item) => db.users.find((user) => user.id === item.userId))
    .filter((user): user is NonNullable<typeof user> => Boolean(user))
    .map(toUserLite)
    .sort((a, b) => a.name.localeCompare(b.name));
  const clients = db.clients
    .filter((client) => client.organizationId === ctx.org.id && (client.status !== "archived" || client.id === project.clientId))
    .map((client) => ({ id: client.id, name: client.companyName }));
  const memberRows = db.projectMembers.filter((item) => item.projectId === project.id);
  const lead = memberRows.find((item) => item.projectRole === "lead");
  const members = memberRows
    .sort((a, b) => Number(b.projectRole === "lead") - Number(a.projectRole === "lead"))
    .map((item) => {
      const membership = db.memberships.find((row) => row.organizationId === ctx.org.id && row.userId === item.userId);
      const user = userLite(db, item.userId);
      return user
        ? { user, projectRole: item.projectRole, orgRole: membership ? ROLE_LABELS[membership.role] : "Former member" }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const client = db.clients.find((item) => item.id === project.clientId);
  const portalUsers = client
    ? db.clientMemberships.filter((item) => item.clientId === client.id && item.status === "active").length
    : 0;

  return {
    base,
    projectBase,
    orgSlug: ctx.org.slug,
    projectId: project.id,
    name: project.name,
    status: project.status,
    clients,
    team,
    canShare: can(ctx.role, "projects.share"),
    defaults: {
      name: project.name,
      description: project.description,
      clientId: project.clientId,
      status: project.status,
      icon: project.icon,
      startAt: project.startAt,
      dueAt: project.dueAt,
      leadId: lead?.userId ?? "",
      memberIds: memberRows.filter((item) => item.projectRole === "contributor").map((item) => item.userId),
      sharedWithClient: project.sharedWithClient,
      budget: project.budgetCents !== undefined ? project.budgetCents / 100 : undefined,
    },
    members,
    client: client ? { name: client.companyName, portalUsers } : null,
    counts: {
      tasks: db.tasks.filter((task) => task.projectId === project.id).length,
      deliverables: db.deliverables.filter((item) => item.projectId === project.id).length,
      files: db.files.filter((item) => item.projectId === project.id).length,
    },
    updatedText: formatRelative(project.updatedAt, new Date()),
  };
}
