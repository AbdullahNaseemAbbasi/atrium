import "server-only";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { notFound } from "next/navigation";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { isTaskOpen, isTaskOverdue, projectProgress, weeklyCounts } from "@/lib/domain/rules";
import { visibleProjects } from "../access";
import { getDb } from "../store";
import type { Approval, Client, Database, Deliverable, DeliverableVersion, ID, Project, ProjectStatus, Task } from "../types";

/**
 * Reports. Every number on /reports comes from one of the pure functions
 * below; each documents its formula, and the page repeats it in plain words
 * under "How we calculate this".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Middle value of a list (mean of the two middle values for even counts). Null for an empty list. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/* ---------- Throughput ---------- */

export interface WeekCount {
  label: string;
  weekStart: string;
  count: number;
}

/**
 * Tasks completed per week = number of tasks whose `completedAt` falls in
 * each Monday-to-Sunday week, for the last `weeks` weeks (oldest first).
 * The last bucket is the current, partial week.
 */
export function tasksCompletedPerWeek(tasks: Pick<Task, "completedAt">[], now: Date, weeks = 12): WeekCount[] {
  return weeklyCounts(
    tasks.map((task) => task.completedAt),
    now,
    weeks,
  ).map((bucket, index, all) => ({
    label: index === all.length - 1 ? "This week" : format(bucket.start, "MMM d"),
    weekStart: bucket.start.toISOString(),
    count: bucket.count,
  }));
}

/** Tasks completed in the `days` days before `end` (exclusive of tasks completed after `end`). */
export function tasksCompletedBetween(tasks: Pick<Task, "completedAt">[], end: Date, days: number) {
  const from = subDays(end, days).getTime();
  const to = end.getTime();
  return tasks.filter((task) => task.completedAt && Date.parse(task.completedAt) > from && Date.parse(task.completedAt) <= to).length;
}

/* ---------- Review turnaround ---------- */

export interface DecisionTurnaround {
  deliverableId: ID;
  version: number;
  decision: Approval["decision"];
  days: number;
}

/**
 * Turnaround of one client decision = time from the version being sent for
 * review to the decision on that version, in days (fractional).
 * "Sent for review" is the deliverable's `submittedAt` for its current
 * version and the upload time for earlier versions (each earlier version was
 * submitted when it was uploaded). Negative spans (bad data) are dropped.
 */
export function decisionTurnarounds(
  deliverables: Pick<Deliverable, "id" | "currentVersion" | "submittedAt">[],
  versions: Pick<DeliverableVersion, "deliverableId" | "version" | "createdAt">[],
  approvals: Pick<Approval, "deliverableId" | "version" | "decision" | "decidedAt">[],
): DecisionTurnaround[] {
  const result: DecisionTurnaround[] = [];
  for (const approval of approvals) {
    const deliverable = deliverables.find((item) => item.id === approval.deliverableId);
    const version = versions.find((item) => item.deliverableId === approval.deliverableId && item.version === approval.version);
    if (!deliverable || !version) continue;
    const sent =
      approval.version === deliverable.currentVersion && deliverable.submittedAt ? Date.parse(deliverable.submittedAt) : Date.parse(version.createdAt);
    const span = Date.parse(approval.decidedAt) - sent;
    if (span < 0) continue;
    result.push({ deliverableId: deliverable.id, version: approval.version, decision: approval.decision, days: span / DAY_MS });
  }
  return result;
}

export interface ClientTurnaround {
  clientId: ID;
  clientName: string;
  hue: number;
  /** Median days from submit to decision, one decimal. Null when the client hasn't decided yet. */
  medianDays: number | null;
  decisions: number;
}

/** Median turnaround per client = median of `decisionTurnarounds` for deliverables in that client's projects. */
export function turnaroundByClient(
  clients: Pick<Client, "id" | "companyName" | "brandHue">[],
  projects: Pick<Project, "id" | "clientId">[],
  deliverables: Pick<Deliverable, "id" | "projectId" | "currentVersion" | "submittedAt">[],
  versions: Pick<DeliverableVersion, "deliverableId" | "version" | "createdAt">[],
  approvals: Pick<Approval, "deliverableId" | "version" | "decision" | "decidedAt">[],
): ClientTurnaround[] {
  const spans = decisionTurnarounds(deliverables, versions, approvals);
  return clients
    .map((client) => {
      const projectIds = new Set(projects.filter((project) => project.clientId === client.id).map((project) => project.id));
      const deliverableIds = new Set(deliverables.filter((item) => projectIds.has(item.projectId)).map((item) => item.id));
      const own = spans.filter((span) => deliverableIds.has(span.deliverableId)).map((span) => span.days);
      const value = median(own);
      return { clientId: client.id, clientName: client.companyName, hue: client.brandHue, medianDays: value === null ? null : round1(value), decisions: own.length };
    })
    .sort((a, b) => (a.medianDays ?? Infinity) - (b.medianDays ?? Infinity));
}

/* ---------- First-pass approval ---------- */

export interface FirstPass {
  /** Deliverables with at least one client decision. */
  decided: number;
  /** Of those, approved on version 1 with no change request before. */
  firstPass: number;
  /** firstPass ÷ decided as a whole percent; null when nothing was decided. */
  rate: number | null;
}

/**
 * First-pass approval rate = deliverables whose earliest client decision is
 * an approval of version 1, divided by deliverables that have at least one
 * client decision. Deliverables still waiting for their first decision are
 * left out of both sides.
 */
export function firstPassApproval(
  deliverableIds: ID[],
  approvals: Pick<Approval, "deliverableId" | "version" | "decision" | "decidedAt">[],
): FirstPass {
  let decided = 0;
  let firstPass = 0;
  for (const id of deliverableIds) {
    const own = approvals.filter((item) => item.deliverableId === id).sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt));
    if (own.length === 0) continue;
    decided += 1;
    if (own[0].decision === "approved" && own[0].version === 1) firstPass += 1;
  }
  return { decided, firstPass, rate: decided === 0 ? null : Math.round((firstPass / decided) * 100) };
}

/* ---------- Workload ---------- */

export interface MemberLoad {
  userId: ID | null;
  name: string;
  avatarHue: number;
  open: number;
  overdue: number;
}

/**
 * Open tasks by team member = tasks not in "done", grouped by assignee.
 * Overdue = open with a due date before today. Members with no open tasks are
 * included (0) so idle capacity is visible; unassigned open tasks get their
 * own row. Sorted by open tasks, highest first.
 */
export function openTasksByMember(
  members: { id: ID; name: string; avatarHue: number }[],
  tasks: Pick<Task, "status" | "dueAt" | "assigneeUserId">[],
  now: Date,
): MemberLoad[] {
  const open = tasks.filter(isTaskOpen);
  const rows: MemberLoad[] = members.map((member) => {
    const own = open.filter((task) => task.assigneeUserId === member.id);
    return { userId: member.id, name: member.name, avatarHue: member.avatarHue, open: own.length, overdue: own.filter((task) => isTaskOverdue(task, now)).length };
  });
  const memberIds = new Set(members.map((member) => member.id));
  const unassigned = open.filter((task) => !task.assigneeUserId || !memberIds.has(task.assigneeUserId));
  if (unassigned.length > 0) {
    rows.push({ userId: null, name: "Unassigned", avatarHue: 215, open: unassigned.length, overdue: unassigned.filter((task) => isTaskOverdue(task, now)).length });
  }
  return rows.sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
}

/* ---------- Project health ---------- */

export type Health = "on_track" | "at_risk" | "late" | "not_started";

/** Percentage points progress may trail time elapsed before a project is "at risk". */
export const AT_RISK_GAP = 15;

export interface HealthResult {
  /** Share of the schedule that has passed, 0 to 100. Null without both dates. */
  elapsed: number | null;
  /** progress − elapsed, in percentage points. */
  gap: number | null;
  health: Health;
}

/**
 * Project health:
 * - Time elapsed = (now − start) ÷ (due − start), clamped to 0 to 100%.
 * - Late = the due date has passed and the project isn't completed.
 * - Not started = the start date is still in the future.
 * - At risk = progress trails time elapsed by more than 15 percentage points.
 * - On track = everything else (including projects without dates).
 */
export function projectHealth(progress: number, status: ProjectStatus, startAt: string | undefined, dueAt: string | undefined, now: Date): HealthResult {
  if (dueAt && status !== "completed" && status !== "cancelled" && differenceInCalendarDays(parseISO(dueAt), now) < 0) {
    return { elapsed: 100, gap: progress - 100, health: "late" };
  }
  if (!startAt || !dueAt) return { elapsed: null, gap: null, health: "on_track" };
  const start = Date.parse(startAt);
  const due = Date.parse(dueAt);
  if (now.getTime() < start) return { elapsed: 0, gap: progress, health: "not_started" };
  const elapsed = due <= start ? 100 : Math.min(100, Math.max(0, Math.round(((now.getTime() - start) / (due - start)) * 100)));
  const gap = progress - elapsed;
  return { elapsed, gap, health: gap < -AT_RISK_GAP ? "at_risk" : "on_track" };
}

/* ---------- Page loader ---------- */

export interface ProjectHealthRow {
  id: ID;
  name: string;
  clientName: string | null;
  status: ProjectStatus;
  progress: number;
  elapsed: number | null;
  gap: number | null;
  health: Health;
  dueAt?: string;
  daysLeft: number | null;
}

function weeklySeries(values: WeekCount[]) {
  return values.map((item) => ({ label: item.label === "This week" ? item.label : `Week of ${item.label}`, value: item.count }));
}

export async function getReports(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "reports.view")) notFound();
  const db: Database = getDb();
  const now = new Date();

  const projects = visibleProjects(db, ctx);
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = db.tasks.filter((task) => projectIds.has(task.projectId));
  const deliverables = db.deliverables.filter((item) => projectIds.has(item.projectId));
  const deliverableIds = new Set(deliverables.map((item) => item.id));
  const versions = db.deliverableVersions.filter((item) => deliverableIds.has(item.deliverableId));
  const approvals = db.approvals.filter((item) => deliverableIds.has(item.deliverableId));
  const clients = db.clients.filter((item) => item.organizationId === ctx.org.id);

  // Throughput
  const weekly = tasksCompletedPerWeek(tasks, now);
  const completed30 = tasksCompletedBetween(tasks, now, 30);
  const completedPrev30 = tasksCompletedBetween(tasks, subDays(now, 30), 30);

  // Turnaround
  const spans = decisionTurnarounds(deliverables, versions, approvals);
  const overallTurnaround = median(spans.map((span) => span.days));
  const byClient = turnaroundByClient(clients, projects, deliverables, versions, approvals).filter((row) => row.decisions > 0);

  // First pass
  const firstPass = firstPassApproval([...deliverableIds], approvals);
  const firstPassByClient = clients
    .map((client) => {
      const ids = deliverables
        .filter((item) => projects.find((project) => project.id === item.projectId)?.clientId === client.id)
        .map((item) => item.id);
      return { clientId: client.id, clientName: client.companyName, ...firstPassApproval(ids, approvals) };
    })
    .filter((row) => row.decided > 0)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.decided - a.decided);

  // Workload
  const members = db.memberships
    .filter((item) => item.organizationId === ctx.org.id && item.status === "active" && item.role !== "billing")
    .map((item) => db.users.find((user) => user.id === item.userId))
    .filter((user): user is NonNullable<typeof user> => Boolean(user))
    .map((user) => ({ id: user.id, name: user.name, avatarHue: user.avatarHue }));
  const workload = openTasksByMember(members, tasks, now);

  // Health
  const health: ProjectHealthRow[] = projects
    .filter((project) => project.status !== "completed" && project.status !== "cancelled")
    .map((project) => {
      const progress = projectProgress(project, tasks.filter((task) => task.projectId === project.id));
      const result = projectHealth(progress, project.status, project.startAt, project.dueAt, now);
      return {
        id: project.id,
        name: project.name,
        clientName: db.clients.find((client) => client.id === project.clientId)?.companyName ?? null,
        status: project.status,
        progress,
        ...result,
        dueAt: project.dueAt,
        daysLeft: project.dueAt ? differenceInCalendarDays(parseISO(project.dueAt), now) : null,
      };
    })
    .sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] || (a.gap ?? 0) - (b.gap ?? 0));
  const atRisk = health.filter((row) => row.health === "at_risk" || row.health === "late").length;

  return {
    base: `/w/${ctx.org.slug}`,
    orgName: ctx.org.name,
    generatedAt: now.toISOString(),
    kpis: {
      completed: { value: completed30, delta: completed30 - completedPrev30, trend: weeklySeries(weekly) },
      turnaround: { value: overallTurnaround === null ? null : round1(overallTurnaround), decisions: spans.length },
      firstPass,
      atRisk: { value: atRisk, of: health.length },
    },
    weekly,
    byClient,
    firstPassByClient,
    workload,
    health,
    atRiskGap: AT_RISK_GAP,
  };
}

const HEALTH_ORDER: Record<Health, number> = { late: 0, at_risk: 1, on_track: 2, not_started: 3 };

export type ReportsData = Awaited<ReturnType<typeof getReports>>;
