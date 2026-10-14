import { milestoneBlockers, findExistingDecision, nextDeliverableStatus } from "@/lib/domain/rules";
import { canDecideOnDeliverable, canViewDeliverable, type ClientContext } from "./access";
import { notify, projectAudience, recordActivity, recordAudit } from "./events";
import { newId } from "./store";
import type { Approval, ApprovalDecision, Database, Deliverable, Milestone, MilestoneStatus, Task } from "./types";

/**
 * Client review workflow: which versions a client may see, and what happens
 * when a client approver decides on a deliverable. Pure functions of the
 * database (plus the side-effect helpers in events.ts) so the whole flow is
 * unit tested without a request.
 */

/**
 * A version reaches the client once it has been sent. Every version of a
 * submitted deliverable is shared; while a new draft is being prepared the
 * current (unsent) version stays private.
 */
export function isVersionSentToClient(deliverable: Pick<Deliverable, "status" | "currentVersion" | "submittedAt">, version: number) {
  if (deliverable.status !== "draft") return true;
  return Boolean(deliverable.submittedAt) && version < deliverable.currentVersion;
}

/** The newest version number the client may see, or null when nothing was sent yet. */
export function latestSentVersion(deliverable: Pick<Deliverable, "status" | "currentVersion" | "submittedAt">) {
  for (let version = deliverable.currentVersion; version >= 1; version -= 1) {
    if (isVersionSentToClient(deliverable, version)) return version;
  }
  return null;
}

/**
 * Milestone status after a client decision on one of its deliverables.
 * Only approval milestones move automatically:
 * - every blocker cleared → completed;
 * - only client approval left (no open tasks, something in review) → awaiting approval;
 * - otherwise back to (or into) in progress.
 */
export function milestoneStatusAfterDecision(
  milestone: Pick<Milestone, "status" | "approvalRequired">,
  tasks: Pick<Task, "status">[],
  deliverables: Pick<Deliverable, "status">[],
): MilestoneStatus {
  if (milestone.status === "completed" || !milestone.approvalRequired) return milestone.status;
  const blockers = milestoneBlockers(milestone, tasks, deliverables);
  if (blockers.length === 0) return "completed";
  const openTasks = blockers.some((blocker) => blocker.kind === "open_tasks");
  if (!openTasks && deliverables.some((item) => item.status === "in_review")) return "awaiting_approval";
  return "in_progress";
}

export interface DecisionInput {
  decision: ApprovalDecision;
  version: number;
  comment?: string;
}

export type DecisionOutcome =
  | { kind: "not_found" }
  | { kind: "not_allowed"; message: string }
  | { kind: "stale"; currentVersion: number }
  | { kind: "existing"; approval: Approval }
  | {
      kind: "decided";
      approval: Approval;
      milestone: { id: string; title: string; from: MilestoneStatus; to: MilestoneStatus } | null;
    };

/**
 * Records a client approver's decision. Re-checks tenant ownership, the
 * approver role and the version the client was looking at. Idempotent: a
 * repeated request for the same version by the same person returns the
 * decision that already exists.
 */
export function applyClientDecision(db: Database, ctx: ClientContext, deliverableId: string, input: DecisionInput, now = new Date()): DecisionOutcome {
  const deliverable = db.deliverables.find((item) => item.id === deliverableId && item.organizationId === ctx.org.id);
  if (!deliverable || !canViewDeliverable(db, ctx, deliverable)) return { kind: "not_found" };
  const project = db.projects.find((item) => item.id === deliverable.projectId && item.organizationId === ctx.org.id);
  if (!project) return { kind: "not_found" };

  const existing = findExistingDecision(
    db.approvals.filter((item) => item.organizationId === ctx.org.id),
    deliverable.id,
    input.version,
    ctx.user.id,
  );
  if (existing) return { kind: "existing", approval: existing as Approval };

  if (ctx.role !== "approver") {
    return { kind: "not_allowed", message: "Only approvers can approve or request changes. You can still comment." };
  }
  if (input.version !== deliverable.currentVersion) return { kind: "stale", currentVersion: deliverable.currentVersion };
  if (!canDecideOnDeliverable(db, ctx, deliverable)) {
    return { kind: "not_allowed", message: "This version isn't waiting for a decision any more." };
  }
  const nextStatus = nextDeliverableStatus(deliverable.status, input.decision === "approved" ? "approve" : "request_changes");
  if (!nextStatus) return { kind: "not_allowed", message: "This version isn't waiting for a decision any more." };

  const versionRow = db.deliverableVersions.find((item) => item.deliverableId === deliverable.id && item.version === input.version);
  if (!versionRow) return { kind: "not_found" };

  const at = now.toISOString();
  const approval: Approval = {
    id: newId("apr"),
    organizationId: ctx.org.id,
    deliverableId: deliverable.id,
    versionId: versionRow.id,
    version: input.version,
    clientUserId: ctx.user.id,
    decision: input.decision,
    comment: input.comment,
    decidedAt: at,
  };
  db.approvals.push(approval);
  Object.assign(deliverable, { status: nextStatus, updatedAt: at });
  project.updatedAt = at;

  const approved = input.decision === "approved";
  const label = `${deliverable.title} v${input.version}`;
  recordAudit(db, ctx, {
    action: approved ? "deliverable.approved" : "deliverable.changes_requested",
    entityType: "deliverable",
    entityId: deliverable.id,
    summary: `${approved ? "Approved" : "Requested changes on"} ${deliverable.title} (v${input.version})`,
    metadata: { version: input.version, client: ctx.client.companyName },
  });
  recordActivity(db, ctx, {
    projectId: project.id,
    verb: approved ? "deliverable.approved" : "deliverable.changes_requested",
    targetType: "deliverable",
    targetId: deliverable.id,
    targetLabel: label,
    visibility: "client",
  });
  const teamHref = `/w/${ctx.org.slug}/projects/${project.id}/deliverables/${deliverable.id}`;
  notify(db, ctx, projectAudience(db, ctx.org.id, project.id), {
    type: approved ? "deliverable.approved" : "deliverable.changes_requested",
    title: approved ? `${ctx.user.name} approved ${label}` : `${ctx.user.name} requested changes to ${label}`,
    body: input.comment ? input.comment.slice(0, 140) : `${ctx.client.companyName} · ${project.name}`,
    href: teamHref,
    deduplicationKey: `decision:${deliverable.id}:${input.version}`,
  });

  let milestoneChange: Extract<DecisionOutcome, { kind: "decided" }>["milestone"] = null;
  const milestone = deliverable.milestoneId
    ? db.milestones.find((item) => item.id === deliverable.milestoneId && item.projectId === project.id)
    : undefined;
  if (milestone && milestone.approvalRequired) {
    const from = milestone.status;
    const to = milestoneStatusAfterDecision(
      milestone,
      db.tasks.filter((task) => task.milestoneId === milestone.id),
      db.deliverables.filter((item) => item.milestoneId === milestone.id),
    );
    if (to !== from) {
      milestone.status = to;
      milestoneChange = { id: milestone.id, title: milestone.title, from, to };
      if (to === "completed") {
        milestone.completedAt = at;
        recordActivity(db, ctx, {
          projectId: project.id,
          verb: "milestone.completed",
          targetType: "milestone",
          targetId: milestone.id,
          targetLabel: milestone.title,
          visibility: "client",
        });
        notify(db, ctx, projectAudience(db, ctx.org.id, project.id), {
          type: "milestone.completed",
          title: `${milestone.title} is complete`,
          body: `${ctx.user.name}'s approval cleared the last blocker on ${project.name}.`,
          href: `/w/${ctx.org.slug}/projects/${project.id}/milestones`,
          deduplicationKey: `milestone:${milestone.id}:completed`,
        });
      }
    }
  }

  return { kind: "decided", approval, milestone: milestoneChange };
}
