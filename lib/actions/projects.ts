"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { checkLimit, getPlan } from "@/lib/billing/plans";
import { isProjectActive } from "@/lib/domain/rules";
import { canManageProject, getVisibleProject } from "@/lib/data/access";
import { clientAudience, notify, recordActivity, recordAudit } from "@/lib/data/events";
import { getDb, newId } from "@/lib/data/store";
import type { ProjectStatus } from "@/lib/data/types";
import { projectSchema } from "@/lib/validation/schemas";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

function parseProjectForm(formData: FormData) {
  return projectSchema.safeParse({
    ...Object.fromEntries(formData),
    memberIds: formData.getAll("memberIds").map(String),
  });
}

export async function createProject(orgSlug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "projects.create")) return fail("You don't have permission to create projects.");

  const parsed = parseProjectForm(formData);
  if (!parsed.success) return invalid(parsed.error, formValues(formData));
  const input = parsed.data;

  const db = getDb();
  // Every referenced record must belong to this workspace.
  if (input.clientId && !db.clients.some((client) => client.id === input.clientId && client.organizationId === ctx.org.id)) {
    return fail("That client doesn't exist in this workspace.", { clientId: ["Choose a client from the list."] }, formValues(formData));
  }
  const teamIds = new Set(
    db.memberships.filter((item) => item.organizationId === ctx.org.id && item.status === "active" && item.role !== "billing").map((item) => item.userId),
  );
  if (!teamIds.has(input.leadId)) return fail("Choose a lead from your team.", { leadId: ["Choose a lead from your team."] }, formValues(formData));

  // Plan limits are enforced here, not just in the UI.
  const subscription = db.subscriptions.find((item) => item.organizationId === ctx.org.id);
  const plan = getPlan(subscription?.planKey ?? "starter");
  const activeCount = db.projects.filter((item) => item.organizationId === ctx.org.id && isProjectActive(item)).length;
  if (isProjectActive({ status: input.status }) && !checkLimit(plan, "projects", activeCount).allowed) {
    return fail(`Your ${plan.name} plan allows ${plan.limits.projects} active projects. Upgrade or complete a project first.`, undefined, formValues(formData));
  }

  const now = new Date().toISOString();
  const id = newId("prj");
  db.projects.push({
    id,
    organizationId: ctx.org.id,
    clientId: input.clientId,
    name: input.name,
    description: input.description,
    status: input.status,
    icon: input.icon,
    startAt: input.startAt ? new Date(input.startAt).toISOString() : undefined,
    dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : undefined,
    sharedWithClient: input.sharedWithClient,
    budgetCents: input.budget !== undefined ? Math.round(input.budget * 100) : undefined,
    createdByUserId: ctx.user.id,
    createdAt: now,
    updatedAt: now,
  });
  db.projectMembers.push({ id: newId("pm"), organizationId: ctx.org.id, projectId: id, userId: input.leadId, projectRole: "lead" });
  for (const userId of new Set(input.memberIds)) {
    if (userId !== input.leadId && teamIds.has(userId)) {
      db.projectMembers.push({ id: newId("pm"), organizationId: ctx.org.id, projectId: id, userId, projectRole: "contributor" });
    }
  }

  recordAudit(db, ctx, { action: "project.created", entityType: "project", entityId: id, summary: `Created project ${input.name}` });
  if (input.sharedWithClient) {
    recordAudit(db, ctx, { action: "project.shared", entityType: "project", entityId: id, summary: `Shared ${input.name} with the client` });
  }
  recordActivity(db, ctx, { projectId: id, verb: "project.created", targetType: "project", targetId: id, targetLabel: input.name, visibility: "internal" });
  notify(db, ctx, [input.leadId, ...input.memberIds], {
    type: "task.assigned",
    title: `You were added to ${input.name}`,
    body: `${ctx.user.name} created the project.`,
    href: `/w/${ctx.org.slug}/projects/${id}`,
  });

  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  redirect(`/w/${ctx.org.slug}/projects/${id}?created=1`);
}

export async function updateProject(orgSlug: string, projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  const project = getVisibleProject(db, ctx, projectId);
  if (!project) return fail("Project not found.");
  if (!canManageProject(db, ctx, project)) return fail("Only the project lead or a manager can edit this project.");

  const parsed = parseProjectForm(formData);
  if (!parsed.success) return invalid(parsed.error, formValues(formData));
  const input = parsed.data;
  if (input.clientId && !db.clients.some((client) => client.id === input.clientId && client.organizationId === ctx.org.id)) {
    return fail("That client doesn't exist in this workspace.");
  }
  if (input.sharedWithClient !== project.sharedWithClient && !can(ctx.role, "projects.share")) {
    return fail("Only owners and managers can change client sharing.");
  }

  const wasShared = project.sharedWithClient;
  Object.assign(project, {
    name: input.name,
    description: input.description,
    clientId: input.clientId,
    status: input.status,
    icon: input.icon,
    startAt: input.startAt ? new Date(input.startAt).toISOString() : undefined,
    dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : undefined,
    sharedWithClient: input.sharedWithClient,
    budgetCents: input.budget !== undefined ? Math.round(input.budget * 100) : undefined,
    updatedAt: new Date().toISOString(),
  });

  // Lead can be reassigned; contributors list is replaced.
  db.projectMembers = db.projectMembers.filter((item) => item.projectId !== project.id);
  db.projectMembers.push({ id: newId("pm"), organizationId: ctx.org.id, projectId: project.id, userId: input.leadId, projectRole: "lead" });
  for (const userId of new Set(input.memberIds)) {
    if (userId !== input.leadId) {
      db.projectMembers.push({ id: newId("pm"), organizationId: ctx.org.id, projectId: project.id, userId, projectRole: "contributor" });
    }
  }

  if (wasShared !== input.sharedWithClient) {
    recordAudit(db, ctx, {
      action: input.sharedWithClient ? "project.shared" : "project.unshared",
      entityType: "project",
      entityId: project.id,
      summary: `${input.sharedWithClient ? "Shared" : "Stopped sharing"} ${project.name} ${input.sharedWithClient ? "with" : "from"} the client portal`,
    });
    if (input.sharedWithClient) {
      notify(db, ctx, clientAudience(db, ctx.org.id, project.id), {
        type: "comment.posted",
        title: `${ctx.org.name} shared ${project.name} with you`,
        body: "You can now follow progress and review deliverables.",
        href: `/portal/${ctx.org.slug}/projects/${project.id}`,
      });
    }
  }

  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  return ok("Project saved.");
}

export async function setProjectStatus(orgSlug: string, projectId: string, status: ProjectStatus) {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  const project = getVisibleProject(db, ctx, projectId);
  if (!project || !canManageProject(db, ctx, project)) throw new Error("Not allowed");
  if (project.status === status) return;
  project.status = status;
  project.updatedAt = new Date().toISOString();
  recordActivity(db, ctx, { projectId, verb: "project.status_changed", targetType: "project", targetId: projectId, targetLabel: project.name });
  refresh();
}
