import { dueLabel, formatShortDate } from "@/lib/utils";
import {
  isTaskOverdue,
  milestoneBlockers,
  milestoneProgress,
  projectProgress,
  type MilestoneBlocker,
} from "@/lib/domain/rules";
import type {
  ActivityEvent,
  Approval,
  Client,
  Comment,
  Database,
  Deliverable,
  DeliverableVersion,
  ID,
  Milestone,
  Project,
  Task,
  User,
} from "./types";

/**
 * Read models: joins raw rows into the shapes the UI renders. Pure functions of
 * the database so the Supabase version can return identical shapes.
 */

export interface UserLite {
  id: ID;
  name: string;
  email: string;
  title?: string;
  avatarHue: number;
}

export interface ClientLite {
  id: ID;
  name: string;
  hue: number;
  status: Client["status"];
}

export function toUserLite(user: User): UserLite {
  return { id: user.id, name: user.name, email: user.email, title: user.title, avatarHue: user.avatarHue };
}

export function userLite(db: Database, id: ID | undefined | null): UserLite | null {
  if (!id) return null;
  const user = db.users.find((item) => item.id === id);
  return user ? toUserLite(user) : null;
}

export function clientLite(db: Database, id: ID | null | undefined): ClientLite | null {
  if (!id) return null;
  const client = db.clients.find((item) => item.id === id);
  return client ? { id: client.id, name: client.companyName, hue: client.brandHue, status: client.status } : null;
}

/* ---------- Projects ---------- */

export interface ProjectSummary {
  id: ID;
  name: string;
  description: string;
  icon: Project["icon"];
  status: Project["status"];
  client: ClientLite | null;
  progress: number;
  startAt?: string;
  dueAt?: string;
  sharedWithClient: boolean;
  budgetCents?: number;
  lead: UserLite | null;
  members: UserLite[];
  taskCount: number;
  openTasks: number;
  overdueTasks: number;
  pendingApprovals: number;
  updatedAt: string;
}

export function projectTasks(db: Database, projectId: ID, opts: { clientVisibleOnly?: boolean } = {}) {
  return db.tasks.filter((task) => task.projectId === projectId && (!opts.clientVisibleOnly || task.clientVisible));
}

export function summarizeProject(
  db: Database,
  project: Project,
  now: Date,
  opts: { clientVisibleOnly?: boolean } = {},
): ProjectSummary {
  const tasks = projectTasks(db, project.id, opts);
  const memberRows = db.projectMembers.filter((item) => item.projectId === project.id);
  const lead = memberRows.find((item) => item.projectRole === "lead");
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    icon: project.icon,
    status: project.status,
    client: clientLite(db, project.clientId),
    progress: projectProgress(project, tasks),
    startAt: project.startAt,
    dueAt: project.dueAt,
    sharedWithClient: project.sharedWithClient,
    budgetCents: project.budgetCents,
    lead: userLite(db, lead?.userId),
    members: memberRows.map((item) => userLite(db, item.userId)).filter((item): item is UserLite => Boolean(item)),
    taskCount: tasks.length,
    openTasks: tasks.filter((task) => task.status !== "done").length,
    overdueTasks: tasks.filter((task) => isTaskOverdue(task, now)).length,
    pendingApprovals: db.deliverables.filter((item) => item.projectId === project.id && item.status === "in_review").length,
    updatedAt: project.updatedAt,
  };
}

/* ---------- Tasks ---------- */

export interface TaskRow extends Task {
  project: { id: ID; name: string };
  assignee: UserLite | null;
  milestone: { id: ID; title: string } | null;
  overdue: boolean;
  commentCount: number;
}

export function toTaskRow(db: Database, task: Task, now: Date): TaskRow {
  const project = db.projects.find((item) => item.id === task.projectId)!;
  const milestone = task.milestoneId ? db.milestones.find((item) => item.id === task.milestoneId) : undefined;
  return {
    ...task,
    project: { id: project.id, name: project.name },
    assignee: userLite(db, task.assigneeUserId),
    milestone: milestone ? { id: milestone.id, title: milestone.title } : null,
    overdue: isTaskOverdue(task, now),
    commentCount: db.comments.filter((item) => item.taskId === task.id).length,
  };
}

/** Due text for a task row: completed tasks say when they were done instead of "overdue". */
export function taskDueText(task: Pick<Task, "status" | "dueAt" | "completedAt">, now: Date) {
  if (task.status === "done") return task.completedAt ? `Done ${formatShortDate(task.completedAt)}` : "Done";
  return dueLabel(task.dueAt, now);
}

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

/** Open tasks first, then by due date (no date last), then priority. */
export function sortTasks<T extends Pick<Task, "status" | "dueAt" | "priority">>(tasks: T[]) {
  return [...tasks].sort((a, b) => {
    const doneA = a.status === "done" ? 1 : 0;
    const doneB = b.status === "done" ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    const dueA = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
    const dueB = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
}

/* ---------- Milestones ---------- */

export interface MilestoneView extends Milestone {
  progress: number;
  taskCount: number;
  doneTasks: number;
  deliverables: { id: ID; title: string; status: Deliverable["status"] }[];
  blockers: MilestoneBlocker[];
}

export function toMilestoneView(db: Database, milestone: Milestone, opts: { clientVisibleOnly?: boolean } = {}): MilestoneView {
  const tasks = db.tasks.filter(
    (task) => task.milestoneId === milestone.id && (!opts.clientVisibleOnly || task.clientVisible),
  );
  const deliverables = db.deliverables.filter((item) => item.milestoneId === milestone.id);
  return {
    ...milestone,
    progress: milestoneProgress(milestone, tasks),
    taskCount: tasks.length,
    doneTasks: tasks.filter((task) => task.status === "done").length,
    deliverables: deliverables.map((item) => ({ id: item.id, title: item.title, status: item.status })),
    blockers: milestone.status === "completed" ? [] : milestoneBlockers(milestone, tasks, deliverables),
  };
}

/* ---------- Deliverables ---------- */

export interface VersionView extends DeliverableVersion {
  uploadedBy: UserLite | null;
}

export interface ApprovalView extends Approval {
  by: UserLite | null;
}

export interface DeliverableRow extends Deliverable {
  project: { id: ID; name: string };
  client: ClientLite | null;
  milestone: { id: ID; title: string } | null;
  latestVersion: VersionView;
  lastDecision: ApprovalView | null;
  commentCount: number;
}

export function versionsOf(db: Database, deliverableId: ID): VersionView[] {
  return db.deliverableVersions
    .filter((item) => item.deliverableId === deliverableId)
    .sort((a, b) => b.version - a.version)
    .map((version) => ({ ...version, uploadedBy: userLite(db, version.uploadedByUserId) }));
}

export function approvalsOf(db: Database, deliverableId: ID): ApprovalView[] {
  return db.approvals
    .filter((item) => item.deliverableId === deliverableId)
    .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))
    .map((approval) => ({ ...approval, by: userLite(db, approval.clientUserId) }));
}

export function toDeliverableRow(db: Database, deliverable: Deliverable, opts: { clientView?: boolean } = {}): DeliverableRow {
  const project = db.projects.find((item) => item.id === deliverable.projectId)!;
  const milestone = deliverable.milestoneId ? db.milestones.find((item) => item.id === deliverable.milestoneId) : undefined;
  const versions = versionsOf(db, deliverable.id);
  return {
    ...deliverable,
    project: { id: project.id, name: project.name },
    client: clientLite(db, project.clientId),
    milestone: milestone ? { id: milestone.id, title: milestone.title } : null,
    latestVersion: versions[0],
    lastDecision: approvalsOf(db, deliverable.id)[0] ?? null,
    commentCount: db.comments.filter(
      (item) => item.deliverableId === deliverable.id && (!opts.clientView || item.visibility === "client"),
    ).length,
  };
}

/* ---------- Comments ---------- */

export interface CommentView extends Comment {
  author: UserLite | null;
  authorIsClient: boolean;
}

export function toCommentView(db: Database, comment: Comment): CommentView {
  return {
    ...comment,
    author: userLite(db, comment.authorUserId),
    authorIsClient: db.clientMemberships.some(
      (item) => item.userId === comment.authorUserId && item.organizationId === comment.organizationId,
    ),
  };
}

/* ---------- Activity ---------- */

export interface ActivityView {
  id: ID;
  actor: UserLite | null;
  action: string;
  targetLabel: string;
  href: string | null;
  projectName: string | null;
  createdAt: string;
  verb: ActivityEvent["verb"];
}

const VERB_TEXT: Record<ActivityEvent["verb"], string> = {
  "project.created": "created the project",
  "project.status_changed": "changed the status of",
  "task.created": "added the task",
  "task.completed": "completed",
  "deliverable.uploaded": "uploaded",
  "deliverable.submitted": "sent for client review",
  "deliverable.approved": "approved",
  "deliverable.changes_requested": "requested changes to",
  "milestone.completed": "completed the milestone",
  "comment.posted": "commented on",
  "file.uploaded": "uploaded the file",
  "member.invited": "invited",
  "client.added": "added the client",
};

/** `base` is "/w/<org>" for the team app or "/portal/<org>" for clients. */
export function toActivityView(db: Database, event: ActivityEvent, base: string, portal = false): ActivityView {
  const project = event.projectId ? db.projects.find((item) => item.id === event.projectId) : undefined;
  let href: string | null = null;
  if (portal) {
    if (event.targetType === "deliverable") href = `${base}/deliverables/${event.targetId}`;
    else if (project) href = `${base}/projects/${project.id}`;
  } else if (event.targetType === "deliverable" && project) {
    href = `${base}/projects/${project.id}/deliverables/${event.targetId}`;
  } else if (event.targetType === "client") {
    href = `${base}/clients/${event.targetId}`;
  } else if (event.targetType === "member") {
    href = `${base}/team`;
  } else if (project) {
    href = `${base}/projects/${project.id}`;
  }
  return {
    id: event.id,
    actor: userLite(db, event.actorUserId),
    action: VERB_TEXT[event.verb],
    targetLabel: event.targetLabel,
    href,
    projectName: project?.name ?? null,
    createdAt: event.createdAt,
    verb: event.verb,
  };
}

export function newestFirst<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageSize,
    total: items.length,
    pageCount,
  };
}
