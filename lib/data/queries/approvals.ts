import "server-only";
import { notFound } from "next/navigation";
import { differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { formatRelative } from "@/lib/utils";
import { canSubmitDeliverable, visibleProjects } from "../access";
import { getDb } from "../store";
import { clientLite, userLite, type ClientLite, type UserLite } from "../views";
import type { ApprovalDecision, DeliverableStatus } from "../types";

export const APPROVAL_TABS = {
  waiting: "Waiting on client",
  changes: "Changes requested",
  drafts: "Drafts ready to send",
  decided: "Recently decided",
} as const;
export type ApprovalTab = keyof typeof APPROVAL_TABS;

/** After this many days in review, a deliverable is flagged so someone nudges the client. */
export const WAITING_WARNING_DAYS = 3;
const DECIDED_WINDOW_DAYS = 30;

export interface QueueItem {
  id: string;
  title: string;
  version: number;
  status: DeliverableStatus;
  href: string;
  project: { id: string; name: string };
  client: ClientLite | null;
  /** Main timestamp for the row (submitted, decided or last updated). */
  at: string;
  atText: string;
  waitingDays: number;
  reviewers: UserLite[];
  commentCount: number;
  decision: { by: UserLite | null; comment?: string; version: number } | null;
  uploadedBy: UserLite | null;
  blocker: string | null;
}

export interface DecisionItem {
  id: string;
  deliverableId: string;
  title: string;
  version: number;
  decision: ApprovalDecision;
  comment?: string;
  by: UserLite | null;
  href: string;
  project: { id: string; name: string };
  client: ClientLite | null;
  decidedAt: string;
  decidedText: string;
}

export async function getApprovals(orgSlug: string, query: { tab?: string; project?: string }) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "projects.view_assigned")) notFound();
  const db = await getDb();
  const now = new Date();
  const base = `/w/${ctx.org.slug}`;

  const projects = visibleProjects(db, ctx);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const tab: ApprovalTab = query.tab && query.tab in APPROVAL_TABS ? (query.tab as ApprovalTab) : "waiting";
  const projectFilter = query.project && projectById.has(query.project) ? query.project : "";

  const deliverables = db.deliverables.filter(
    (item) => item.organizationId === ctx.org.id && projectById.has(item.projectId) && (!projectFilter || item.projectId === projectFilter),
  );
  const deliverableIds = new Set(deliverables.map((item) => item.id));

  const approversFor = (clientId: string | null) =>
    clientId
      ? db.clientMemberships
          .filter((item) => item.clientId === clientId && item.status === "active" && item.role === "approver")
          .map((item) => userLite(db, item.userId))
          .filter((user): user is UserLite => Boolean(user))
      : [];

  const toItem = (item: (typeof deliverables)[number], at: string): QueueItem => {
    const project = projectById.get(item.projectId)!;
    const last = db.approvals
      .filter((approval) => approval.deliverableId === item.id)
      .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))[0];
    const latestVersion = db.deliverableVersions
      .filter((version) => version.deliverableId === item.id)
      .sort((a, b) => b.version - a.version)[0];
    let blocker: string | null = null;
    if (item.status === "draft") {
      if (!project.clientId) blocker = "Internal project: no client to send to.";
      else if (!project.sharedWithClient) blocker = "Share the project with the client first.";
      else if (!canSubmitDeliverable(db, ctx, project)) blocker = "The project lead or a manager sends this.";
    }
    return {
      id: item.id,
      title: item.title,
      version: item.currentVersion,
      status: item.status,
      href: `${base}/projects/${project.id}/deliverables/${item.id}`,
      project: { id: project.id, name: project.name },
      client: clientLite(db, project.clientId),
      at,
      atText: formatRelative(at, now),
      waitingDays: Math.max(0, differenceInCalendarDays(now, parseISO(at))),
      reviewers: approversFor(project.clientId),
      commentCount: db.comments.filter((comment) => comment.deliverableId === item.id).length,
      decision: last ? { by: userLite(db, last.clientUserId), comment: last.comment, version: last.version } : null,
      uploadedBy: userLite(db, latestVersion?.uploadedByUserId),
      blocker,
    };
  };

  const waiting = deliverables
    .filter((item) => item.status === "in_review")
    .map((item) => toItem(item, item.submittedAt ?? item.updatedAt))
    .sort((a, b) => b.waitingDays - a.waitingDays || Date.parse(a.at) - Date.parse(b.at));

  const changes = deliverables
    .filter((item) => item.status === "changes_requested")
    .map((item) => {
      const last = db.approvals
        .filter((approval) => approval.deliverableId === item.id)
        .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))[0];
      return toItem(item, last?.decidedAt ?? item.updatedAt);
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const drafts = deliverables
    .filter((item) => item.status === "draft")
    .map((item) => toItem(item, item.updatedAt))
    .sort((a, b) => Number(Boolean(a.blocker)) - Number(Boolean(b.blocker)) || Date.parse(b.at) - Date.parse(a.at));

  const since = subDays(now, DECIDED_WINDOW_DAYS).getTime();
  const decided: DecisionItem[] = db.approvals
    .filter((approval) => approval.organizationId === ctx.org.id && deliverableIds.has(approval.deliverableId) && Date.parse(approval.decidedAt) >= since)
    .sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))
    .map((approval) => {
      const deliverable = deliverables.find((item) => item.id === approval.deliverableId)!;
      const project = projectById.get(deliverable.projectId)!;
      return {
        id: approval.id,
        deliverableId: deliverable.id,
        title: deliverable.title,
        version: approval.version,
        decision: approval.decision,
        comment: approval.comment,
        by: userLite(db, approval.clientUserId),
        href: `${base}/projects/${project.id}/deliverables/${deliverable.id}`,
        project: { id: project.id, name: project.name },
        client: clientLite(db, project.clientId),
        decidedAt: approval.decidedAt,
        decidedText: formatRelative(approval.decidedAt, now),
      };
    });

  const projectsWithWork = new Set(db.deliverables.filter((item) => projectById.has(item.projectId)).map((item) => item.projectId));

  return {
    base,
    tab,
    project: projectFilter,
    counts: { waiting: waiting.length, changes: changes.length, drafts: drafts.length, decided: decided.length },
    stats: {
      waiting: waiting.length,
      overdue: waiting.filter((item) => item.waitingDays > WAITING_WARNING_DAYS).length,
      oldest: waiting[0]?.waitingDays ?? 0,
      approved30: decided.filter((item) => item.decision === "approved").length,
      changes30: decided.filter((item) => item.decision === "changes_requested").length,
    },
    waiting,
    changes,
    drafts,
    decided,
    projects: projects
      .filter((project) => projectsWithWork.has(project.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((project) => ({ id: project.id, name: project.name })),
    hasAnyDeliverables: projectsWithWork.size > 0,
  };
}

export type ApprovalsPage = Awaited<ReturnType<typeof getApprovals>>;
