"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireTeamContext } from "@/lib/auth/context";
import { describeBlocker, milestoneBlockers } from "@/lib/domain/rules";
import { canManageProject, getVisibleProject } from "@/lib/data/access";
import { clientAudience, notify, projectAudience, recordActivity } from "@/lib/data/events";
import { getDb, newId } from "@/lib/data/store";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

const milestoneSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters.").max(100, "Keep the title under 100 characters."),
  description: z
    .string()
    .trim()
    .max(500, "Keep the description under 500 characters.")
    .optional()
    .transform((value) => value || undefined),
  dueAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), "Enter a valid date."),
  approvalRequired: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
    .optional()
    .transform((value) => value === "on" || value === "true"),
});

function parse(formData: FormData) {
  return milestoneSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? undefined,
    dueAt: formData.get("dueAt") ?? undefined,
    approvalRequired: formData.get("approvalRequired") ?? undefined,
  });
}

/** Due dates are stored at 17:00 UTC on the chosen day, like seeded milestones. */
function toDueAt(value: string | undefined) {
  return value ? new Date(`${value.slice(0, 10)}T17:00:00.000Z`).toISOString() : undefined;
}

/** Loads a project the viewer may manage (lead, manager or owner) in this workspace. */
async function manageableProject(orgSlug: string, projectId: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  const project = getVisibleProject(db, ctx, projectId);
  if (!project || project.organizationId !== ctx.org.id || !canManageProject(db, ctx, project)) return null;
  return { ctx, db, project };
}

async function manageableMilestone(orgSlug: string, milestoneId: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  const milestone = db.milestones.find((item) => item.id === milestoneId && item.organizationId === ctx.org.id);
  const project = milestone ? getVisibleProject(db, ctx, milestone.projectId) : null;
  if (!milestone || !project || !canManageProject(db, ctx, project)) return null;
  return { ctx, db, project, milestone };
}

export async function createMilestone(orgSlug: string, projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const loaded = await manageableProject(orgSlug, projectId);
  if (!loaded) return fail("Only the project lead or a manager can add milestones.");
  const { ctx, db, project } = loaded;
  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  const siblings = db.milestones.filter((item) => item.projectId === project.id);
  const hasOpen = siblings.some((item) => item.status !== "completed");
  db.milestones.push({
    id: newId("ms"),
    organizationId: ctx.org.id,
    projectId: project.id,
    title: parsed.data.title,
    description: parsed.data.description,
    position: siblings.reduce((max, item) => Math.max(max, item.position), 0) + 1,
    dueAt: toDueAt(parsed.data.dueAt),
    status: hasOpen ? "upcoming" : "in_progress",
    approvalRequired: parsed.data.approvalRequired,
  });
  project.updatedAt = new Date().toISOString();
  refresh();
  return ok(`“${parsed.data.title}” added.`);
}

export async function updateMilestone(orgSlug: string, milestoneId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const loaded = await manageableMilestone(orgSlug, milestoneId);
  if (!loaded) return fail("Only the project lead or a manager can edit milestones.");
  const { milestone, project } = loaded;
  const parsed = parse(formData);
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  Object.assign(milestone, {
    title: parsed.data.title,
    description: parsed.data.description,
    dueAt: toDueAt(parsed.data.dueAt),
    approvalRequired: parsed.data.approvalRequired,
  });
  project.updatedAt = new Date().toISOString();
  refresh();
  return ok("Milestone saved.");
}

export async function moveMilestone(orgSlug: string, milestoneId: string, direction: "up" | "down"): Promise<ActionState> {
  const loaded = await manageableMilestone(orgSlug, milestoneId);
  if (!loaded) return fail("Only the project lead or a manager can reorder milestones.");
  const { db, milestone } = loaded;
  const ordered = db.milestones.filter((item) => item.projectId === milestone.projectId).sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((item) => item.id === milestone.id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return fail(`“${milestone.title}” is already ${direction === "up" ? "first" : "last"}.`);
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  ordered.forEach((item, position) => {
    item.position = position + 1;
  });
  refresh();
  return ok(`Moved “${milestone.title}” ${direction}.`);
}

/**
 * Completes a milestone once every task is done and, for approval
 * milestones, every deliverable is approved. The rule lives in
 * `milestoneBlockers`, so the button and this check never disagree.
 */
export async function completeMilestone(orgSlug: string, milestoneId: string): Promise<ActionState> {
  const loaded = await manageableMilestone(orgSlug, milestoneId);
  if (!loaded) return fail("Only the project lead or a manager can complete milestones.");
  const { ctx, db, project, milestone } = loaded;
  if (milestone.status === "completed") return ok("This milestone is already complete.");

  const blockers = milestoneBlockers(
    milestone,
    db.tasks.filter((task) => task.milestoneId === milestone.id),
    db.deliverables.filter((item) => item.milestoneId === milestone.id),
  );
  if (blockers.length > 0) return fail(`Not yet: ${blockers.map(describeBlocker).join(", ").toLowerCase()}.`);

  const now = new Date().toISOString();
  Object.assign(milestone, { status: "completed", completedAt: now });
  project.updatedAt = now;
  recordActivity(db, ctx, {
    projectId: project.id,
    verb: "milestone.completed",
    targetType: "milestone",
    targetId: milestone.id,
    targetLabel: milestone.title,
    visibility: project.sharedWithClient ? "client" : "internal",
  });
  notify(db, ctx, projectAudience(db, ctx.org.id, project.id), {
    type: "milestone.completed",
    title: `${milestone.title} is complete`,
    body: `${ctx.user.name} completed it on ${project.name}.`,
    href: `/w/${ctx.org.slug}/projects/${project.id}/milestones`,
    deduplicationKey: `milestone:${milestone.id}:completed`,
  });
  notify(db, ctx, clientAudience(db, ctx.org.id, project.id), {
    type: "milestone.completed",
    title: `${milestone.title} is complete`,
    body: `${ctx.org.name} finished this phase of ${project.name}.`,
    href: `/portal/${ctx.org.slug}/projects/${project.id}`,
    deduplicationKey: `milestone:${milestone.id}:completed`,
  });
  refresh();
  return ok(`“${milestone.title}” marked complete.`);
}

export async function reopenMilestone(orgSlug: string, milestoneId: string): Promise<ActionState> {
  const loaded = await manageableMilestone(orgSlug, milestoneId);
  if (!loaded) return fail("Only the project lead or a manager can reopen milestones.");
  const { milestone, project } = loaded;
  if (milestone.status !== "completed") return ok("This milestone is already open.");
  Object.assign(milestone, { status: "in_progress", completedAt: undefined });
  project.updatedAt = new Date().toISOString();
  refresh();
  return ok(`“${milestone.title}” reopened.`);
}
