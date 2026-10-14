import { can, clientCan } from "@/lib/auth/permissions";
import type {
  ActivityEvent,
  Client,
  ClientMembership,
  ClientRole,
  Comment,
  Database,
  Deliverable,
  ID,
  Membership,
  Organization,
  OrgRole,
  Project,
  ProjectFile,
  Task,
  User,
} from "./types";

/**
 * Tenant and resource-level access rules.
 *
 * Everything here is a pure function of (database, actor) so it can be unit
 * tested without a request. The Supabase version enforces the same rules in
 * row-level security policies; these functions stay as the application-level
 * check that runs before every query and mutation.
 */

export interface TeamContext {
  kind: "team";
  user: User;
  org: Organization;
  membership: Membership;
  role: OrgRole;
}

export interface ClientContext {
  kind: "client";
  user: User;
  org: Organization;
  client: Client;
  clientMembership: ClientMembership;
  role: ClientRole;
}

export type AccessContext = TeamContext | ClientContext;

export function findOrgBySlug(db: Database, slug: string) {
  return db.organizations.find((org) => org.slug === slug) ?? null;
}

/** The active organization always comes from a verified membership, never from request input alone. */
export function resolveTeamContext(db: Database, userId: ID, orgSlug: string): TeamContext | null {
  const user = db.users.find((item) => item.id === userId);
  const org = findOrgBySlug(db, orgSlug);
  if (!user || !org) return null;
  const membership = db.memberships.find(
    (item) => item.organizationId === org.id && item.userId === userId && item.status === "active",
  );
  if (!membership) return null;
  return { kind: "team", user, org, membership, role: membership.role };
}

export function resolveClientContext(db: Database, userId: ID, orgSlug: string): ClientContext | null {
  const user = db.users.find((item) => item.id === userId);
  const org = findOrgBySlug(db, orgSlug);
  if (!user || !org) return null;
  const clientMembership = db.clientMemberships.find(
    (item) => item.organizationId === org.id && item.userId === userId && item.status === "active",
  );
  if (!clientMembership) return null;
  const client = db.clients.find(
    (item) => item.id === clientMembership.clientId && item.organizationId === org.id && item.status !== "archived",
  );
  if (!client) return null;
  return { kind: "client", user, org, client, clientMembership, role: clientMembership.role };
}

export function teamWorkspacesFor(db: Database, userId: ID) {
  return db.memberships
    .filter((item) => item.userId === userId && item.status === "active")
    .map((membership) => ({
      membership,
      org: db.organizations.find((org) => org.id === membership.organizationId)!,
    }))
    .filter((item) => Boolean(item.org));
}

export function clientPortalsFor(db: Database, userId: ID) {
  return db.clientMemberships
    .filter((item) => item.userId === userId && item.status === "active")
    .map((clientMembership) => ({
      clientMembership,
      org: db.organizations.find((org) => org.id === clientMembership.organizationId)!,
      client: db.clients.find((client) => client.id === clientMembership.clientId)!,
    }))
    .filter((item) => Boolean(item.org && item.client) && item.client.status !== "archived");
}

/* ---------- Projects ---------- */

export function isProjectMember(db: Database, projectId: ID, userId: ID) {
  return db.projectMembers.some((item) => item.projectId === projectId && item.userId === userId);
}

export function isProjectLead(db: Database, projectId: ID, userId: ID) {
  return db.projectMembers.some(
    (item) => item.projectId === projectId && item.userId === userId && item.projectRole === "lead",
  );
}

export function canViewProject(db: Database, ctx: AccessContext, project: Project) {
  if (project.organizationId !== ctx.org.id) return false;
  if (ctx.kind === "client") {
    return clientCan(ctx.role, "portal.view") && project.sharedWithClient && project.clientId === ctx.client.id;
  }
  if (can(ctx.role, "projects.view_all")) return true;
  if (can(ctx.role, "projects.view_assigned")) return isProjectMember(db, project.id, ctx.user.id);
  return false;
}

export function visibleProjects(db: Database, ctx: AccessContext) {
  return db.projects.filter((project) => canViewProject(db, ctx, project));
}

/** Returns the project only when the actor may see it; otherwise null (rendered as 404). */
export function getVisibleProject(db: Database, ctx: AccessContext, projectId: ID) {
  const project = db.projects.find((item) => item.id === projectId);
  if (!project || !canViewProject(db, ctx, project)) return null;
  return project;
}

/** Owners and managers can edit any project; a project lead can edit their own. */
export function canManageProject(db: Database, ctx: AccessContext, project: Project) {
  if (ctx.kind !== "team" || project.organizationId !== ctx.org.id) return false;
  if (can(ctx.role, "projects.update")) return true;
  return isProjectLead(db, project.id, ctx.user.id);
}

/** Team members who can see the project can work on its tasks and uploads. */
export function canWorkOnProject(db: Database, ctx: AccessContext, project: Project) {
  return ctx.kind === "team" && can(ctx.role, "tasks.manage") && canViewProject(db, ctx, project);
}

/** Submitting work to the client is a lead/manager decision. */
export function canSubmitDeliverable(db: Database, ctx: AccessContext, project: Project) {
  if (ctx.kind !== "team" || !canViewProject(db, ctx, project)) return false;
  return can(ctx.role, "deliverables.submit") || isProjectLead(db, project.id, ctx.user.id);
}

/* ---------- Records inside a project ---------- */

export function visibleTasks(db: Database, ctx: AccessContext, tasks: Task[]) {
  return tasks.filter((task) => {
    const project = db.projects.find((item) => item.id === task.projectId);
    if (!project || !canViewProject(db, ctx, project)) return false;
    return ctx.kind === "team" || task.clientVisible;
  });
}

/** Clients never see drafts: a deliverable reaches the portal when it is submitted. */
export function canViewDeliverable(db: Database, ctx: AccessContext, deliverable: Deliverable) {
  const project = db.projects.find((item) => item.id === deliverable.projectId);
  if (!project || !canViewProject(db, ctx, project)) return false;
  if (ctx.kind === "client") return deliverable.status !== "draft" || Boolean(deliverable.submittedAt);
  return true;
}

export function getVisibleDeliverable(db: Database, ctx: AccessContext, deliverableId: ID) {
  const deliverable = db.deliverables.find((item) => item.id === deliverableId);
  if (!deliverable || !canViewDeliverable(db, ctx, deliverable)) return null;
  return deliverable;
}

export function visibleComments(ctx: AccessContext, comments: Comment[]) {
  return ctx.kind === "team" ? comments : comments.filter((item) => item.visibility === "client");
}

export function visibleFiles(ctx: AccessContext, files: ProjectFile[]) {
  return ctx.kind === "team" ? files : files.filter((item) => item.visibility === "client");
}

export function visibleActivity(db: Database, ctx: AccessContext, events: ActivityEvent[]) {
  return events.filter((event) => {
    if (event.organizationId !== ctx.org.id) return false;
    if (event.projectId) {
      const project = db.projects.find((item) => item.id === event.projectId);
      if (!project || !canViewProject(db, ctx, project)) return false;
    } else if (ctx.kind === "client" || !can(ctx.role, "team.view")) {
      return false;
    }
    return ctx.kind === "team" || event.visibility === "client";
  });
}

/** Only the client approver of the project's client can decide, and only on a submitted version. */
export function canDecideOnDeliverable(db: Database, ctx: AccessContext, deliverable: Deliverable) {
  if (ctx.kind !== "client" || !clientCan(ctx.role, "portal.approve")) return false;
  if (!canViewDeliverable(db, ctx, deliverable)) return false;
  return deliverable.status === "in_review";
}
