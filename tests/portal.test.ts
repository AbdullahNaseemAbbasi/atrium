import { beforeEach, describe, expect, it } from "vitest";
import { resolveClientContext, type ClientContext } from "@/lib/data/access";
import {
  applyClientDecision,
  isVersionSentToClient,
  latestSentVersion,
  milestoneStatusAfterDecision,
} from "@/lib/data/client-review";
import { createSeed } from "@/lib/data/seed";
import type { Database } from "@/lib/data/types";

const NOW = new Date("2026-10-15T12:00:00Z");
let db: Database;

beforeEach(() => {
  db = createSeed(NOW);
});

function client(userId: string, org = "kinetic"): ClientContext {
  const ctx = resolveClientContext(db, userId, org);
  if (!ctx) throw new Error(`${userId} is not a client of ${org}`);
  return ctx;
}

const deliverable = (id: string) => db.deliverables.find((item) => item.id === id)!;
const milestone = (id: string) => db.milestones.find((item) => item.id === id)!;

describe("versions the client may see", () => {
  it("shares every version of a submitted deliverable", () => {
    expect(isVersionSentToClient({ status: "in_review", currentVersion: 3, submittedAt: "x" }, 3)).toBe(true);
    expect(isVersionSentToClient({ status: "approved", currentVersion: 2, submittedAt: "x" }, 1)).toBe(true);
  });

  it("keeps an unsent draft private but still shows earlier sent versions", () => {
    expect(isVersionSentToClient({ status: "draft", currentVersion: 3, submittedAt: "x" }, 3)).toBe(false);
    expect(isVersionSentToClient({ status: "draft", currentVersion: 3, submittedAt: "x" }, 2)).toBe(true);
    expect(latestSentVersion({ status: "draft", currentVersion: 3, submittedAt: "x" })).toBe(2);
  });

  it("shows nothing for a deliverable that was never sent", () => {
    expect(latestSentVersion({ status: "draft", currentVersion: 1, submittedAt: undefined })).toBeNull();
  });
});

describe("milestone status after a client decision", () => {
  const approval = { status: "in_progress" as const, approvalRequired: true };

  it("completes an approval milestone once every task is done and every deliverable approved", () => {
    expect(milestoneStatusAfterDecision(approval, [{ status: "done" }], [{ status: "approved" }, { status: "approved" }])).toBe("completed");
  });

  it("waits for the client when only approvals are left", () => {
    expect(milestoneStatusAfterDecision(approval, [{ status: "done" }], [{ status: "approved" }, { status: "in_review" }])).toBe("awaiting_approval");
  });

  it("goes back to in progress after a change request or while tasks are open", () => {
    expect(milestoneStatusAfterDecision({ ...approval, status: "awaiting_approval" }, [{ status: "done" }], [{ status: "changes_requested" }])).toBe(
      "in_progress",
    );
    expect(milestoneStatusAfterDecision(approval, [{ status: "todo" }], [{ status: "approved" }])).toBe("in_progress");
  });

  it("never moves milestones that don't require approval, or completed ones", () => {
    expect(milestoneStatusAfterDecision({ status: "in_progress", approvalRequired: false }, [], [{ status: "approved" }])).toBe("in_progress");
    expect(milestoneStatusAfterDecision({ status: "completed", approvalRequired: true }, [{ status: "todo" }], [])).toBe("completed");
  });
});

describe("applyClientDecision", () => {
  it("approves the current version and records approval, audit, activity and team notifications", () => {
    const ctx = client("usr_daniel");
    const before = { approvals: db.approvals.length, audit: db.auditLogs.length, activity: db.activity.length, notifications: db.notifications.length };
    const outcome = applyClientDecision(db, ctx, "dlv_homepage", { decision: "approved", version: 3, comment: "Ship it." }, NOW);

    expect(outcome.kind).toBe("decided");
    expect(deliverable("dlv_homepage").status).toBe("approved");
    expect(db.approvals.length).toBe(before.approvals + 1);
    const approval = db.approvals.at(-1)!;
    expect(approval).toMatchObject({ deliverableId: "dlv_homepage", version: 3, versionId: "dlv_homepage_v3", clientUserId: "usr_daniel", decision: "approved" });

    const audit = db.auditLogs.at(-1)!;
    expect(db.auditLogs.length).toBe(before.audit + 1);
    expect(audit).toMatchObject({ action: "deliverable.approved", entityId: "dlv_homepage", actorUserId: "usr_daniel" });
    expect(audit.metadata.version).toBe(3);

    expect(db.activity.length).toBe(before.activity + 1);
    expect(db.activity.at(-1)).toMatchObject({ verb: "deliverable.approved", visibility: "client" });

    const notified = db.notifications.slice(before.notifications);
    expect(notified.map((item) => item.recipientUserId).sort()).toEqual(["usr_alex", "usr_ava", "usr_emma", "usr_liam", "usr_sophia"]);
    expect(notified.every((item) => item.type === "deliverable.approved" && item.href.startsWith("/w/kinetic/"))).toBe(true);
  });

  it("is idempotent: a repeated request for the same version returns the existing decision", () => {
    const ctx = client("usr_daniel");
    const first = applyClientDecision(db, ctx, "dlv_homepage", { decision: "approved", version: 3 }, NOW);
    const count = db.approvals.length;
    const audits = db.auditLogs.length;
    const second = applyClientDecision(db, ctx, "dlv_homepage", { decision: "approved", version: 3 }, NOW);
    expect(second.kind).toBe("existing");
    if (first.kind === "decided" && second.kind === "existing") expect(second.approval.id).toBe(first.approval.id);
    expect(db.approvals.length).toBe(count);
    expect(db.auditLogs.length).toBe(audits);
  });

  it("rejects a decision on an older version (stale tab)", () => {
    const outcome = applyClientDecision(db, client("usr_daniel"), "dlv_homepage", { decision: "approved", version: 1 }, NOW);
    expect(outcome).toEqual({ kind: "stale", currentVersion: 3 });
    expect(deliverable("dlv_homepage").status).toBe("in_review");
  });

  it("does not let viewers decide", () => {
    const outcome = applyClientDecision(db, client("usr_chris"), "dlv_homepage", { decision: "approved", version: 3 }, NOW);
    expect(outcome.kind).toBe("not_allowed");
    expect(deliverable("dlv_homepage").status).toBe("in_review");
  });

  it("hides other clients' work, other tenants' work and drafts as not found", () => {
    const ctx = client("usr_daniel");
    expect(applyClientDecision(db, ctx, "dlv_screens", { decision: "approved", version: 1 }, NOW).kind).toBe("not_found");
    expect(applyClientDecision(db, ctx, "dlv_orbit_wire", { decision: "approved", version: 1 }, NOW).kind).toBe("not_found");
    expect(applyClientDecision(db, ctx, "dlv_templates", { decision: "approved", version: 1 }, NOW).kind).toBe("not_found");
    expect(deliverable("dlv_screens").status).toBe("in_review");
  });

  it("returns an earlier decision instead of overwriting it", () => {
    // Daniel already requested changes on v1 of the tokens.
    const outcome = applyClientDecision(db, client("usr_daniel"), "dlv_tokens", { decision: "approved", version: 1 }, NOW);
    expect(outcome.kind === "existing" && outcome.approval.decision).toBe("changes_requested");
    expect(deliverable("dlv_tokens").status).toBe("changes_requested");
  });

  it("only decides on work that is in review", () => {
    deliverable("dlv_calendar").status = "approved";
    const outcome = applyClientDecision(db, client("usr_daniel"), "dlv_calendar", { decision: "changes_requested", version: 1, comment: "Too late?" }, NOW);
    expect(outcome.kind).toBe("not_allowed");
  });

  it("requesting changes moves the deliverable to changes requested", () => {
    const outcome = applyClientDecision(
      db,
      client("usr_daniel"),
      "dlv_calendar",
      { decision: "changes_requested", version: 1, comment: "Weeks 6 to 8 clash with our launch." },
      NOW,
    );
    expect(outcome.kind).toBe("decided");
    expect(deliverable("dlv_calendar").status).toBe("changes_requested");
    expect(db.auditLogs.at(-1)?.action).toBe("deliverable.changes_requested");
    // The milestone was waiting on the client; it goes back to work.
    expect(milestone("ms_seo_2").status).toBe("in_progress");
  });

  it("completes the approval milestone when the last blocker clears", () => {
    db.tasks.find((task) => task.id === "tsk_s04")!.status = "done";
    const outcome = applyClientDecision(db, client("usr_daniel"), "dlv_calendar", { decision: "approved", version: 1 }, NOW);
    expect(outcome.kind === "decided" && outcome.milestone?.to).toBe("completed");
    expect(milestone("ms_seo_2")).toMatchObject({ status: "completed", completedAt: NOW.toISOString() });
    expect(db.activity.some((event) => event.verb === "milestone.completed" && event.targetId === "ms_seo_2")).toBe(true);
  });

  it("leaves the milestone open while tasks are still open", () => {
    applyClientDecision(db, client("usr_daniel"), "dlv_homepage", { decision: "approved", version: 3 }, NOW);
    expect(milestone("ms_web_2").status).toBe("in_progress");
  });
});
