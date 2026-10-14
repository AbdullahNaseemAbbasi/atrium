import "server-only";
import { format, parseISO } from "date-fns";
import { requireTeamContext } from "@/lib/auth/context";
import { formatRelative } from "@/lib/utils";
import { getDb } from "../store";
import { newestFirst, paginate } from "../views";
import type { Notification } from "../types";
import { groupByDay } from "./activity";

export interface NotificationRow {
  id: string;
  type: Notification["type"];
  title: string;
  body: string;
  href: string;
  unread: boolean;
  when: string;
  time: string;
  createdAt: string;
}

const PAGE_SIZE = 20;

const NOTIFICATION_GROUPS = [
  { key: "reviews", label: "Client reviews", types: ["deliverable."] },
  { key: "comments", label: "Comments & mentions", types: ["comment."] },
  { key: "tasks", label: "Tasks & milestones", types: ["task.", "milestone."] },
  { key: "account", label: "Team & billing", types: ["invitation.", "billing."] },
] as const;

/** The signed-in user's notifications in this workspace only, never anyone else's. */
export async function getNotificationsPage(orgSlug: string, query: { filter?: string; page?: string }) {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  const now = new Date();
  const filter: "all" | "unread" = query.filter === "unread" ? "unread" : "all";

  const mine = newestFirst(db.notifications.filter((item) => item.recipientUserId === ctx.user.id && item.organizationId === ctx.org.id));
  const unread = mine.filter((item) => !item.readAt).length;
  const list = filter === "unread" ? mine.filter((item) => !item.readAt) : mine;
  const page = paginate(list, Number(query.page) || 1, PAGE_SIZE);
  const rows: NotificationRow[] = page.items.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    // Links are stored by the server; only same-site paths are rendered.
    href: item.href.startsWith("/") && !item.href.startsWith("//") ? item.href : `/w/${ctx.org.slug}`,
    unread: !item.readAt,
    when: formatRelative(item.createdAt, now),
    time: format(parseISO(item.createdAt), "MMM d, yyyy · HH:mm"),
    createdAt: item.createdAt,
  }));

  const byGroup = NOTIFICATION_GROUPS.map((group) => {
    const items = mine.filter((item) => group.types.some((prefix) => item.type.startsWith(prefix)));
    return { key: group.key, label: group.label, total: items.length, unread: items.filter((item) => !item.readAt).length };
  });

  return {
    base: `/w/${ctx.org.slug}`,
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    filter,
    counts: { all: mine.length, unread },
    byGroup,
    groups: groupByDay(rows, now),
    pagination: { page: page.page, pageCount: page.pageCount, total: page.total, pageSize: page.pageSize },
  };
}
