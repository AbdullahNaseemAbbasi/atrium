import "server-only";
import { notFound } from "next/navigation";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { checkLimit, getPlan } from "@/lib/billing/plans";
import { isProjectActive } from "@/lib/domain/rules";
import { CLIENT_STATUS } from "@/lib/domain/labels";
import { formatRelative } from "@/lib/utils";
import { visibleActivity, visibleProjects, type TeamContext } from "../access";
import { getDb } from "../store";
import { newestFirst, summarizeProject, toActivityView, toUserLite, type ActivityView, type ProjectSummary, type UserLite } from "../views";
import type { Client, ClientRole, ClientStatus, Database, Invitation, MembershipStatus } from "../types";

/* ---------- Shared helpers ---------- */

export const CLIENT_STATUS_ORDER: ClientStatus[] = ["active", "onboarding", "paused", "archived"];

export const INDUSTRY_SUGGESTIONS = [
  "B2B software",
  "Consumer goods",
  "E-commerce",
  "Education",
  "Financial services",
  "Healthcare",
  "Hospitality",
  "Marketing services",
  "Non-profit",
  "Real estate",
];

/** Clients that count toward the plan limit: everything except archived. */
export function countedClients(db: Database, orgId: string) {
  return db.clients.filter((client) => client.organizationId === orgId && client.status !== "archived").length;
}

export function clientUsage(db: Database, ctx: TeamContext) {
  const subscription = db.subscriptions.find((item) => item.organizationId === ctx.org.id);
  const plan = getPlan(subscription?.planKey ?? "starter");
  return { planName: plan.name, limit: checkLimit(plan, "clients", countedClients(db, ctx.org.id)) };
}

/** An invitation is effectively expired once its date passes, even if the job that flips the status hasn't run. */
export function invitationState(invitation: Invitation, now: Date): Invitation["status"] {
  if (invitation.status === "pending" && Date.parse(invitation.expiresAt) <= now.getTime()) return "expired";
  return invitation.status;
}

function loadClientsContext(ctx: TeamContext) {
  if (!can(ctx.role, "clients.view")) notFound();
}

/* ---------- List ---------- */

export interface ClientListRow {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  industry: string;
  website?: string;
  status: ClientStatus;
  brandHue: number;
  activeProjects: number;
  totalProjects: number;
  portalUsers: number;
  pendingInvites: number;
  createdAt: string;
  addedText: string;
}

export async function listClients(orgSlug: string, query: { q?: string; status?: string }) {
  const ctx = await requireTeamContext(orgSlug);
  loadClientsContext(ctx);
  const db = await getDb();
  const now = new Date();
  const projects = visibleProjects(db, ctx);
  const all = db.clients.filter((client) => client.organizationId === ctx.org.id);

  const status = query.status && query.status in CLIENT_STATUS ? (query.status as ClientStatus) : "all";
  const q = query.q?.trim().toLowerCase() ?? "";

  let rows = all.map((client): ClientListRow => {
    const clientProjects = projects.filter((project) => project.clientId === client.id);
    return {
      id: client.id,
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email,
      industry: client.industry,
      website: client.website,
      status: client.status,
      brandHue: client.brandHue,
      activeProjects: clientProjects.filter((project) => isProjectActive(project)).length,
      totalProjects: clientProjects.length,
      portalUsers: db.clientMemberships.filter((item) => item.clientId === client.id && item.status === "active").length,
      pendingInvites: db.invitations.filter(
        (item) => item.kind === "client" && item.clientId === client.id && invitationState(item, now) === "pending",
      ).length,
      createdAt: client.createdAt,
      addedText: formatRelative(client.createdAt, now),
    };
  });

  if (q) {
    rows = rows.filter(
      (row) =>
        row.companyName.toLowerCase().includes(q) ||
        row.contactName.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.industry.toLowerCase().includes(q),
    );
  }
  const beforeStatus = rows;
  if (status !== "all") rows = rows.filter((row) => row.status === status);
  rows.sort(
    (a, b) => CLIENT_STATUS_ORDER.indexOf(a.status) - CLIENT_STATUS_ORDER.indexOf(b.status) || a.companyName.localeCompare(b.companyName),
  );

  const counts: Record<string, number> = { all: beforeStatus.length };
  for (const key of CLIENT_STATUS_ORDER) counts[key] = beforeStatus.filter((row) => row.status === key).length;

  return {
    base: `/w/${ctx.org.slug}`,
    rows,
    counts,
    totalClients: all.length,
    filters: { q: query.q ?? "", status },
    canManage: can(ctx.role, "clients.manage"),
    projectsNote: can(ctx.role, "projects.view_all") ? null : "Project counts include only the projects you're on.",
    ...clientUsage(db, ctx),
  };
}

/* ---------- Detail ---------- */

export interface PortalUserRow {
  membershipId: string;
  user: UserLite;
  role: ClientRole;
  status: MembershipStatus;
  joinedAt: string;
  lastActiveText: string;
}

export interface ClientInvitationRow {
  id: string;
  email: string;
  role: ClientRole;
  status: Invitation["status"];
  invitedBy: string;
  sentText: string;
  expiresAt: string;
  expiresText: string;
}

export type ClientActivityItem = ActivityView & { when: string; visibility: "internal" | "client" };

async function loadClient(orgSlug: string, clientId: string) {
  const ctx = await requireTeamContext(orgSlug);
  loadClientsContext(ctx);
  const db = await getDb();
  // Out-of-tenant and unknown ids look exactly the same: a 404.
  const client = db.clients.find((item) => item.id === clientId && item.organizationId === ctx.org.id);
  if (!client) notFound();
  return { ctx, db, client };
}

export async function getClientDetail(orgSlug: string, clientId: string) {
  const { ctx, db, client } = await loadClient(orgSlug, clientId);
  const now = new Date();
  const base = `/w/${ctx.org.slug}`;

  const projects: ProjectSummary[] = visibleProjects(db, ctx)
    .filter((project) => project.clientId === client.id)
    .sort((a, b) => Number(isProjectActive(b)) - Number(isProjectActive(a)) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map((project) => summarizeProject(db, project, now));
  const projectIds = new Set(projects.map((project) => project.id));

  const portalUsers: PortalUserRow[] = db.clientMemberships
    .filter((item) => item.clientId === client.id && item.organizationId === ctx.org.id)
    .map((item) => {
      const user = db.users.find((row) => row.id === item.userId);
      return user
        ? {
            membershipId: item.id,
            user: toUserLite(user),
            role: item.role,
            status: item.status,
            joinedAt: item.joinedAt,
            lastActiveText: user.lastActiveAt ? formatRelative(user.lastActiveAt, now) : "Never signed in",
          }
        : null;
    })
    .filter((row): row is PortalUserRow => row !== null)
    .sort(
      (a, b) =>
        Number(a.status !== "active") - Number(b.status !== "active") ||
        Number(a.role !== "approver") - Number(b.role !== "approver") ||
        a.user.name.localeCompare(b.user.name),
    );

  const invitations: ClientInvitationRow[] = newestFirst(
    db.invitations.filter((item) => item.kind === "client" && item.clientId === client.id && item.organizationId === ctx.org.id),
  )
    .map((item) => ({ item, state: invitationState(item, now) }))
    .filter(({ state }) => state === "pending" || state === "expired")
    .map(({ item, state }) => ({
      id: item.id,
      email: item.email,
      role: item.role as ClientRole,
      status: state,
      invitedBy: db.users.find((user) => user.id === item.invitedByUserId)?.name ?? "Someone",
      sentText: formatRelative(item.createdAt, now),
      expiresAt: item.expiresAt,
      expiresText: formatRelative(item.expiresAt, now),
    }));

  const activity: ClientActivityItem[] = newestFirst(
    visibleActivity(
      db,
      ctx,
      db.activity.filter(
        (event) => (event.targetType === "client" && event.targetId === client.id) || (event.projectId !== undefined && projectIds.has(event.projectId)),
      ),
    ),
  )
    .slice(0, 40)
    .map((event) => ({ ...toActivityView(db, event, base), when: formatRelative(event.createdAt, now), visibility: event.visibility }));

  const pendingApprovals = db.deliverables.filter((item) => projectIds.has(item.projectId) && item.status === "in_review").length;

  return {
    base,
    orgSlug: ctx.org.slug,
    client: {
      id: client.id,
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email,
      phone: client.phone,
      website: client.website,
      industry: client.industry,
      status: client.status,
      brandHue: client.brandHue,
      notes: client.notes,
      createdAt: client.createdAt,
      addedText: formatRelative(client.createdAt, now),
    },
    projects,
    portalUsers,
    invitations,
    activity,
    stats: {
      activeProjects: projects.filter((project) => isProjectActive(project)).length,
      sharedProjects: projects.filter((project) => project.sharedWithClient).length,
      pendingApprovals,
      activePortalUsers: portalUsers.filter((row) => row.status === "active").length,
    },
    can: {
      manage: can(ctx.role, "clients.manage"),
      manageAccess: can(ctx.role, "clients.manage_access"),
      createProject: can(ctx.role, "projects.create"),
    },
    projectsNote: can(ctx.role, "projects.view_all") ? null : "Only the projects you're on are listed.",
  };
}

export type ClientDetail = Awaited<ReturnType<typeof getClientDetail>>;

/* ---------- Forms ---------- */

function industryOptions(db: Database, orgId: string) {
  const used = db.clients.filter((client) => client.organizationId === orgId).map((client) => client.industry);
  return [...new Set([...used, ...INDUSTRY_SUGGESTIONS])].sort((a, b) => a.localeCompare(b));
}

export async function getNewClientForm(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "clients.manage")) notFound();
  const db = await getDb();
  return {
    base: `/w/${ctx.org.slug}`,
    orgSlug: ctx.org.slug,
    industries: industryOptions(db, ctx.org.id),
    ...clientUsage(db, ctx),
  };
}

export interface ClientFormDefaults {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  status?: ClientStatus;
  brandHue?: number;
  notes?: string;
}

export async function getEditClientForm(orgSlug: string, clientId: string) {
  const { ctx, db, client } = await loadClient(orgSlug, clientId);
  if (!can(ctx.role, "clients.manage")) notFound();
  const defaults: ClientFormDefaults = pickDefaults(client);
  return {
    base: `/w/${ctx.org.slug}`,
    orgSlug: ctx.org.slug,
    clientId: client.id,
    companyName: client.companyName,
    defaults,
    industries: industryOptions(db, ctx.org.id),
    activePortalUsers: db.clientMemberships.filter((item) => item.clientId === client.id && item.status === "active").length,
    ...clientUsage(db, ctx),
  };
}

function pickDefaults(client: Client): ClientFormDefaults {
  return {
    companyName: client.companyName,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    website: client.website,
    industry: client.industry,
    status: client.status,
    brandHue: client.brandHue,
    notes: client.notes,
  };
}
