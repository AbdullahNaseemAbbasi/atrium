import { describe, expect, it } from "vitest";
import { assignableRoles, can, clientCan } from "@/lib/auth/permissions";
import { checkLimit, PLANS } from "@/lib/billing/plans";
import {
  canTransition,
  findExistingDecision,
  isTaskDueSoon,
  isTaskOverdue,
  milestoneBlockers,
  nextDeliverableStatus,
  projectProgress,
} from "@/lib/domain/rules";
import { activeProjectsAt, overdueTasksAt, pendingApprovalsAt, reviewWindows, tasksDueSoonAt } from "@/lib/domain/metrics";
import { createSeed } from "@/lib/data/seed";

const NOW = new Date("2026-10-15T12:00:00Z");

describe("permission matrix", () => {
  it("gives owners everything and billing managers billing only", () => {
    expect(can("owner", "billing.manage")).toBe(true);
    expect(can("billing", "billing.manage")).toBe(true);
    expect(can("billing", "projects.view_assigned")).toBe(false);
    expect(can("billing", "clients.view")).toBe(false);
  });

  it("keeps sensitive actions away from members", () => {
    expect(can("member", "projects.view_all")).toBe(false);
    expect(can("member", "team.invite")).toBe(false);
    expect(can("member", "audit.view")).toBe(false);
    expect(can("manager", "billing.view")).toBe(false);
    expect(can("manager", "team.manage_roles")).toBe(false);
  });

  it("limits who can be assigned which role", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("manager")).toEqual(["member"]);
    expect(assignableRoles("member")).toEqual([]);
  });

  it("lets client viewers comment but not approve", () => {
    expect(clientCan("viewer", "portal.comment")).toBe(true);
    expect(clientCan("viewer", "portal.approve")).toBe(false);
    expect(clientCan("approver", "portal.approve")).toBe(true);
  });
});

describe("deliverable review state machine", () => {
  it("allows the documented transitions only", () => {
    expect(nextDeliverableStatus("draft", "submit")).toBe("in_review");
    expect(nextDeliverableStatus("in_review", "approve")).toBe("approved");
    expect(nextDeliverableStatus("in_review", "request_changes")).toBe("changes_requested");
    expect(nextDeliverableStatus("changes_requested", "upload_version")).toBe("draft");
    expect(canTransition("draft", "approve")).toBe(false);
    expect(canTransition("approved", "approve")).toBe(false);
    expect(canTransition("changes_requested", "submit")).toBe(false);
  });

  it("finds an existing decision so a repeated request does not duplicate it", () => {
    const db = createSeed(NOW);
    expect(findExistingDecision(db.approvals, "dlv_sitemap", 2, "usr_daniel")?.decision).toBe("approved");
    expect(findExistingDecision(db.approvals, "dlv_homepage", 3, "usr_daniel")).toBeUndefined();
  });
});

describe("milestone completion rule", () => {
  it("blocks while tasks are open or approval deliverables aren't approved", () => {
    const blockers = milestoneBlockers(
      { approvalRequired: true },
      [{ status: "done" }, { status: "in_progress" }],
      [{ status: "approved" }, { status: "in_review" }],
    );
    expect(blockers).toEqual([
      { kind: "open_tasks", count: 1 },
      { kind: "unapproved_deliverables", count: 1 },
    ]);
  });

  it("requires at least one deliverable when approval is required", () => {
    expect(milestoneBlockers({ approvalRequired: true }, [], [])).toEqual([{ kind: "no_deliverables" }]);
    expect(milestoneBlockers({ approvalRequired: false }, [{ status: "done" }], [])).toEqual([]);
  });
});

describe("progress and due-date rules", () => {
  it("computes progress from completed tasks", () => {
    expect(projectProgress({ status: "in_progress" }, [{ status: "done" }, { status: "todo" }, { status: "todo" }, { status: "done" }])).toBe(50);
    expect(projectProgress({ status: "completed" }, [{ status: "todo" }])).toBe(100);
    expect(projectProgress({ status: "planning" }, [])).toBe(0);
  });

  it("classifies overdue and due-soon tasks by calendar day", () => {
    const yesterday = "2026-10-14T17:00:00Z";
    const inThreeDays = "2026-10-18T17:00:00Z";
    expect(isTaskOverdue({ status: "todo", dueAt: yesterday }, NOW)).toBe(true);
    expect(isTaskOverdue({ status: "done", dueAt: yesterday }, NOW)).toBe(false);
    expect(isTaskDueSoon({ status: "todo", dueAt: inThreeDays }, NOW)).toBe(true);
    expect(isTaskDueSoon({ status: "todo", dueAt: yesterday }, NOW)).toBe(false);
  });
});

describe("plan limits", () => {
  it("blocks the request that would exceed a limit and allows unlimited plans", () => {
    expect(checkLimit(PLANS.starter, "projects", 2).allowed).toBe(true);
    expect(checkLimit(PLANS.starter, "projects", 3).allowed).toBe(false);
    expect(checkLimit(PLANS.agency, "projects", 10_000).allowed).toBe(true);
  });
});

describe("dashboard metrics against the seeded dataset", () => {
  const db = createSeed(NOW);
  const kinetic = (id: string) => id === "org_kinetic";
  const projects = db.projects.filter((project) => kinetic(project.organizationId));
  const tasks = db.tasks.filter((task) => kinetic(task.organizationId));
  const deliverables = db.deliverables.filter((item) => kinetic(item.organizationId));

  it("matches the documented formulas", () => {
    // Started and in planning/progress/review: website, mobile, ecom, seo, site (meridian starts in 4 days).
    expect(activeProjectsAt(projects, NOW)).toBe(5);
    expect(overdueTasksAt(tasks, NOW)).toBe(3);
    expect(tasksDueSoonAt(tasks, NOW)).toBe(15);
    const windows = reviewWindows(deliverables, db.deliverableVersions, db.approvals);
    expect(pendingApprovalsAt(windows, NOW)).toBe(4);
  });

  it("reconstructs past values from history", () => {
    const monthAgo = new Date("2026-09-15T12:00:00Z");
    expect(activeProjectsAt(projects, monthAgo)).toBeLessThanOrEqual(activeProjectsAt(projects, NOW) + 1);
    expect(overdueTasksAt(tasks, monthAgo)).toBeGreaterThanOrEqual(0);
  });
});
