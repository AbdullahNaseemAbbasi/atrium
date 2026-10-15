import "server-only";
import { notFound } from "next/navigation";
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isValid,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { isProjectActive, isTaskOverdue } from "@/lib/domain/rules";
import { PRIORITY_ORDER, TASK_STATUS } from "@/lib/domain/labels";
import { formatRelative } from "@/lib/utils";
import { canWorkOnProject, visibleProjects } from "../access";
import { getDb } from "../store";
import { newestFirst, paginate, sortTasks, taskDueText, toCommentView, toTaskRow, toUserLite, type UserLite } from "../views";
import type { Database, Priority, Project, Task, TaskStatus } from "../types";
import type { BoardTask } from "@/components/tasks/task-board";
import type { DrawerTask } from "@/components/tasks/task-drawer";

/* ---------- Filters ---------- */

export const TASK_VIEWS = ["list", "board", "calendar"] as const;
export type WorkspaceTaskView = (typeof TASK_VIEWS)[number];

export const DUE_FILTERS = {
  overdue: "Overdue",
  today: "Due today",
  week: "Due in the next 7 days",
  none: "No due date",
} as const;
export type DueFilter = keyof typeof DUE_FILTERS;

export interface WorkspaceTasksQuery {
  view?: string;
  scope?: string;
  status?: string;
  priority?: string;
  project?: string;
  due?: string;
  q?: string;
  page?: string;
  month?: string;
  task?: string;
}

export interface WorkspaceTaskFilters {
  view: WorkspaceTaskView;
  scope: "mine" | "all";
  status: "" | "open" | TaskStatus;
  priority: "" | Priority;
  project: string;
  due: "" | DueFilter;
  q: string;
  month: string;
}

export type WorkspaceTaskRow = BoardTask & { clientName: string | null };

export interface CalendarTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  overdue: boolean;
  projectName: string;
  assignee: UserLite | null;
}

export interface CalendarDay {
  key: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  tasks: CalendarTask[];
}

export interface TaskCalendar {
  month: string;
  label: string;
  prev: string;
  next: string;
  current: string;
  isCurrentMonth: boolean;
  days: CalendarDay[];
  inMonth: number;
  undated: number;
}

export interface NewTaskProject {
  id: string;
  name: string;
  clientName: string | null;
  shared: boolean;
  members: UserLite[];
  milestones: { id: string; title: string }[];
}

const PAGE_SIZE = 15;
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function parseFilters(query: WorkspaceTasksQuery, now: Date, projectIds: Set<string>): WorkspaceTaskFilters {
  const view = (TASK_VIEWS as readonly string[]).includes(query.view ?? "") ? (query.view as WorkspaceTaskView) : "list";
  const status = query.status === "open" || (query.status && query.status in TASK_STATUS) ? (query.status as WorkspaceTaskFilters["status"]) : "";
  const priority = PRIORITY_ORDER.includes(query.priority as Priority) ? (query.priority as Priority) : "";
  const due = query.due && query.due in DUE_FILTERS ? (query.due as DueFilter) : "";
  // A project id only counts when the viewer can see that project.
  const project = query.project && projectIds.has(query.project) ? query.project : "";
  let month = format(now, "yyyy-MM");
  if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
    const parsed = parse(query.month, "yyyy-MM", now);
    if (isValid(parsed) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100) month = query.month;
  }
  return {
    view,
    scope: query.scope === "mine" ? "mine" : "all",
    status,
    priority,
    project,
    due,
    q: query.q?.trim() ?? "",
    month,
  };
}

function matchesDue(task: Task, due: DueFilter, now: Date) {
  if (due === "none") return !task.dueAt;
  if (!task.dueAt || task.status === "done") return false;
  const diff = differenceInCalendarDays(parseISO(task.dueAt), now);
  if (due === "overdue") return isTaskOverdue(task, now);
  if (due === "today") return diff === 0;
  return diff >= 0 && diff <= 7;
}

function projectMembers(db: Database, projectId: string): UserLite[] {
  return db.projectMembers
    .filter((item) => item.projectId === projectId)
    .map((item) => db.users.find((user) => user.id === item.userId))
    .filter((user): user is NonNullable<typeof user> => Boolean(user))
    .map(toUserLite);
}

function projectMilestones(db: Database, projectId: string) {
  return db.milestones
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ id: item.id, title: item.title }));
}

function buildCalendar(tasks: Task[], projects: Map<string, Project>, db: Database, monthKey: string, now: Date): TaskCalendar {
  const monthStart = startOfMonth(parse(monthKey, "yyyy-MM", now));
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
  const byDay = new Map<string, CalendarTask[]>();
  let inMonth = 0;
  for (const task of tasks) {
    if (!task.dueAt) continue;
    const due = parseISO(task.dueAt);
    const key = format(due, "yyyy-MM-dd");
    if (due.getMonth() === monthStart.getMonth() && due.getFullYear() === monthStart.getFullYear()) inMonth += 1;
    const list = byDay.get(key) ?? [];
    list.push({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      overdue: isTaskOverdue(task, now),
      projectName: projects.get(task.projectId)?.name ?? "",
      assignee: task.assigneeUserId ? toUserLiteById(db, task.assigneeUserId) : null,
    });
    byDay.set(key, list);
  }
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date): CalendarDay => {
    const key = format(date, "yyyy-MM-dd");
    const dayTasks = (byDay.get(key) ?? []).sort((a, b) => {
      const doneA = a.status === "done" ? 1 : 0;
      const doneB = b.status === "done" ? 1 : 0;
      return doneA - doneB || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title);
    });
    return {
      key,
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === monthStart.getMonth(),
      isToday: isSameDay(date, now),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      tasks: dayTasks,
    };
  });
  return {
    month: monthKey,
    label: format(monthStart, "MMMM yyyy"),
    prev: format(subMonths(monthStart, 1), "yyyy-MM"),
    next: format(addMonths(monthStart, 1), "yyyy-MM"),
    current: format(now, "yyyy-MM"),
    isCurrentMonth: monthKey === format(now, "yyyy-MM"),
    days,
    inMonth,
    undated: tasks.filter((task) => !task.dueAt).length,
  };
}

function toUserLiteById(db: Database, id: string) {
  const user = db.users.find((item) => item.id === id);
  return user ? toUserLite(user) : null;
}

/**
 * Every task the viewer can see across the workspace: list, board or
 * calendar, with the same filters. Members only see tasks on projects they're
 * assigned to; billing managers have no project access at all.
 */
export async function getWorkspaceTasks(orgSlug: string, query: WorkspaceTasksQuery) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "projects.view_assigned")) notFound();
  const db = await getDb();
  const now = new Date();
  const base = `/w/${ctx.org.slug}`;

  const projects = visibleProjects(db, ctx);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const filters = parseFilters(query, now, new Set(projectById.keys()));
  const visible = db.tasks.filter((task) => task.organizationId === ctx.org.id && projectById.has(task.projectId));

  let tasks = visible;
  if (filters.scope === "mine") tasks = tasks.filter((task) => task.assigneeUserId === ctx.user.id);
  if (filters.project) tasks = tasks.filter((task) => task.projectId === filters.project);
  if (filters.priority) tasks = tasks.filter((task) => task.priority === filters.priority);
  if (filters.due) tasks = tasks.filter((task) => matchesDue(task, filters.due as DueFilter, now));
  if (filters.q) {
    const q = filters.q.toLowerCase();
    tasks = tasks.filter((task) => task.title.toLowerCase().includes(q) || projectById.get(task.projectId)?.name.toLowerCase().includes(q));
  }

  const beforeStatus = tasks;
  const statusCounts: Record<string, number> = {
    all: beforeStatus.length,
    open: beforeStatus.filter((task) => task.status !== "done").length,
  };
  for (const key of Object.keys(TASK_STATUS)) statusCounts[key] = beforeStatus.filter((task) => task.status === key).length;

  // The board shows every status as a column, so the status filter only applies to list and calendar.
  if (filters.status && filters.view !== "board") {
    tasks = tasks.filter((task) => (filters.status === "open" ? task.status !== "done" : task.status === filters.status));
  }

  const clientName = (projectId: string) => {
    const clientId = projectById.get(projectId)?.clientId;
    return clientId ? (db.clients.find((client) => client.id === clientId)?.companyName ?? null) : null;
  };
  const toRow = (task: Task): WorkspaceTaskRow => ({
    ...toTaskRow(db, task, now),
    dueText: taskDueText(task, now),
    clientName: clientName(task.projectId),
  });

  const sorted = sortTasks(tasks);
  const page = filters.view === "list" ? paginate(sorted.map(toRow), Number(query.page) || 1, PAGE_SIZE) : null;
  const board = filters.view === "board" ? sorted.map(toRow) : null;
  const calendar = filters.view === "calendar" ? buildCalendar(tasks, projectById, db, filters.month, now) : null;

  const selectedTask = query.task ? visible.find((task) => task.id === query.task) : undefined;
  const selectedProject = selectedTask ? projectById.get(selectedTask.projectId) : undefined;
  const selected: DrawerTask | null =
    selectedTask && selectedProject
      ? {
          ...toTaskRow(db, selectedTask, now),
          dueText: taskDueText(selectedTask, now),
          createdBy: toUserLiteById(db, selectedTask.createdByUserId) ?? { id: "unknown", name: "Unknown", email: "", avatarHue: 200 },
          comments: newestFirst(db.comments.filter((item) => item.taskId === selectedTask.id && item.organizationId === ctx.org.id))
            .reverse()
            .map((item) => ({ ...toCommentView(db, item), when: formatRelative(item.createdAt, now) })),
        }
      : null;

  const workable = projects
    .filter((project) => canWorkOnProject(db, ctx, project) && project.status !== "completed" && project.status !== "cancelled")
    .sort((a, b) => Number(isProjectActive(b)) - Number(isProjectActive(a)) || a.name.localeCompare(b.name));

  const openOf = (list: Task[]) => list.filter((task) => task.status !== "done").length;

  return {
    base,
    orgSlug: ctx.org.slug,
    filters,
    hasFilters: Boolean(filters.q || filters.project || filters.priority || filters.due || filters.status),
    totalVisible: visible.length,
    scopeCounts: { all: openOf(visible), mine: openOf(visible.filter((task) => task.assigneeUserId === ctx.user.id)) },
    statusCounts,
    resultCount: tasks.length,
    page,
    board,
    calendar,
    selected,
    drawer: selectedProject
      ? {
          members: projectMembers(db, selectedProject.id),
          milestones: projectMilestones(db, selectedProject.id),
          canWork: canWorkOnProject(db, ctx, selectedProject),
          projectShared: selectedProject.sharedWithClient,
        }
      : { members: [], milestones: [], canWork: false, projectShared: false },
    projects: [...projects].sort((a, b) => a.name.localeCompare(b.name)).map((project) => ({ id: project.id, name: project.name })),
    newTaskProjects: workable.map(
      (project): NewTaskProject => ({
        id: project.id,
        name: project.name,
        clientName: clientName(project.id),
        shared: project.sharedWithClient,
        members: projectMembers(db, project.id),
        milestones: projectMilestones(db, project.id),
      }),
    ),
    canWork: can(ctx.role, "tasks.manage"),
    scopeNote: can(ctx.role, "projects.view_all") ? null : "You see tasks on the projects you're assigned to.",
  };
}

export type WorkspaceTasks = Awaited<ReturnType<typeof getWorkspaceTasks>>;
