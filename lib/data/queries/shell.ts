import "server-only";
import { getCurrentUser, requireClientContext, requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { formatRelative } from "@/lib/utils";
import { usesSupabase } from "@/lib/supabase/config";
import {
  clientPortalsFor,
  teamWorkspacesFor,
  visibleProjects,
  getVisibleDeliverable,
} from "../access";
import { getDb } from "../store";
import { newestFirst, toUserLite, type UserLite } from "../views";
import type { Notification, OrgRole } from "../types";

export type NavKey =
  | "dashboard"
  | "projects"
  | "tasks"
  | "clients"
  | "approvals"
  | "team"
  | "reports"
  | "billing"
  | "settings";

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  href: string;
  type: Notification["type"];
  unread: boolean;
  when: string;
}

export interface SearchEntry {
  kind: "project" | "client" | "deliverable" | "task" | "page";
  label: string;
  sub?: string;
  href: string;
}

export interface SwitcherEntry {
  name: string;
  slug: string;
  hue: number;
  role: string;
  href: string;
  kind: "team" | "client";
}

function navFor(role: OrgRole, base: string): NavItem[] {
  const items: NavItem[] = [{ key: "dashboard", label: "Dashboard", href: base }];
  if (can(role, "projects.view_assigned")) {
    items.push({ key: "projects", label: "Projects", href: `${base}/projects` });
    items.push({ key: "tasks", label: "Tasks", href: `${base}/tasks` });
  }
  if (can(role, "clients.view")) items.push({ key: "clients", label: "Clients", href: `${base}/clients` });
  if (can(role, "projects.view_assigned")) items.push({ key: "approvals", label: "Approvals", href: `${base}/approvals` });
  if (can(role, "team.view")) items.push({ key: "team", label: "Team", href: `${base}/team` });
  if (can(role, "reports.view")) items.push({ key: "reports", label: "Reports", href: `${base}/reports` });
  if (role === "billing") items.push({ key: "billing", label: "Billing", href: `${base}/billing` });
  return items;
}

async function switcherFor(userId: string): Promise<SwitcherEntry[]> {
  const db = await getDb();
  const teams = teamWorkspacesFor(db, userId).map(({ org, membership }) => ({
    name: org.name,
    slug: org.slug,
    hue: org.brandHue,
    role: membership.role,
    href: `/w/${org.slug}`,
    kind: "team" as const,
  }));
  const portals = clientPortalsFor(db, userId).map(({ org, client, clientMembership }) => ({
    name: `${client.companyName} portal`,
    slug: org.slug,
    hue: client.brandHue,
    role: clientMembership.role,
    href: `/portal/${org.slug}`,
    kind: "client" as const,
  }));
  return [...teams, ...portals];
}

async function notificationItems(userId: string, orgId: string, now: Date, limit: number) {
  const db = await getDb();
  const mine = newestFirst(db.notifications.filter((item) => item.recipientUserId === userId && item.organizationId === orgId));
  return {
    unread: mine.filter((item) => !item.readAt).length,
    items: mine.slice(0, limit).map(
      (item): NotificationItem => ({
        id: item.id,
        title: item.title,
        body: item.body,
        href: item.href,
        type: item.type,
        unread: !item.readAt,
        when: formatRelative(item.createdAt, now),
      }),
    ),
  };
}

export interface WorkspaceShell {
  user: UserLite;
  role: OrgRole;
  org: { id: string; name: string; slug: string; hue: number };
  base: string;
  live: boolean;
  nav: NavItem[];
  switcher: SwitcherEntry[];
  notifications: { unread: number; items: NotificationItem[] };
  search: SearchEntry[];
  can: { settings: boolean; billing: boolean; team: boolean; createProject: boolean };
  isPlatformAdmin: boolean;
}

export async function getWorkspaceShell(orgSlug: string): Promise<WorkspaceShell> {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const now = new Date();
  const base = `/w/${ctx.org.slug}`;

  const projects = visibleProjects(db, ctx);
  const projectIds = new Set(projects.map((project) => project.id));
  const search: SearchEntry[] = [
    ...projects.map((project) => ({
      kind: "project" as const,
      label: project.name,
      sub: db.clients.find((client) => client.id === project.clientId)?.companyName ?? "Internal",
      href: `${base}/projects/${project.id}`,
    })),
    ...(can(ctx.role, "clients.view")
      ? db.clients
          .filter((client) => client.organizationId === ctx.org.id)
          .map((client) => ({ kind: "client" as const, label: client.companyName, sub: client.contactName, href: `${base}/clients/${client.id}` }))
      : []),
    ...db.deliverables
      .filter((item) => projectIds.has(item.projectId) && getVisibleDeliverable(db, ctx, item.id))
      .map((item) => ({
        kind: "deliverable" as const,
        label: item.title,
        sub: projects.find((project) => project.id === item.projectId)?.name,
        href: `${base}/projects/${item.projectId}/deliverables/${item.id}`,
      })),
    ...db.tasks
      .filter((task) => projectIds.has(task.projectId) && task.status !== "done")
      .map((task) => ({
        kind: "task" as const,
        label: task.title,
        sub: projects.find((project) => project.id === task.projectId)?.name,
        href: `${base}/projects/${task.projectId}/tasks?task=${task.id}`,
      })),
    ...navFor(ctx.role, base).map((item) => ({ kind: "page" as const, label: item.label, href: item.href })),
    { kind: "page" as const, label: "Notifications", href: `${base}/notifications` },
    { kind: "page" as const, label: "My profile", href: `${base}/settings/profile` },
  ];

  return {
    user: toUserLite(ctx.user),
    role: ctx.role,
    org: { id: ctx.org.id, name: ctx.org.name, slug: ctx.org.slug, hue: ctx.org.brandHue },
    base,
    /** Supabase Realtime is on (off in memory mode). */
    live: usesSupabase(),
    nav: navFor(ctx.role, base),
    switcher: await switcherFor(ctx.user.id),
    notifications: await notificationItems(ctx.user.id, ctx.org.id, now, 6),
    search,
    can: {
      settings: can(ctx.role, "workspace.update") || can(ctx.role, "audit.view"),
      billing: can(ctx.role, "billing.view"),
      team: can(ctx.role, "team.view"),
      createProject: can(ctx.role, "projects.create"),
    },
    isPlatformAdmin: Boolean(ctx.user.isPlatformAdmin),
  };
}

export interface PortalShell {
  user: UserLite;
  role: "approver" | "viewer";
  org: { id: string; name: string; slug: string; hue: number };
  client: { id: string; name: string; hue: number };
  base: string;
  live: boolean;
  switcher: SwitcherEntry[];
  notifications: { unread: number; items: NotificationItem[] };
  pendingReviews: number;
}

export async function getPortalShell(orgSlug: string): Promise<PortalShell> {
  const ctx = await requireClientContext(orgSlug);
  const db = await getDb();
  const now = new Date();
  const projects = visibleProjects(db, ctx);
  const projectIds = new Set(projects.map((project) => project.id));
  return {
    user: toUserLite(ctx.user),
    role: ctx.role,
    org: { id: ctx.org.id, name: ctx.org.name, slug: ctx.org.slug, hue: ctx.org.brandHue },
    client: { id: ctx.client.id, name: ctx.client.companyName, hue: ctx.client.brandHue },
    base: `/portal/${ctx.org.slug}`,
    live: usesSupabase(),
    switcher: await switcherFor(ctx.user.id),
    notifications: await notificationItems(ctx.user.id, ctx.org.id, now, 6),
    pendingReviews: db.deliverables.filter((item) => projectIds.has(item.projectId) && item.status === "in_review").length,
  };
}

/** Minimal identity for public pages (marketing header shows "Open app" when signed in). */
export async function getOptionalViewer() {
  const user = await getCurrentUser();
  if (!user) return null;
  const switcher = await switcherFor(user.id);
  return { name: user.name, home: switcher[0]?.href ?? (user.isPlatformAdmin ? "/admin" : "/onboarding") };
}
