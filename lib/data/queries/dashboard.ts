import "server-only";
import { differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getPlan } from "@/lib/billing/plans";
import {
  activeProjectsAt,
  overdueTasksAt,
  pendingApprovalsAt,
  reviewWindows,
  series,
  tasksDueSoonAt,
} from "@/lib/domain/metrics";
import { isTaskOverdue } from "@/lib/domain/rules";
import { dueLabel, formatRelative } from "@/lib/utils";
import { visibleActivity, visibleProjects } from "../access";
import { getDb } from "../store";
import {
  newestFirst,
  sortTasks,
  summarizeProject,
  toActivityView,
  toDeliverableRow,
  toTaskRow,
  type ActivityView,
  type ProjectSummary,
} from "../views";
import type { SparkPoint } from "@/components/ui/sparkline";
import type { DeliverableStatus, Priority, TaskStatus } from "../types";

export const DASHBOARD_RANGES = [7, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export function parseRange(value: string | string[] | undefined): DashboardRange {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (DASHBOARD_RANGES as readonly number[]).includes(n) ? (n as DashboardRange) : 30;
}

export interface DashboardStat {
  value: number;
  delta: number;
  trend: SparkPoint[];
}

export interface DashboardTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  priority: Priority;
  status: TaskStatus;
  dueAt?: string;
  dueLabel: string;
  overdue: boolean;
  dueToday: boolean;
  mine: boolean;
  assigneeName: string | null;
}

export interface ReviewItem {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  clientName: string;
  version: number;
  status: DeliverableStatus;
  submittedAt?: string;
  waitingDays: number;
}

export interface TeamDashboard {
  kind: "team";
  firstName: string;
  orgName: string;
  base: string;
  range: DashboardRange;
  can: { createProject: boolean; addClient: boolean; invite: boolean; reports: boolean; manageTeam: boolean; settings: boolean };
  stats: { active: DashboardStat; dueSoon: DashboardStat; pending: DashboardStat; overdue: DashboardStat };
  recentProjects: ProjectSummary[];
  tasks: DashboardTask[];
  defaultTaskScope: "mine" | "all";
  reviews: ReviewItem[];
  activity: (ActivityView & { when: string })[];
  overview: {
    members: number;
    membersJoined: number;
    activeClients: number;
    clientsAdded: number;
    planName: string;
    planInterval: string;
    storageUsed: number;
    storageLimit: number;
  };
}

export interface BillingDashboard {
  kind: "billing";
  firstName: string;
  orgName: string;
  base: string;
}

export async function getDashboard(orgSlug: string, range: DashboardRange): Promise<TeamDashboard | BillingDashboard> {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  const now = new Date();
  const base = `/w/${ctx.org.slug}`;
  const firstName = ctx.user.name.split(" ")[0];

  if (!can(ctx.role, "projects.view_assigned")) {
    return { kind: "billing", firstName, orgName: ctx.org.name, base };
  }

  const projects = visibleProjects(db, ctx);
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = db.tasks.filter((task) => projectIds.has(task.projectId));
  const deliverables = db.deliverables.filter((item) => projectIds.has(item.projectId));
  const windows = reviewWindows(
    deliverables,
    db.deliverableVersions.filter((item) => projectIds.has(deliverables.find((d) => d.id === item.deliverableId)?.projectId ?? "")),
    db.approvals.filter((item) => item.organizationId === ctx.org.id),
  );
  const past = subDays(now, range);

  const stat = (evaluate: (at: Date) => number): DashboardStat => {
    const value = evaluate(now);
    return { value, delta: value - evaluate(past), trend: series(now, evaluate) };
  };

  const taskRows = sortTasks(tasks.filter((task) => task.status !== "done")).map((task) => {
    const row = toTaskRow(db, task, now);
    return {
      id: row.id,
      title: row.title,
      projectId: row.project.id,
      projectName: row.project.name,
      priority: row.priority,
      status: row.status,
      dueAt: row.dueAt,
      dueLabel: dueLabel(row.dueAt, now),
      overdue: isTaskOverdue(row, now),
      dueToday: Boolean(row.dueAt && differenceInCalendarDays(parseISO(row.dueAt), now) === 0),
      mine: row.assigneeUserId === ctx.user.id,
      assigneeName: row.assignee?.name ?? null,
    } satisfies DashboardTask;
  });

  const reviews = deliverables
    .filter((item) => item.status === "in_review" || item.status === "changes_requested")
    .map((item) => toDeliverableRow(db, item))
    .sort((a, b) => Date.parse(a.submittedAt ?? a.updatedAt) - Date.parse(b.submittedAt ?? b.updatedAt))
    .map(
      (row): ReviewItem => ({
        id: row.id,
        title: row.title,
        projectId: row.project.id,
        projectName: row.project.name,
        clientName: row.client?.name ?? "Internal",
        version: row.currentVersion,
        status: row.status,
        submittedAt: row.submittedAt,
        waitingDays: Math.max(0, differenceInCalendarDays(now, parseISO(row.submittedAt ?? row.updatedAt))),
      }),
    );

  const activity = newestFirst(visibleActivity(db, ctx, db.activity))
    .filter((event) => Date.parse(event.createdAt) >= past.getTime())
    .slice(0, 6)
    .map((event) => ({ ...toActivityView(db, event, base), when: formatRelative(event.createdAt, now) }));

  const members = db.memberships.filter((item) => item.organizationId === ctx.org.id && item.status === "active");
  const clients = db.clients.filter((item) => item.organizationId === ctx.org.id);
  const subscription = db.subscriptions.find((item) => item.organizationId === ctx.org.id);
  const plan = getPlan(subscription?.planKey ?? "starter");
  const storageUsed =
    db.deliverableVersions.filter((item) => item.organizationId === ctx.org.id).reduce((sum, item) => sum + item.sizeBytes, 0) +
    db.files.filter((item) => item.organizationId === ctx.org.id).reduce((sum, item) => sum + item.sizeBytes, 0);
  const myOpen = taskRows.filter((task) => task.mine).length;

  return {
    kind: "team",
    firstName,
    orgName: ctx.org.name,
    base,
    range,
    can: {
      createProject: can(ctx.role, "projects.create"),
      addClient: can(ctx.role, "clients.manage"),
      invite: can(ctx.role, "team.invite"),
      reports: can(ctx.role, "reports.view"),
      manageTeam: can(ctx.role, "team.invite"),
      settings: can(ctx.role, "workspace.update"),
    },
    stats: {
      active: stat((at) => activeProjectsAt(projects, at)),
      dueSoon: stat((at) => tasksDueSoonAt(tasks, at)),
      pending: stat((at) => pendingApprovalsAt(windows, at)),
      overdue: stat((at) => overdueTasksAt(tasks, at)),
    },
    recentProjects: [...projects]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 5)
      .map((project) => summarizeProject(db, project, now)),
    tasks: taskRows.slice(0, 40),
    defaultTaskScope: myOpen >= 3 || !can(ctx.role, "projects.view_all") ? "mine" : "all",
    reviews,
    activity,
    overview: {
      members: members.length,
      membersJoined: members.filter((item) => Date.parse(item.joinedAt) >= past.getTime()).length,
      activeClients: clients.filter((item) => item.status === "active" || item.status === "onboarding").length,
      clientsAdded: clients.filter((item) => Date.parse(item.createdAt) >= past.getTime()).length,
      planName: plan.name,
      planInterval: subscription?.status === "trialing" ? "Free trial" : subscription?.interval === "year" ? "Billed yearly" : "Billed monthly",
      storageUsed,
      storageLimit: plan.limits.storageBytes,
    },
  };
}
