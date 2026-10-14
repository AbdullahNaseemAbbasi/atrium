import { describe, expect, it, vi } from "vitest";

// The page loader needs a request; the pure formulas below don't.
vi.mock("@/lib/auth/context", () => ({ requireTeamContext: vi.fn() }));

import { createSeed } from "@/lib/data/seed";
import {
  AT_RISK_GAP,
  decisionTurnarounds,
  firstPassApproval,
  median,
  openTasksByMember,
  projectHealth,
  tasksCompletedBetween,
  tasksCompletedPerWeek,
  turnaroundByClient,
} from "@/lib/data/queries/reports";

const NOW = new Date("2026-10-15T12:00:00Z");
const day = (offset: number) => new Date(NOW.getTime() + offset * 86400000).toISOString();

describe("median", () => {
  it("handles empty, odd and even lists", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("tasks completed per week", () => {
  it("buckets completions into 12 Monday weeks, oldest first, ending with this week", () => {
    const weeks = tasksCompletedPerWeek(
      [{ completedAt: day(0) }, { completedAt: day(-1) }, { completedAt: day(-7) }, { completedAt: day(-200) }, { completedAt: undefined }],
      NOW,
    );
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)).toMatchObject({ label: "This week", count: 2 }); // Thu 15 Oct + Wed 14 Oct
    expect(weeks.at(-2)!.count).toBe(1);
    expect(weeks.reduce((sum, week) => sum + week.count, 0)).toBe(3); // 200 days ago is outside the window
  });

  it("counts a rolling 30-day window for the KPI", () => {
    const tasks = [{ completedAt: day(-1) }, { completedAt: day(-29) }, { completedAt: day(-31) }, { completedAt: day(1) }];
    expect(tasksCompletedBetween(tasks, NOW, 30)).toBe(2);
  });
});

describe("review turnaround", () => {
  const deliverables = [{ id: "d1", projectId: "p1", currentVersion: 2, submittedAt: day(-3) }];
  const versions = [
    { deliverableId: "d1", version: 1, createdAt: day(-10) },
    { deliverableId: "d1", version: 2, createdAt: day(-4) },
  ];
  const approvals = [
    { deliverableId: "d1", version: 1, decision: "changes_requested" as const, decidedAt: day(-8) },
    { deliverableId: "d1", version: 2, decision: "approved" as const, decidedAt: day(-2) },
  ];

  it("measures from upload for earlier versions and from submittedAt for the current version", () => {
    expect(decisionTurnarounds(deliverables, versions, approvals).map((item) => item.days)).toEqual([2, 1]);
  });

  it("takes the median per client and leaves clients without decisions at null", () => {
    const rows = turnaroundByClient(
      [
        { id: "c1", companyName: "Acme", brandHue: 1 },
        { id: "c2", companyName: "Quiet", brandHue: 2 },
      ],
      [{ id: "p1", clientId: "c1" }],
      deliverables,
      versions,
      approvals,
    );
    expect(rows[0]).toMatchObject({ clientName: "Acme", medianDays: 1.5, decisions: 2 });
    expect(rows[1]).toMatchObject({ clientName: "Quiet", medianDays: null, decisions: 0 });
  });
});

describe("first-pass approval", () => {
  it("counts deliverables whose earliest decision approves version 1", () => {
    const approvals = [
      { deliverableId: "a", version: 1, decision: "approved" as const, decidedAt: day(-5) },
      { deliverableId: "b", version: 1, decision: "changes_requested" as const, decidedAt: day(-9) },
      { deliverableId: "b", version: 2, decision: "approved" as const, decidedAt: day(-4) },
      { deliverableId: "c", version: 2, decision: "approved" as const, decidedAt: day(-3) },
    ];
    // "d" has no decision yet and is left out of both sides.
    expect(firstPassApproval(["a", "b", "c", "d"], approvals)).toEqual({ decided: 3, firstPass: 1, rate: 33 });
    expect(firstPassApproval(["d"], approvals)).toEqual({ decided: 0, firstPass: 0, rate: null });
  });

  it("matches the seeded Kinetic data: 2 of 9 decided deliverables", () => {
    const db = createSeed(NOW);
    const ids = db.deliverables.filter((item) => item.organizationId === "org_kinetic").map((item) => item.id);
    expect(firstPassApproval(ids, db.approvals)).toEqual({ decided: 9, firstPass: 2, rate: 22 });
  });
});

describe("open tasks by member", () => {
  it("counts open and overdue per assignee, keeps idle members and adds an unassigned row", () => {
    const rows = openTasksByMember(
      [
        { id: "u1", name: "Ann", avatarHue: 1 },
        { id: "u2", name: "Bo", avatarHue: 2 },
      ],
      [
        { status: "todo", dueAt: day(-2), assigneeUserId: "u1" },
        { status: "in_progress", dueAt: day(3), assigneeUserId: "u1" },
        { status: "done", dueAt: day(-5), assigneeUserId: "u2" },
        { status: "blocked", dueAt: undefined, assigneeUserId: undefined },
      ],
      NOW,
    );
    expect(rows).toEqual([
      { userId: "u1", name: "Ann", avatarHue: 1, open: 2, overdue: 1 },
      { userId: null, name: "Unassigned", avatarHue: 215, open: 1, overdue: 0 },
      { userId: "u2", name: "Bo", avatarHue: 2, open: 0, overdue: 0 },
    ]);
  });
});

describe("project health", () => {
  it("is late once the due date passes without completion", () => {
    expect(projectHealth(90, "in_progress", day(-30), day(-1), NOW).health).toBe("late");
    expect(projectHealth(100, "completed", day(-30), day(-1), NOW).health).toBe("on_track");
  });

  it(`is at risk when progress trails time elapsed by more than ${AT_RISK_GAP} points`, () => {
    // 50% of the schedule has passed.
    expect(projectHealth(34, "in_progress", day(-10), day(10), NOW)).toEqual({ elapsed: 50, gap: -16, health: "at_risk" });
    expect(projectHealth(35, "in_progress", day(-10), day(10), NOW)).toEqual({ elapsed: 50, gap: -15, health: "on_track" });
  });

  it("handles projects that haven't started or have no dates", () => {
    expect(projectHealth(0, "planning", day(4), day(40), NOW).health).toBe("not_started");
    expect(projectHealth(10, "in_progress", undefined, day(40), NOW)).toEqual({ elapsed: null, gap: null, health: "on_track" });
  });
});
