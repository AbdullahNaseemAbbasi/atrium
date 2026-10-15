import type { TeamContext } from "@/lib/data/access";
import { isVersionSentToClient } from "@/lib/data/client-review";
import type { Client, Database, Deliverable, DeliverableStatus, Project } from "@/lib/data/types";
import { projectProgress } from "@/lib/domain/rules";
import { formatDate } from "@/lib/utils";
import type { DeliverableContext, ProjectUpdateContext } from "./prompts";

/**
 * What each AI draft is allowed to see, gathered from the workspace data.
 * Pure functions of the database, so tests can check that client-facing
 * drafts never receive internal notes, internal tasks, unsent work or budgets.
 */

// Same formatting as the screens, so the AI repeats the dates people see.
const day = (iso: string) => formatDate(iso);

/** Everything about a deliverable the team sees, internal notes included. */
export function deliverableContext(db: Database, ctx: TeamContext, deliverable: Deliverable, project: Project): DeliverableContext {
  const name = (userId: string) => db.users.find((user) => user.id === userId)?.name ?? "Someone";
  const isClientUser = (userId: string) => db.clientMemberships.some((item) => item.userId === userId && item.organizationId === ctx.org.id);
  const client = project.clientId ? db.clients.find((item) => item.id === project.clientId) : undefined;
  return {
    agency: ctx.org.name,
    client: client?.companyName ?? null,
    project: project.name,
    title: deliverable.title,
    description: deliverable.description,
    currentVersion: deliverable.currentVersion,
    versions: db.deliverableVersions
      .filter((item) => item.deliverableId === deliverable.id)
      .sort((a, b) => a.version - b.version)
      .map((item) => ({ version: item.version, at: day(item.createdAt), note: item.note })),
    decisions: db.approvals
      .filter((item) => item.deliverableId === deliverable.id)
      .sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt))
      .map((item) => ({ version: item.version, decision: item.decision, by: name(item.clientUserId), at: day(item.decidedAt), comment: item.comment })),
    comments: db.comments
      .filter((item) => item.deliverableId === deliverable.id)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((item) => ({
        author: name(item.authorUserId),
        fromClient: isClientUser(item.authorUserId),
        internal: item.visibility === "internal",
        at: day(item.createdAt),
        body: item.body,
      })),
  };
}

/** The same deliverable as the client sees it: no internal notes, only versions they were sent. */
export function clientSideOf(context: DeliverableContext, deliverable: Deliverable): DeliverableContext {
  return {
    ...context,
    versions: context.versions.filter((version) => isVersionSentToClient(deliverable, version.version)),
    comments: context.comments.filter((comment) => !comment.internal),
  };
}

const STATUS_FOR_CLIENT: Partial<Record<DeliverableStatus, string>> = {
  in_review: "waiting for the client's review",
  changes_requested: "client asked for changes; the team is on it",
  approved: "approved by the client",
};

/** A week of client-visible work: client-visible tasks, milestones and deliverables the client was sent. No budget. */
export function clientUpdateContext(db: Database, ctx: TeamContext, project: Project, client: Client, now: Date): ProjectUpdateContext {
  const week = now.getTime() - 7 * 86_400_000;
  const fortnight = now.getTime() + 14 * 86_400_000;
  const tasks = db.tasks.filter((task) => task.projectId === project.id && task.clientVisible);
  const due = (iso?: string) => (iso ? day(iso) : undefined);
  return {
    agency: ctx.org.name,
    client: client.companyName,
    project: project.name,
    writer: ctx.user.name,
    today: day(now.toISOString()),
    progress: projectProgress(project, tasks),
    dueAt: due(project.dueAt),
    done: tasks
      .filter((task) => task.status === "done" && task.completedAt && Date.parse(task.completedAt) >= week)
      .slice(0, 10)
      .map((task) => ({ title: task.title, at: day(task.completedAt!) })),
    inProgress: tasks
      .filter((task) => task.status === "in_progress" || task.status === "in_review")
      .slice(0, 8)
      .map((task) => ({ title: task.title, dueAt: due(task.dueAt) })),
    upcoming: tasks
      .filter((task) => task.status === "todo" && task.dueAt && Date.parse(task.dueAt) <= fortnight)
      .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!))
      .slice(0, 8)
      .map((task) => ({ title: task.title, dueAt: due(task.dueAt) })),
    milestones: db.milestones
      .filter((item) => item.projectId === project.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ title: item.title, status: item.status.replace("_", " "), dueAt: due(item.dueAt) })),
    deliverables: db.deliverables
      .filter((item) => item.projectId === project.id && STATUS_FOR_CLIENT[item.status])
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 10)
      .map((item) => ({ title: item.title, status: STATUS_FOR_CLIENT[item.status]!, version: item.currentVersion })),
  };
}
