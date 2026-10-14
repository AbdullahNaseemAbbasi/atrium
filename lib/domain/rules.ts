import { addDays, differenceInCalendarDays, parseISO, startOfDay, startOfWeek, subWeeks } from "date-fns";
import type {
  Approval,
  Deliverable,
  DeliverableStatus,
  Milestone,
  Project,
  ProjectStatus,
  Task,
  TaskStatus,
} from "@/lib/data/types";

/**
 * Documented business rules. Every number shown on a dashboard comes from one
 * of these functions so the formulas live in exactly one place
 * (see docs/business-rules.md).
 */

export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["planning", "in_progress", "in_review"];
export const OPEN_TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "in_review", "blocked"];

export function isProjectActive(project: Pick<Project, "status">) {
  return ACTIVE_PROJECT_STATUSES.includes(project.status);
}

export function isTaskOpen(task: Pick<Task, "status">) {
  return task.status !== "done";
}

/** Overdue = open and the due date is before today (in the viewer's day). */
export function isTaskOverdue(task: Pick<Task, "status" | "dueAt">, now: Date) {
  if (!task.dueAt || !isTaskOpen(task)) return false;
  return differenceInCalendarDays(parseISO(task.dueAt), now) < 0;
}

/** Due soon = open and due today or within the next `days` days. */
export function isTaskDueSoon(task: Pick<Task, "status" | "dueAt">, now: Date, days = 7) {
  if (!task.dueAt || !isTaskOpen(task)) return false;
  const diff = differenceInCalendarDays(parseISO(task.dueAt), now);
  return diff >= 0 && diff <= days;
}

/**
 * Project progress = completed tasks ÷ all tasks, rounded to a whole percent.
 * A completed project is always 100%; a project with no tasks is 0%.
 */
export function projectProgress(project: Pick<Project, "status">, tasks: Pick<Task, "status">[]) {
  if (project.status === "completed") return 100;
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => task.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

/** Milestone progress uses the same formula over the milestone's tasks. */
export function milestoneProgress(milestone: Pick<Milestone, "status">, tasks: Pick<Task, "status">[]) {
  if (milestone.status === "completed") return 100;
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === "done").length / tasks.length) * 100);
}

export type MilestoneBlocker =
  | { kind: "open_tasks"; count: number }
  | { kind: "no_deliverables" }
  | { kind: "unapproved_deliverables"; count: number };

/**
 * A milestone can be completed when every task in it is done and, if it
 * requires approval, it has at least one deliverable and all of them are approved.
 */
export function milestoneBlockers(
  milestone: Pick<Milestone, "approvalRequired">,
  tasks: Pick<Task, "status">[],
  deliverables: Pick<Deliverable, "status">[],
): MilestoneBlocker[] {
  const blockers: MilestoneBlocker[] = [];
  const open = tasks.filter(isTaskOpen).length;
  if (open > 0) blockers.push({ kind: "open_tasks", count: open });
  if (milestone.approvalRequired) {
    if (deliverables.length === 0) blockers.push({ kind: "no_deliverables" });
    const unapproved = deliverables.filter((item) => item.status !== "approved").length;
    if (unapproved > 0) blockers.push({ kind: "unapproved_deliverables", count: unapproved });
  }
  return blockers;
}

export function describeBlocker(blocker: MilestoneBlocker) {
  switch (blocker.kind) {
    case "open_tasks":
      return `${blocker.count} open ${blocker.count === 1 ? "task" : "tasks"}`;
    case "no_deliverables":
      return "No deliverable attached for client approval";
    case "unapproved_deliverables":
      return `${blocker.count} ${blocker.count === 1 ? "deliverable is" : "deliverables are"} not approved yet`;
  }
}

/* ---------- Deliverable review state machine ---------- */

export type DeliverableEvent = "upload_version" | "submit" | "approve" | "request_changes";

const TRANSITIONS: Record<DeliverableStatus, Partial<Record<DeliverableEvent, DeliverableStatus>>> = {
  draft: { upload_version: "draft", submit: "in_review" },
  in_review: { approve: "approved", request_changes: "changes_requested", upload_version: "draft" },
  changes_requested: { upload_version: "draft" },
  approved: { upload_version: "draft" },
};

export function nextDeliverableStatus(current: DeliverableStatus, event: DeliverableEvent): DeliverableStatus | null {
  return TRANSITIONS[current][event] ?? null;
}

export function canTransition(current: DeliverableStatus, event: DeliverableEvent) {
  return nextDeliverableStatus(current, event) !== null;
}

/**
 * A client user decides once per version. A repeated request for the same
 * version returns the existing decision instead of creating a second one.
 */
export function findExistingDecision<T extends Pick<Approval, "deliverableId" | "version" | "clientUserId">>(
  approvals: T[],
  deliverableId: string,
  version: number,
  clientUserId: string,
) {
  return approvals.find(
    (approval) =>
      approval.deliverableId === deliverableId && approval.version === version && approval.clientUserId === clientUserId,
  );
}

/* ---------- Time series for trend lines ---------- */

/**
 * Counts how many dates fall in each of the last `weeks` calendar weeks
 * (Monday start), oldest first. The final bucket is the current week.
 */
export function weeklyCounts(dates: (string | undefined)[], now: Date, weeks = 12) {
  const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
  const buckets = Array.from({ length: weeks }, (_, index) => ({
    start: subWeeks(currentWeek, weeks - 1 - index),
    count: 0,
  }));
  for (const value of dates) {
    if (!value) continue;
    const date = parseISO(value);
    const week = startOfWeek(date, { weekStartsOn: 1 }).getTime();
    const bucket = buckets.find((item) => item.start.getTime() === week);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

/** Number of active projects at the end of each of the last `weeks` weeks. */
export function weeklyActiveProjects(
  projects: Pick<Project, "startAt" | "createdAt" | "status" | "updatedAt">[],
  now: Date,
  weeks = 12,
) {
  const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
  return Array.from({ length: weeks }, (_, index) => {
    const start = subWeeks(currentWeek, weeks - 1 - index);
    const end = startOfDay(addDays(start, 7));
    const count = projects.filter((project) => {
      const began = parseISO(project.startAt ?? project.createdAt);
      if (began > end) return false;
      if (project.status === "completed" || project.status === "cancelled") {
        return parseISO(project.updatedAt) > end;
      }
      return true;
    }).length;
    return { start, count };
  });
}
