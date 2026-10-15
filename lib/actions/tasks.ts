"use server";

import { refresh } from "next/cache";
import { requireTeamContext } from "@/lib/auth/context";
import { canWorkOnProject, getVisibleProject } from "@/lib/data/access";
import { notify, recordActivity } from "@/lib/data/events";
import { getDb, newId, saveDb } from "@/lib/data/store";
import type { Database, TaskStatus } from "@/lib/data/types";
import { commentSchema, taskSchema } from "@/lib/validation/schemas";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

/** Loads a task and checks the caller can work on its project. */
async function loadTask(orgSlug: string, taskId: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const task = db.tasks.find((item) => item.id === taskId && item.organizationId === ctx.org.id);
  const project = task ? getVisibleProject(db, ctx, task.projectId) : null;
  if (!task || !project || !canWorkOnProject(db, ctx, project)) return null;
  return { ctx, db, task, project };
}

function validateRefs(db: Database, projectId: string, assigneeId?: string, milestoneId?: string) {
  if (assigneeId && !db.projectMembers.some((item) => item.projectId === projectId && item.userId === assigneeId)) {
    return { assigneeId: ["Assign someone on this project."] };
  }
  if (milestoneId && !db.milestones.some((item) => item.projectId === projectId && item.id === milestoneId)) {
    return { milestoneId: ["Pick a milestone from this project."] };
  }
  return null;
}

export async function createTask(orgSlug: string, projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  const db = await getDb();
  const project = getVisibleProject(db, ctx, projectId);
  if (!project || !canWorkOnProject(db, ctx, project)) return fail("You can't add tasks to this project.");

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));
  const input = parsed.data;
  const refErrors = validateRefs(db, project.id, input.assigneeId, input.milestoneId);
  if (refErrors) return fail("Please fix the highlighted fields.", refErrors, formValues(formData));

  const now = new Date().toISOString();
  const id = newId("tsk");
  db.tasks.push({
    id,
    organizationId: ctx.org.id,
    projectId: project.id,
    milestoneId: input.milestoneId,
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : undefined,
    assigneeUserId: input.assigneeId,
    createdByUserId: ctx.user.id,
    clientVisible: input.clientVisible,
    createdAt: now,
    completedAt: input.status === "done" ? now : undefined,
  });
  project.updatedAt = now;
  recordActivity(db, ctx, {
    projectId: project.id,
    verb: "task.created",
    targetType: "task",
    targetId: id,
    targetLabel: input.title,
    visibility: input.clientVisible ? "client" : "internal",
  });
  if (input.assigneeId) {
    notify(db, ctx, [input.assigneeId], {
      type: "task.assigned",
      title: `You were assigned ${input.title}`,
      body: project.name,
      href: `/w/${ctx.org.slug}/projects/${project.id}/tasks?task=${id}`,
    });
  }
  await saveDb();
  refresh();
  return ok("Task added.");
}

export async function updateTask(orgSlug: string, taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const loaded = await loadTask(orgSlug, taskId);
  if (!loaded) return fail("You can't edit this task.");
  const { ctx, db, task, project } = loaded;

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));
  const input = parsed.data;
  const refErrors = validateRefs(db, project.id, input.assigneeId, input.milestoneId);
  if (refErrors) return fail("Please fix the highlighted fields.", refErrors, formValues(formData));

  const previousAssignee = task.assigneeUserId;
  applyStatus(task, input.status);
  Object.assign(task, {
    title: input.title,
    description: input.description,
    priority: input.priority,
    dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : undefined,
    assigneeUserId: input.assigneeId,
    milestoneId: input.milestoneId,
    clientVisible: input.clientVisible,
  });
  project.updatedAt = new Date().toISOString();
  if (input.assigneeId && input.assigneeId !== previousAssignee) {
    notify(db, ctx, [input.assigneeId], {
      type: "task.assigned",
      title: `You were assigned ${task.title}`,
      body: project.name,
      href: `/w/${ctx.org.slug}/projects/${project.id}/tasks?task=${task.id}`,
    });
  }
  await saveDb();
  refresh();
  return ok("Task saved.");
}

function applyStatus(task: { status: TaskStatus; completedAt?: string }, status: TaskStatus) {
  if (status === "done" && task.status !== "done") task.completedAt = new Date().toISOString();
  if (status !== "done") task.completedAt = undefined;
  task.status = status;
}

export async function setTaskStatus(orgSlug: string, taskId: string, status: TaskStatus) {
  const loaded = await loadTask(orgSlug, taskId);
  if (!loaded) throw new Error("You can't update this task.");
  const { ctx, db, task, project } = loaded;
  const wasDone = task.status === "done";
  applyStatus(task, status);
  project.updatedAt = new Date().toISOString();
  if (status === "done" && !wasDone) {
    recordActivity(db, ctx, {
      projectId: project.id,
      verb: "task.completed",
      targetType: "task",
      targetId: task.id,
      targetLabel: task.title,
      visibility: task.clientVisible ? "client" : "internal",
    });
  }
  await saveDb();
  refresh();
}

export async function deleteTask(orgSlug: string, taskId: string) {
  const loaded = await loadTask(orgSlug, taskId);
  if (!loaded) throw new Error("You can't delete this task.");
  const { db, task } = loaded;
  db.tasks = db.tasks.filter((item) => item.id !== task.id);
  db.comments = db.comments.filter((item) => item.taskId !== task.id);
  await saveDb();
  refresh();
}

export async function addTaskComment(orgSlug: string, taskId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const loaded = await loadTask(orgSlug, taskId);
  if (!loaded) return fail("You can't comment on this task.");
  const { ctx, db, task, project } = loaded;
  const parsed = commentSchema.safeParse({ body: formData.get("body"), visibility: task.clientVisible ? formData.get("visibility") ?? "internal" : "internal" });
  if (!parsed.success) return invalid(parsed.error);
  db.comments.push({
    id: newId("cmt"),
    organizationId: ctx.org.id,
    projectId: project.id,
    taskId: task.id,
    authorUserId: ctx.user.id,
    body: parsed.data.body,
    visibility: parsed.data.visibility,
    createdAt: new Date().toISOString(),
  });
  if (task.assigneeUserId) {
    notify(db, ctx, [task.assigneeUserId], {
      type: "comment.posted",
      title: `${ctx.user.name} commented on ${task.title}`,
      body: parsed.data.body.slice(0, 120),
      href: `/w/${ctx.org.slug}/projects/${project.id}/tasks?task=${task.id}`,
      deduplicationKey: `task-comment:${task.id}`,
    });
  }
  await saveDb();
  refresh();
  return ok();
}
