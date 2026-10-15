import "server-only";
import { notFound } from "next/navigation";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { checkLimit, getPlan } from "@/lib/billing/plans";
import { isProjectActive } from "@/lib/domain/rules";
import { PROJECT_STATUS } from "@/lib/domain/labels";
import { formatRelative } from "@/lib/utils";
import {
  canManageProject,
  canSubmitDeliverable,
  canWorkOnProject,
  getVisibleDeliverable,
  getVisibleProject,
  visibleActivity,
  visibleProjects,
  type TeamContext,
} from "../access";
import { previewUrlFor } from "@/lib/storage/uploads";
import { getDb } from "../store";
import {
  approvalsOf,
  newestFirst,
  paginate,
  sortTasks,
  summarizeProject,
  toActivityView,
  toCommentView,
  toDeliverableRow,
  toMilestoneView,
  toTaskRow,
  toUserLite,
  versionsOf,
  taskDueText,
  type ProjectSummary,
  type UserLite,
} from "../views";
import type { ID, Priority, ProjectStatus, TaskStatus } from "../types";

/* ---------- List ---------- */

export const PROJECT_SORTS = {
  updated: "Recently updated",
  due: "Due date",
  name: "Name",
  progress: "Progress",
} as const;
export type ProjectSort = keyof typeof PROJECT_SORTS;

export interface ProjectListQuery {
  q?: string;
  status?: string;
  client?: string;
  sort?: string;
  page?: string;
}

export async function listProjects(orgSlug: string, query: ProjectListQuery) {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const now = new Date();
  const all = visibleProjects(db, ctx);

  const status = query.status && (query.status === "active" || query.status in PROJECT_STATUS) ? query.status : "all";
  const sort: ProjectSort = query.sort && query.sort in PROJECT_SORTS ? (query.sort as ProjectSort) : "updated";
  const q = query.q?.trim().toLowerCase() ?? "";
  const clientId = query.client ?? "";

  let rows = all.map((project) => summarizeProject(db, project, now));
  if (q) {
    rows = rows.filter(
      (row) => row.name.toLowerCase().includes(q) || row.client?.name.toLowerCase().includes(q) || row.description.toLowerCase().includes(q),
    );
  }
  if (clientId) rows = rows.filter((row) => (clientId === "internal" ? row.client === null : row.client?.id === clientId));
  const beforeStatus = rows;
  if (status === "active") rows = rows.filter((row) => isProjectActive(row));
  else if (status !== "all") rows = rows.filter((row) => row.status === status);

  rows.sort((a, b) => {
    switch (sort) {
      case "due":
        return (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity);
      case "name":
        return a.name.localeCompare(b.name);
      case "progress":
        return b.progress - a.progress;
      default:
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    }
  });

  const counts: Record<string, number> = { all: beforeStatus.length, active: beforeStatus.filter((row) => isProjectActive(row)).length };
  for (const key of Object.keys(PROJECT_STATUS)) counts[key] = beforeStatus.filter((row) => row.status === key).length;

  const clientIds = new Set(all.map((project) => project.clientId).filter(Boolean));
  return {
    base: `/w/${ctx.org.slug}`,
    page: paginate(rows, Number(query.page) || 1, 8),
    totalVisible: all.length,
    counts,
    filters: { q: query.q ?? "", status, sort, client: clientId },
    clients: db.clients
      .filter((client) => clientIds.has(client.id))
      .map((client) => ({ id: client.id, name: client.companyName })),
    hasInternal: all.some((project) => project.clientId === null),
    canCreate: can(ctx.role, "projects.create"),
    scopeNote: can(ctx.role, "projects.view_all") ? null : "You see the projects you're assigned to.",
  };
}

/* ---------- Single project ---------- */

/** Loads a project the viewer may see, or renders a 404 (never a 403, so IDs can't be probed). */
export async function loadProject(orgSlug: string, projectId: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const project = getVisibleProject(db, ctx, projectId);
  if (!project) notFound();
  return { ctx, db, project, base: `/w/${ctx.org.slug}`, projectBase: `/w/${ctx.org.slug}/projects/${project.id}` };
}

async function teamOptions(ctx: TeamContext): Promise<UserLite[]> {
  const db = await getDb();
  return db.memberships
    .filter((item) => item.organizationId === ctx.org.id && item.status === "active" && item.role !== "billing")
    .map((item) => db.users.find((user) => user.id === item.userId)!)
    .map(toUserLite)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ProjectHeader {
  base: string;
  projectBase: string;
  orgSlug: string;
  summary: ProjectSummary;
  clientContact: string | null;
  can: { manage: boolean; work: boolean; submit: boolean; share: boolean };
  counts: { tasks: number; milestones: number; deliverables: number; files: number };
}

export async function getProjectHeader(orgSlug: string, projectId: string): Promise<ProjectHeader> {
  const { ctx, db, project, base, projectBase } = await loadProject(orgSlug, projectId);
  const now = new Date();
  const client = db.clients.find((item) => item.id === project.clientId);
  return {
    base,
    projectBase,
    orgSlug: ctx.org.slug,
    summary: summarizeProject(db, project, now),
    clientContact: client ? `${client.contactName} · ${client.email}` : null,
    can: {
      manage: canManageProject(db, ctx, project),
      work: canWorkOnProject(db, ctx, project),
      submit: canSubmitDeliverable(db, ctx, project),
      share: can(ctx.role, "projects.share"),
    },
    counts: {
      tasks: db.tasks.filter((task) => task.projectId === project.id && task.status !== "done").length,
      milestones: db.milestones.filter((item) => item.projectId === project.id).length,
      deliverables: db.deliverables.filter((item) => item.projectId === project.id).length,
      files: db.files.filter((item) => item.projectId === project.id).length,
    },
  };
}

export async function getProjectOverview(orgSlug: string, projectId: string) {
  const { ctx, db, project, base, projectBase } = await loadProject(orgSlug, projectId);
  const now = new Date();
  const milestones = db.milestones
    .filter((item) => item.projectId === project.id)
    .sort((a, b) => a.position - b.position)
    .map((item) => toMilestoneView(db, item));
  const upcoming = sortTasks(db.tasks.filter((task) => task.projectId === project.id && task.status !== "done"))
    .slice(0, 6)
    .map((task) => ({ ...toTaskRow(db, task, now), dueText: taskDueText(task, now) }));
  const deliverables = newestFirst(
    db.deliverables.filter((item) => item.projectId === project.id).map((item) => ({ ...toDeliverableRow(db, item), createdAt: item.updatedAt })),
  ).slice(0, 5);
  const activity = newestFirst(visibleActivity(db, ctx, db.activity.filter((event) => event.projectId === project.id)))
    .slice(0, 6)
    .map((event) => ({ ...toActivityView(db, event, base), when: formatRelative(event.createdAt, now) }));
  const tasks = db.tasks.filter((task) => task.projectId === project.id);
  const byStatus = (["todo", "in_progress", "in_review", "blocked", "done"] as TaskStatus[]).map((status) => ({
    status,
    count: tasks.filter((task) => task.status === status).length,
  }));
  return { base, projectBase, milestones, upcoming, deliverables, activity, byStatus, totalTasks: tasks.length };
}

/* ---------- Tasks ---------- */

export interface ProjectTasksQuery {
  view?: string;
  status?: string;
  assignee?: string;
  priority?: string;
  q?: string;
  task?: string;
}

export async function getProjectTasks(orgSlug: string, projectId: string, query: ProjectTasksQuery) {
  const { ctx, db, project, projectBase } = await loadProject(orgSlug, projectId);
  const now = new Date();
  const view = query.view === "list" ? "list" : "board";
  const q = query.q?.trim().toLowerCase() ?? "";
  let tasks = db.tasks.filter((task) => task.projectId === project.id);
  if (q) tasks = tasks.filter((task) => task.title.toLowerCase().includes(q));
  if (query.assignee) tasks = tasks.filter((task) => (query.assignee === "none" ? !task.assigneeUserId : task.assigneeUserId === query.assignee));
  if (query.priority) tasks = tasks.filter((task) => task.priority === (query.priority as Priority));
  if (query.status && view === "list") tasks = tasks.filter((task) => task.status === (query.status as TaskStatus));

  const rows = sortTasks(tasks).map((task) => ({ ...toTaskRow(db, task, now), dueText: taskDueText(task, now) }));
  const selected = query.task ? db.tasks.find((task) => task.id === query.task && task.projectId === project.id) : undefined;

  const members = db.projectMembers
    .filter((item) => item.projectId === project.id)
    .map((item) => db.users.find((user) => user.id === item.userId)!)
    .map(toUserLite);

  return {
    projectBase,
    orgSlug: ctx.org.slug,
    projectId: project.id,
    view,
    rows,
    projectShared: project.sharedWithClient,
    filters: { q: query.q ?? "", status: query.status ?? "", assignee: query.assignee ?? "", priority: query.priority ?? "" },
    members,
    milestones: db.milestones
      .filter((item) => item.projectId === project.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ id: item.id, title: item.title })),
    canWork: canWorkOnProject(db, ctx, project),
    selected: selected
      ? {
          ...toTaskRow(db, selected, now),
          dueText: taskDueText(selected, now),
          createdBy: toUserLite(db.users.find((user) => user.id === selected.createdByUserId)!),
          comments: newestFirst(db.comments.filter((item) => item.taskId === selected.id))
            .reverse()
            .map((item) => ({ ...toCommentView(db, item), when: formatRelative(item.createdAt, now) })),
        }
      : null,
  };
}

/* ---------- Deliverables ---------- */

export async function getProjectDeliverables(orgSlug: string, projectId: string, query: { status?: string }) {
  const { ctx, db, project, projectBase } = await loadProject(orgSlug, projectId);
  const now = new Date();
  let items = db.deliverables.filter((item) => item.projectId === project.id);
  const counts = {
    all: items.length,
    draft: items.filter((item) => item.status === "draft").length,
    in_review: items.filter((item) => item.status === "in_review").length,
    changes_requested: items.filter((item) => item.status === "changes_requested").length,
    approved: items.filter((item) => item.status === "approved").length,
  };
  if (query.status && query.status in counts && query.status !== "all") items = items.filter((item) => item.status === query.status);
  return {
    projectBase,
    orgSlug: ctx.org.slug,
    projectId: project.id,
    status: query.status ?? "all",
    counts,
    rows: items
      .map((item) => ({ ...toDeliverableRow(db, item), updatedText: formatRelative(item.updatedAt, now) }))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    milestones: db.milestones
      .filter((item) => item.projectId === project.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ id: item.id, title: item.title })),
    canUpload: canWorkOnProject(db, ctx, project),
    sharedWithClient: project.sharedWithClient,
  };
}

export async function getDeliverableDetail(orgSlug: string, projectId: string, deliverableId: ID) {
  const { ctx, db, project, projectBase } = await loadProject(orgSlug, projectId);
  const deliverable = getVisibleDeliverable(db, ctx, deliverableId);
  if (!deliverable || deliverable.projectId !== project.id) notFound();
  const now = new Date();
  const row = toDeliverableRow(db, deliverable);
  const versions = versionsOf(db, deliverable.id).map((version) => ({ ...version, when: formatRelative(version.createdAt, now) }));
  const approvals = approvalsOf(db, deliverable.id).map((approval) => ({ ...approval, when: formatRelative(approval.decidedAt, now) }));
  const comments = db.comments
    .filter((item) => item.deliverableId === deliverable.id)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((item) => ({ ...toCommentView(db, item), when: formatRelative(item.createdAt, now) }));
  const client = db.clients.find((item) => item.id === project.clientId);
  const reviewers = client
    ? db.clientMemberships
        .filter((item) => item.clientId === client.id && item.status === "active")
        .map((item) => ({ ...toUserLite(db.users.find((user) => user.id === item.userId)!), role: item.role }))
    : [];

  return {
    projectBase,
    orgSlug: ctx.org.slug,
    project: { id: project.id, name: project.name, sharedWithClient: project.sharedWithClient },
    clientName: client?.companyName ?? null,
    deliverable: row,
    versions,
    previewUrl: versions[0] ? await previewUrlFor(versions[0]) : null,
    approvals,
    comments,
    reviewers,
    can: {
      upload: canWorkOnProject(db, ctx, project),
      submit: canSubmitDeliverable(db, ctx, project) && deliverable.status === "draft" && project.sharedWithClient && Boolean(project.clientId),
      comment: can(ctx.role, "comments.internal"),
    },
    submitBlocker:
      deliverable.status !== "draft"
        ? null
        : !project.clientId
          ? "Internal projects have no client to review."
          : !project.sharedWithClient
            ? "Share the project with the client before submitting work."
            : !canSubmitDeliverable(db, ctx, project)
              ? "Only the project lead or a manager can send work to the client."
              : null,
  };
}

/* ---------- Create form ---------- */

export async function getNewProjectForm(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "projects.create")) notFound();
  const db = await getDb();
  const subscription = db.subscriptions.find((item) => item.organizationId === ctx.org.id);
  const plan = getPlan(subscription?.planKey ?? "starter");
  const activeCount = db.projects.filter((item) => item.organizationId === ctx.org.id && isProjectActive(item)).length;
  return {
    base: `/w/${ctx.org.slug}`,
    orgSlug: ctx.org.slug,
    clients: db.clients
      .filter((client) => client.organizationId === ctx.org.id && client.status !== "archived")
      .map((client) => ({ id: client.id, name: client.companyName })),
    team: await teamOptions(ctx),
    currentUserId: ctx.user.id,
    limit: checkLimit(plan, "projects", activeCount),
    planName: plan.name,
  };
}

export type ProjectStatusOption = { value: ProjectStatus; label: string };
export const PROJECT_STATUS_OPTIONS: ProjectStatusOption[] = (Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((value) => ({
  value,
  label: PROJECT_STATUS[value].label,
}));
