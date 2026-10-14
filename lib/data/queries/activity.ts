import "server-only";
import { notFound } from "next/navigation";
import { format, isSameYear, isToday, isYesterday, parseISO } from "date-fns";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { formatRelative } from "@/lib/utils";
import { visibleActivity, visibleProjects } from "../access";
import { getDb } from "../store";
import { newestFirst, paginate, toActivityView } from "../views";
import type { ActivityVerb } from "../types";
import type { ActivityRowItem } from "@/components/activity/activity-row";

export const ACTIVITY_TYPES: Record<string, { label: string; verbs: ActivityVerb[] }> = {
  reviews: { label: "Reviews", verbs: ["deliverable.uploaded", "deliverable.submitted", "deliverable.approved", "deliverable.changes_requested"] },
  tasks: { label: "Tasks", verbs: ["task.created", "task.completed"] },
  comments: { label: "Comments", verbs: ["comment.posted"] },
  projects: { label: "Projects & milestones", verbs: ["project.created", "project.status_changed", "milestone.completed"] },
  files: { label: "Files", verbs: ["file.uploaded"] },
  people: { label: "Team & clients", verbs: ["member.invited", "client.added"] },
};

const PAGE_SIZE = 25;

/** "Today", "Yesterday", "Monday, October 12" (year added when it isn't this year). */
export function dayLabel(iso: string, now: Date) {
  const date = parseISO(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, isSameYear(date, now) ? "EEEE, MMMM d" : "EEEE, MMMM d, yyyy");
}

export function groupByDay<T extends { createdAt: string }>(items: T[], now: Date) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = format(parseISO(item.createdAt), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(item.createdAt, now), items: [item] });
  }
  return groups;
}

export async function getActivityLog(orgSlug: string, query: { project?: string; type?: string; page?: string }) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "projects.view_assigned")) notFound();
  const db = getDb();
  const now = new Date();
  const base = `/w/${ctx.org.slug}`;

  const projects = visibleProjects(db, ctx);
  const projectIds = new Set(projects.map((project) => project.id));
  const all = newestFirst(visibleActivity(db, ctx, db.activity));
  const hasWorkspaceEvents = all.some((event) => !event.projectId);

  const project = query.project === "workspace" && hasWorkspaceEvents ? "workspace" : query.project && projectIds.has(query.project) ? query.project : "";
  const type = query.type && query.type in ACTIVITY_TYPES ? query.type : "";

  let events = all;
  if (project === "workspace") events = events.filter((event) => !event.projectId);
  else if (project) events = events.filter((event) => event.projectId === project);
  const beforeType = events;
  if (type) events = events.filter((event) => ACTIVITY_TYPES[type].verbs.includes(event.verb));

  const typeCounts: Record<string, number> = { all: beforeType.length };
  for (const [key, meta] of Object.entries(ACTIVITY_TYPES)) typeCounts[key] = beforeType.filter((event) => meta.verbs.includes(event.verb)).length;

  const page = paginate(events, Number(query.page) || 1, PAGE_SIZE);
  const items: ActivityRowItem[] = page.items.map((event) => ({
    ...toActivityView(db, event, base),
    when: formatRelative(event.createdAt, now),
    time: format(parseISO(event.createdAt), "MMM d, yyyy · HH:mm"),
    visibility: event.visibility,
  }));

  return {
    base,
    filters: { project, type },
    typeCounts,
    totalVisible: all.length,
    pagination: { page: page.page, pageCount: page.pageCount, total: page.total, pageSize: page.pageSize },
    groups: groupByDay(items, now),
    projects: [...projects].sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({ id: item.id, name: item.name })),
    hasWorkspaceEvents,
    scopeNote: can(ctx.role, "projects.view_all") ? null : "You see activity on the projects you're assigned to.",
  };
}
