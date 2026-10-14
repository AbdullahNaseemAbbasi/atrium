import { addDays, addWeeks, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import type { Approval, Deliverable, DeliverableVersion, Project, Task } from "@/lib/data/types";
import { ACTIVE_PROJECT_STATUSES } from "./rules";

/**
 * Point-in-time KPI reconstruction. Each metric is defined once and can be
 * evaluated "as of" any moment, which gives us honest deltas ("vs 30 days
 * ago") and weekly trend lines from the same formula as today's number.
 * Formulas are documented in docs/business-rules.md.
 */

const ms = (value: string) => parseISO(value).getTime();

/**
 * Active = started on or before `at` and in planning, in progress or in
 * review. A project that is now on hold, completed or cancelled counts as
 * active until its last status change (`updatedAt`).
 */
export function activeProjectsAt(projects: Project[], at: Date) {
  const t = at.getTime();
  return projects.filter((project) => {
    if (ms(project.startAt ?? project.createdAt) > t) return false;
    if (ACTIVE_PROJECT_STATUSES.includes(project.status)) return true;
    return ms(project.updatedAt) > t;
  }).length;
}

function openAt(task: Task, t: number) {
  if (ms(task.createdAt) > t) return false;
  return !task.completedAt || ms(task.completedAt) > t;
}

/** Due soon = open at `at` and due within the next 7 calendar days (inclusive). */
export function tasksDueSoonAt(tasks: Task[], at: Date, days = 7) {
  const t = at.getTime();
  return tasks.filter((task) => {
    if (!task.dueAt || !openAt(task, t)) return false;
    const diff = differenceInCalendarDays(parseISO(task.dueAt), at);
    return diff >= 0 && diff <= days;
  }).length;
}

/** Overdue = open at `at` and due on an earlier calendar day. */
export function overdueTasksAt(tasks: Task[], at: Date) {
  const t = at.getTime();
  return tasks.filter((task) => task.dueAt && openAt(task, t) && differenceInCalendarDays(parseISO(task.dueAt), at) < 0).length;
}

interface ReviewWindow {
  deliverableId: string;
  start: number;
  end: number | null;
}

/**
 * A version is "waiting for the client" from the moment it was submitted
 * until a decision on that version or a newer upload replaces it.
 */
export function reviewWindows(deliverables: Deliverable[], versions: DeliverableVersion[], approvals: Approval[]) {
  const windows: ReviewWindow[] = [];
  for (const deliverable of deliverables) {
    const own = versions.filter((item) => item.deliverableId === deliverable.id).sort((a, b) => a.version - b.version);
    for (const version of own) {
      const isCurrent = version.version === deliverable.currentVersion;
      if (isCurrent && deliverable.status === "draft") continue;
      const decision = approvals.find((item) => item.deliverableId === deliverable.id && item.version === version.version);
      const next = own.find((item) => item.version === version.version + 1);
      const start = isCurrent && deliverable.submittedAt ? ms(deliverable.submittedAt) : ms(version.createdAt);
      let end: number | null;
      if (decision) end = ms(decision.decidedAt);
      else if (next) end = ms(next.createdAt);
      else end = isCurrent && deliverable.status === "in_review" ? null : start;
      windows.push({ deliverableId: deliverable.id, start, end });
    }
  }
  return windows;
}

export function pendingApprovalsAt(windows: ReviewWindow[], at: Date) {
  const t = at.getTime();
  const ids = new Set(windows.filter((item) => item.start <= t && (item.end === null || item.end > t)).map((item) => item.deliverableId));
  return ids.size;
}

/** Evaluation points for a weekly trend: the end of each of the last `weeks` weeks, ending at `now`. */
export function weeklyCheckpoints(now: Date, weeks = 12) {
  const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = addWeeks(currentWeek, index - (weeks - 1));
    const end = index === weeks - 1 ? now : addDays(weekStart, 7);
    return { at: end, label: index === weeks - 1 ? "This week" : `Week of ${format(weekStart, "MMM d")}` };
  });
}

export function series(now: Date, evaluate: (at: Date) => number, weeks = 12) {
  return weeklyCheckpoints(now, weeks).map((point) => ({ label: point.label, value: evaluate(point.at) }));
}
