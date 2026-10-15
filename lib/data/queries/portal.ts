import "server-only";
import { notFound } from "next/navigation";
import { differenceInCalendarDays, differenceInHours } from "date-fns";
import { requireClientContext } from "@/lib/auth/context";
import { CLIENT_ROLE_LABELS } from "@/lib/auth/permissions";
import { milestoneProgress, projectProgress, isTaskOverdue } from "@/lib/domain/rules";
import { dueLabel, formatRelative } from "@/lib/utils";
import {
  canDecideOnDeliverable,
  canViewDeliverable,
  getVisibleProject,
  visibleActivity,
  visibleComments,
  visibleFiles,
  visibleProjects,
  visibleTasks,
  type ClientContext,
} from "../access";
import { isVersionSentToClient, latestSentVersion } from "../client-review";
import { previewUrlFor } from "@/lib/storage/uploads";
import { getDb } from "../store";
import { approvalsOf, newestFirst, paginate, sortTasks, taskDueText, toActivityView, toCommentView, userLite, versionsOf, type UserLite } from "../views";
import type { ActivityEvent, Database, Deliverable, DeliverableStatus, Project } from "../types";

/**
 * Read models for the client portal. Every function starts with
 * `requireClientContext`, works only on projects shared with the viewer's
 * client and returns client-safe shapes: no budgets, internal tasks,
 * internal comments or files, drafts, or storage keys.
 */

const base = (ctx: ClientContext) => `/portal/${ctx.org.slug}`;

/* ---------- Shared shapes ---------- */

export interface PortalProjectCard {
  id: string;
  name: string;
  description: string;
  icon: Project["icon"];
  status: Project["status"];
  progress: number;
  startAt?: string;
  dueAt?: string;
  dueText: string;
  lead: UserLite | null;
  taskCount: number;
  openTasks: number;
  milestonesDone: number;
  milestonesTotal: number;
  pendingReviews: number;
  nextMilestone: { id: string; title: string; dueAt?: string; dueText: string; approvalRequired: boolean; needsApproval: boolean } | null;
}

export interface ReviewItem {
  id: string;
  title: string;
  version: number;
  projectId: string;
  projectName: string;
  milestoneTitle: string | null;
  fileName: string;
  mimeType: string;
  submittedAt: string | null;
  sentText: string;
  waitingDays: number;
  commentCount: number;
}

export interface PortalActivityItem {
  id: string;
  actor: UserLite | null;
  action: string;
  targetLabel: string;
  href: string | null;
  projectName: string | null;
  verb: ActivityEvent["verb"];
  createdAt: string;
  when: string;
}

function clientVisibleTasks(db: Database, projectId: string) {
  return db.tasks.filter((task) => task.projectId === projectId && task.clientVisible);
}

function visibleDeliverablesOf(db: Database, ctx: ClientContext, projectId: string) {
  return db.deliverables.filter(
    (item) => item.projectId === projectId && item.organizationId === ctx.org.id && canViewDeliverable(db, ctx, item) && latestSentVersion(item) !== null,
  );
}

function leadOf(db: Database, projectId: string) {
  const lead = db.projectMembers.find((item) => item.projectId === projectId && item.projectRole === "lead");
  return userLite(db, lead?.userId);
}

function toProjectCard(db: Database, ctx: ClientContext, project: Project, now: Date): PortalProjectCard {
  const tasks = clientVisibleTasks(db, project.id);
  const milestones = db.milestones.filter((item) => item.projectId === project.id).sort((a, b) => a.position - b.position);
  const deliverables = visibleDeliverablesOf(db, ctx, project.id);
  const next = milestones.find((item) => item.status !== "completed");
  const nextNeedsApproval = next
    ? deliverables.some((item) => item.milestoneId === next.id && item.status === "in_review")
    : false;
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    icon: project.icon,
    status: project.status,
    progress: projectProgress(project, tasks),
    startAt: project.startAt,
    dueAt: project.dueAt,
    dueText: project.status === "completed" ? "Delivered" : dueLabel(project.dueAt, now),
    lead: leadOf(db, project.id),
    taskCount: tasks.length,
    openTasks: tasks.filter((task) => task.status !== "done").length,
    milestonesDone: milestones.filter((item) => item.status === "completed").length,
    milestonesTotal: milestones.length,
    pendingReviews: deliverables.filter((item) => item.status === "in_review").length,
    nextMilestone: next
      ? {
          id: next.id,
          title: next.title,
          dueAt: next.dueAt,
          dueText: dueLabel(next.dueAt, now),
          approvalRequired: next.approvalRequired,
          needsApproval: nextNeedsApproval,
        }
      : null,
  };
}

function toReviewItem(db: Database, deliverable: Deliverable, now: Date): ReviewItem {
  const project = db.projects.find((item) => item.id === deliverable.projectId)!;
  const milestone = deliverable.milestoneId ? db.milestones.find((item) => item.id === deliverable.milestoneId) : undefined;
  const version = db.deliverableVersions.find((item) => item.deliverableId === deliverable.id && item.version === deliverable.currentVersion)!;
  const sentAt = deliverable.submittedAt ?? deliverable.updatedAt;
  return {
    id: deliverable.id,
    title: deliverable.title,
    version: deliverable.currentVersion,
    projectId: project.id,
    projectName: project.name,
    milestoneTitle: milestone?.title ?? null,
    fileName: version.fileName,
    mimeType: version.mimeType,
    submittedAt: deliverable.submittedAt ?? null,
    sentText: `Sent ${formatRelative(sentAt, now)}`,
    waitingDays: Math.max(0, differenceInCalendarDays(now, new Date(sentAt))),
    commentCount: db.comments.filter((item) => item.deliverableId === deliverable.id && item.visibility === "client").length,
  };
}

function pendingReviews(db: Database, ctx: ClientContext, projectIds: Set<string>, now: Date) {
  return db.deliverables
    .filter((item) => projectIds.has(item.projectId) && item.status === "in_review" && canViewDeliverable(db, ctx, item))
    .map((item) => toReviewItem(db, item, now))
    .sort((a, b) => Date.parse(a.submittedAt ?? "") - Date.parse(b.submittedAt ?? ""));
}

/**
 * Client-visible activity, with one more filter than the access rule: events
 * that point at an internal task, internal file or an unsent deliverable are
 * dropped or unlinked, so a stale event can never lead to a 404 or a leak.
 */
function portalActivity(db: Database, ctx: ClientContext, events: ActivityEvent[], now: Date): PortalActivityItem[] {
  return newestFirst(visibleActivity(db, ctx, events))
    .filter((event) => {
      if (event.targetType === "task") return Boolean(db.tasks.find((task) => task.id === event.targetId)?.clientVisible);
      if (event.targetType === "file") return db.files.find((file) => file.id === event.targetId)?.visibility === "client";
      return true;
    })
    .map((event) => {
      const view = toActivityView(db, event, base(ctx), true);
      if (event.targetType === "deliverable") {
        const deliverable = db.deliverables.find((item) => item.id === event.targetId);
        if (!deliverable || !canViewDeliverable(db, ctx, deliverable)) view.href = null;
      }
      return { ...view, when: formatRelative(event.createdAt, now) };
    });
}

/* ---------- Overview ---------- */

export async function getPortalOverview(orgSlug: string) {
  const ctx = await requireClientContext(orgSlug);
  const db = await getDb();
  const now = new Date();
  const projects = visibleProjects(db, ctx);
  const projectIds = new Set(projects.map((project) => project.id));

  const active = projects
    .filter((project) => project.status !== "completed" && project.status !== "cancelled")
    .map((project) => toProjectCard(db, ctx, project, now))
    .sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity));

  const contacts = new Map<string, { user: UserLite; projects: string[] }>();
  for (const project of projects.filter((item) => item.status !== "cancelled")) {
    const lead = leadOf(db, project.id);
    if (!lead) continue;
    const entry = contacts.get(lead.id) ?? { user: lead, projects: [] };
    entry.projects.push(project.name);
    contacts.set(lead.id, entry);
  }

  const visibleDeliverableIds = new Set(
    db.deliverables.filter((item) => projectIds.has(item.projectId) && canViewDeliverable(db, ctx, item)).map((item) => item.id),
  );
  const approvedLast30 = db.approvals.filter(
    (item) =>
      visibleDeliverableIds.has(item.deliverableId) &&
      item.decision === "approved" &&
      differenceInCalendarDays(now, new Date(item.decidedAt)) <= 30,
  ).length;
  const reviews = pendingReviews(db, ctx, projectIds, now);

  return {
    base: base(ctx),
    orgSlug: ctx.org.slug,
    firstName: ctx.user.name.split(" ")[0],
    clientName: ctx.client.companyName,
    clientHue: ctx.client.brandHue,
    agencyName: ctx.org.name,
    canApprove: ctx.role === "approver",
    reviews,
    activeProjects: active,
    activity: portalActivity(
      db,
      ctx,
      db.activity.filter((event) => event.projectId && projectIds.has(event.projectId)),
      now,
    ).slice(0, 7),
    contacts: [...contacts.values()],
    stats: {
      active: active.length,
      pending: reviews.length,
      approvedLast30,
      completed: projects.filter((project) => project.status === "completed").length,
    },
  };
}

/* ---------- Projects ---------- */

export async function listPortalProjects(orgSlug: string, query: { status?: string }) {
  const ctx = await requireClientContext(orgSlug);
  const db = await getDb();
  const now = new Date();
  const all = visibleProjects(db, ctx).map((project) => toProjectCard(db, ctx, project, now));
  const isActive = (row: PortalProjectCard) => row.status !== "completed" && row.status !== "cancelled";
  const status = query.status === "active" || query.status === "completed" ? query.status : "all";
  const rows = all
    .filter((row) => (status === "active" ? isActive(row) : status === "completed" ? row.status === "completed" : true))
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.pendingReviews - a.pendingReviews || a.name.localeCompare(b.name));
  return {
    base: base(ctx),
    agencyName: ctx.org.name,
    clientName: ctx.client.companyName,
    clientHue: ctx.client.brandHue,
    canApprove: ctx.role === "approver",
    status,
    counts: { all: all.length, active: all.filter(isActive).length, completed: all.filter((row) => row.status === "completed").length },
    rows,
  };
}

export async function getPortalProject(orgSlug: string, projectId: string) {
  const ctx = await requireClientContext(orgSlug);
  const db = await getDb();
  const project = getVisibleProject(db, ctx, projectId);
  if (!project || project.organizationId !== ctx.org.id) notFound();
  const now = new Date();
  const card = toProjectCard(db, ctx, project, now);
  const deliverables = visibleDeliverablesOf(db, ctx, project.id);

  const milestones = db.milestones
    .filter((item) => item.projectId === project.id)
    .sort((a, b) => a.position - b.position)
    .map((milestone) => {
      const tasks = clientVisibleTasks(db, project.id).filter((task) => task.milestoneId === milestone.id);
      const linked = deliverables.filter((item) => item.milestoneId === milestone.id);
      return {
        id: milestone.id,
        title: milestone.title,
        description: milestone.description ?? null,
        status: milestone.status,
        dueAt: milestone.dueAt,
        dueText: milestone.status === "completed" ? `Completed ${formatRelative(milestone.completedAt ?? milestone.dueAt ?? now, now)}` : dueLabel(milestone.dueAt, now),
        overdue: milestone.status !== "completed" && Boolean(milestone.dueAt) && differenceInCalendarDays(new Date(milestone.dueAt!), now) < 0,
        approvalRequired: milestone.approvalRequired,
        progress: milestoneProgress(milestone, tasks),
        taskCount: tasks.length,
        doneTasks: tasks.filter((task) => task.status === "done").length,
        deliverables: linked.map((item) => ({ id: item.id, title: item.title, status: item.status })),
        needsApproval: linked.some((item) => item.status === "in_review"),
      };
    });

  const tasks = sortTasks(visibleTasks(db, ctx, db.tasks.filter((task) => task.projectId === project.id))).map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dueText: taskDueText(task, now),
    overdue: isTaskOverdue(task, now),
    assignee: userLite(db, task.assigneeUserId),
    milestoneTitle: task.milestoneId ? (db.milestones.find((item) => item.id === task.milestoneId)?.title ?? null) : null,
  }));

  const deliverableRows = deliverables
    .map((item) => {
      const sent = latestSentVersion(item)!;
      const version = db.deliverableVersions.find((row) => row.deliverableId === item.id && row.version === sent)!;
      return {
        id: item.id,
        title: item.title,
        status: item.status as DeliverableStatus,
        version: sent,
        fileName: version.fileName,
        mimeType: version.mimeType,
        milestoneTitle: item.milestoneId ? (db.milestones.find((row) => row.id === item.milestoneId)?.title ?? null) : null,
        updatedText: formatRelative(item.updatedAt, now),
        updatedAt: item.updatedAt,
        commentCount: db.comments.filter((row) => row.deliverableId === item.id && row.visibility === "client").length,
      };
    })
    .sort((a, b) => Number(b.status === "in_review") - Number(a.status === "in_review") || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  const files = newestFirst(visibleFiles(ctx, db.files.filter((file) => file.projectId === project.id && file.organizationId === ctx.org.id))).map(
    (file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedBy: userLite(db, file.uploadedByUserId),
      when: formatRelative(file.createdAt, now),
    }),
  );

  const team = db.projectMembers
    .filter((item) => item.projectId === project.id)
    .sort((a, b) => Number(b.projectRole === "lead") - Number(a.projectRole === "lead"))
    .map((item) => ({ user: userLite(db, item.userId), lead: item.projectRole === "lead" }))
    .filter((item): item is { user: UserLite; lead: boolean } => Boolean(item.user));

  return {
    base: base(ctx),
    orgSlug: ctx.org.slug,
    agencyName: ctx.org.name,
    clientHue: ctx.client.brandHue,
    canApprove: ctx.role === "approver",
    project: card,
    milestones,
    tasks,
    deliverables: deliverableRows,
    files,
    team,
    activity: portalActivity(db, ctx, db.activity.filter((event) => event.projectId === project.id), now).slice(0, 8),
  };
}

/* ---------- Review screen ---------- */

export async function getPortalDeliverable(orgSlug: string, deliverableId: string) {
  const ctx = await requireClientContext(orgSlug);
  const db = await getDb();
  const deliverable = db.deliverables.find((item) => item.id === deliverableId && item.organizationId === ctx.org.id);
  if (!deliverable || !canViewDeliverable(db, ctx, deliverable)) notFound();
  const shownVersion = latestSentVersion(deliverable);
  if (shownVersion === null) notFound();
  const project = db.projects.find((item) => item.id === deliverable.projectId)!;
  const milestone = deliverable.milestoneId ? db.milestones.find((item) => item.id === deliverable.milestoneId) : undefined;
  const now = new Date();

  const decisions = approvalsOf(db, deliverable.id).map((approval) => ({
    id: approval.id,
    version: approval.version,
    decision: approval.decision,
    comment: approval.comment ?? null,
    by: approval.by,
    byYou: approval.clientUserId === ctx.user.id,
    decidedAt: approval.decidedAt,
    when: formatRelative(approval.decidedAt, now),
  }));
  const decisionByVersion = new Map<number, (typeof decisions)[number]>();
  for (const decision of [...decisions].reverse()) decisionByVersion.set(decision.version, decision);

  const versions = versionsOf(db, deliverable.id)
    .filter((version) => isVersionSentToClient(deliverable, version.version))
    .map((version) => ({
      id: version.id,
      version: version.version,
      fileName: version.fileName,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      note: version.note ?? null,
      uploadedBy: version.uploadedBy,
      createdAt: version.createdAt,
      when: formatRelative(version.createdAt, now),
      decision: decisionByVersion.get(version.version) ?? null,
    }));
  const current = versions.find((version) => version.version === shownVersion)!;
  const shownRow = db.deliverableVersions.find((item) => item.deliverableId === deliverable.id && item.version === shownVersion);
  const previewUrl = shownRow ? await previewUrlFor(shownRow) : null;

  const comments = visibleComments(ctx, db.comments.filter((item) => item.deliverableId === deliverable.id && item.organizationId === ctx.org.id))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((item) => ({ ...toCommentView(db, item), when: formatRelative(item.createdAt, now) }));

  const approvers = db.clientMemberships
    .filter((item) => item.clientId === ctx.client.id && item.organizationId === ctx.org.id && item.status === "active" && item.role === "approver")
    .map((item) => userLite(db, item.userId))
    .filter((item): item is UserLite => Boolean(item));

  const sentAt = deliverable.submittedAt ?? deliverable.updatedAt;
  const waitingHours = Math.max(0, differenceInHours(now, new Date(sentAt)));

  return {
    base: base(ctx),
    orgSlug: ctx.org.slug,
    agencyName: ctx.org.name,
    clientName: ctx.client.companyName,
    role: ctx.role,
    previewUrl,
    roleLabel: CLIENT_ROLE_LABELS[ctx.role],
    project: { id: project.id, name: project.name },
    milestone: milestone ? { id: milestone.id, title: milestone.title, approvalRequired: milestone.approvalRequired } : null,
    deliverable: {
      id: deliverable.id,
      title: deliverable.title,
      description: deliverable.description ?? null,
      status: deliverable.status,
      currentVersion: shownVersion,
    },
    current,
    versions,
    decisions,
    comments,
    approvers,
    canDecide: canDecideOnDeliverable(db, ctx, deliverable) && shownVersion === deliverable.currentVersion,
    canComment: true,
    waiting: {
      sentText: formatRelative(sentAt, now),
      long: waitingHours >= 48,
    },
  };
}

/* ---------- Approvals ---------- */

export async function getPortalApprovals(orgSlug: string, query: { decision?: string; page?: string }) {
  const ctx = await requireClientContext(orgSlug);
  const db = await getDb();
  const now = new Date();
  const projects = visibleProjects(db, ctx);
  const projectIds = new Set(projects.map((project) => project.id));
  const visible = new Map(
    db.deliverables.filter((item) => projectIds.has(item.projectId) && canViewDeliverable(db, ctx, item)).map((item) => [item.id, item]),
  );

  const history = db.approvals
    .filter((item) => item.organizationId === ctx.org.id && visible.has(item.deliverableId))
    .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))
    .map((item) => {
      const deliverable = visible.get(item.deliverableId)!;
      const project = projects.find((row) => row.id === deliverable.projectId)!;
      return {
        id: item.id,
        deliverableId: deliverable.id,
        title: deliverable.title,
        version: item.version,
        projectName: project.name,
        decision: item.decision,
        comment: item.comment ?? null,
        by: userLite(db, item.clientUserId),
        byYou: item.clientUserId === ctx.user.id,
        decidedAt: item.decidedAt,
        when: formatRelative(item.decidedAt, now),
      };
    });

  const decision = query.decision === "approved" || query.decision === "changes_requested" ? query.decision : "all";
  const filtered = decision === "all" ? history : history.filter((row) => row.decision === decision);

  return {
    base: base(ctx),
    agencyName: ctx.org.name,
    canApprove: ctx.role === "approver",
    pending: pendingReviews(db, ctx, projectIds, now),
    decision,
    counts: {
      all: history.length,
      approved: history.filter((row) => row.decision === "approved").length,
      changes_requested: history.filter((row) => row.decision === "changes_requested").length,
    },
    history: paginate(filtered, Number(query.page) || 1, 10),
  };
}

/* ---------- Files ---------- */

export async function getPortalFiles(orgSlug: string, query: { project?: string; type?: string; q?: string }) {
  const ctx = await requireClientContext(orgSlug);
  const db = await getDb();
  const now = new Date();
  const projects = visibleProjects(db, ctx);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  type Row = {
    key: string;
    kind: "file" | "version";
    objectId: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    projectId: string;
    projectName: string;
    detail: string;
    href: string | null;
    addedAt: string;
    when: string;
  };
  const rows: Row[] = [];

  for (const file of visibleFiles(ctx, db.files.filter((item) => item.organizationId === ctx.org.id && projectById.has(item.projectId)))) {
    rows.push({
      key: `file-${file.id}`,
      kind: "file",
      objectId: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      projectId: file.projectId,
      projectName: projectById.get(file.projectId)!.name,
      detail: `Shared by ${userLite(db, file.uploadedByUserId)?.name ?? ctx.org.name}`,
      href: null,
      addedAt: file.createdAt,
      when: formatRelative(file.createdAt, now),
    });
  }

  const seen = new Set<string>();
  for (const approval of db.approvals.filter((item) => item.organizationId === ctx.org.id && item.decision === "approved")) {
    const deliverable = db.deliverables.find((item) => item.id === approval.deliverableId);
    if (!deliverable || !projectById.has(deliverable.projectId) || !canViewDeliverable(db, ctx, deliverable)) continue;
    if (!isVersionSentToClient(deliverable, approval.version)) continue;
    const version = db.deliverableVersions.find((item) => item.deliverableId === deliverable.id && item.version === approval.version);
    if (!version || seen.has(version.id)) continue;
    seen.add(version.id);
    rows.push({
      key: `version-${version.id}`,
      kind: "version",
      objectId: version.id,
      name: version.fileName,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      projectId: deliverable.projectId,
      projectName: projectById.get(deliverable.projectId)!.name,
      detail: `${deliverable.title} · v${version.version} approved by ${userLite(db, approval.clientUserId)?.name ?? "your team"}`,
      href: `${base(ctx)}/deliverables/${deliverable.id}`,
      addedAt: approval.decidedAt,
      when: formatRelative(approval.decidedAt, now),
    });
  }

  const type = query.type === "shared" || query.type === "approved" ? query.type : "all";
  const projectFilter = query.project && projectById.has(query.project) ? query.project : "";
  const q = query.q?.trim().toLowerCase() ?? "";
  const scoped = rows.filter((row) => (!projectFilter || row.projectId === projectFilter) && (!q || row.name.toLowerCase().includes(q) || row.detail.toLowerCase().includes(q)));
  const filtered = scoped
    .filter((row) => (type === "shared" ? row.kind === "file" : type === "approved" ? row.kind === "version" : true))
    .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt));

  return {
    base: base(ctx),
    orgSlug: ctx.org.slug,
    agencyName: ctx.org.name,
    type,
    filters: { project: projectFilter, q: query.q ?? "" },
    counts: {
      all: scoped.length,
      shared: scoped.filter((row) => row.kind === "file").length,
      approved: scoped.filter((row) => row.kind === "version").length,
    },
    totalAvailable: rows.length,
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
    rows: filtered,
  };
}

/* ---------- Notifications ---------- */

export async function getPortalNotifications(orgSlug: string, query: { filter?: string; page?: string }) {
  const ctx = await requireClientContext(orgSlug);
  const db = await getDb();
  const now = new Date();
  const mine = newestFirst(db.notifications.filter((item) => item.recipientUserId === ctx.user.id && item.organizationId === ctx.org.id));
  const filter = query.filter === "unread" ? "unread" : "all";
  const rows = (filter === "unread" ? mine.filter((item) => !item.readAt) : mine).map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    href: item.href,
    type: item.type,
    unread: !item.readAt,
    when: formatRelative(item.createdAt, now),
    createdAt: item.createdAt,
  }));
  return {
    base: base(ctx),
    orgSlug: ctx.org.slug,
    filter,
    counts: { all: mine.length, unread: mine.filter((item) => !item.readAt).length },
    page: paginate(rows, Number(query.page) || 1, 15),
  };
}
