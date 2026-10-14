import { beforeEach, describe, expect, it } from "vitest";
import {
  canDecideOnDeliverable,
  canManageProject,
  canSubmitDeliverable,
  canViewDeliverable,
  getVisibleDeliverable,
  getVisibleProject,
  resolveClientContext,
  resolveTeamContext,
  visibleActivity,
  visibleComments,
  visibleFiles,
  visibleProjects,
  visibleTasks,
  type ClientContext,
  type TeamContext,
} from "@/lib/data/access";
import { createSeed } from "@/lib/data/seed";
import type { Database } from "@/lib/data/types";

const NOW = new Date("2026-10-15T12:00:00Z");
let db: Database;

beforeEach(() => {
  db = createSeed(NOW);
});

function team(userId: string, org = "kinetic"): TeamContext {
  const ctx = resolveTeamContext(db, userId, org);
  if (!ctx) throw new Error(`${userId} is not a member of ${org}`);
  return ctx;
}

function client(userId: string, org = "kinetic"): ClientContext {
  const ctx = resolveClientContext(db, userId, org);
  if (!ctx) throw new Error(`${userId} is not a client of ${org}`);
  return ctx;
}

describe("tenant resolution", () => {
  it("resolves a workspace only through an active membership", () => {
    expect(resolveTeamContext(db, "usr_alex", "kinetic")?.role).toBe("owner");
    expect(resolveTeamContext(db, "usr_alex", "lumen")?.role).toBe("manager");
    expect(resolveTeamContext(db, "usr_maya", "kinetic")).toBeNull();
    expect(resolveTeamContext(db, "usr_alex", "does-not-exist")).toBeNull();
  });

  it("ignores suspended memberships", () => {
    db.memberships.find((item) => item.id === "mem_k_liam")!.status = "suspended";
    expect(resolveTeamContext(db, "usr_liam", "kinetic")).toBeNull();
  });

  it("never treats a client user as a team member", () => {
    expect(resolveTeamContext(db, "usr_daniel", "kinetic")).toBeNull();
    expect(resolveClientContext(db, "usr_daniel", "kinetic")?.client.id).toBe("cli_acme");
    expect(resolveClientContext(db, "usr_daniel", "lumen")).toBeNull();
  });

  it("drops portal access when the client is archived", () => {
    db.clients.find((item) => item.id === "cli_acme")!.status = "archived";
    expect(resolveClientContext(db, "usr_daniel", "kinetic")).toBeNull();
  });
});

describe("cross-tenant isolation (IDOR/BOLA)", () => {
  it("a Kinetic owner cannot load a Lumen-only project by id through the Kinetic context", () => {
    const ctx = team("usr_alex", "kinetic");
    expect(getVisibleProject(db, ctx, "prj_orbit")).toBeNull();
    expect(getVisibleProject(db, ctx, "prj_website")?.id).toBe("prj_website");
  });

  it("a Lumen member cannot read Kinetic projects, deliverables or tasks", () => {
    const ctx = team("usr_maya", "lumen");
    expect(visibleProjects(db, ctx).every((project) => project.organizationId === "org_lumen")).toBe(true);
    expect(getVisibleProject(db, ctx, "prj_website")).toBeNull();
    expect(getVisibleDeliverable(db, ctx, "dlv_homepage")).toBeNull();
    expect(visibleTasks(db, ctx, db.tasks).some((task) => task.organizationId === "org_kinetic")).toBe(false);
  });

  it("activity from another workspace is never visible", () => {
    const ctx = team("usr_alex", "lumen");
    expect(visibleActivity(db, ctx, db.activity).every((event) => event.organizationId === "org_lumen")).toBe(true);
  });
});

describe("role-based project access", () => {
  it("owners and managers see every project in the workspace", () => {
    const kinetic = db.projects.filter((project) => project.organizationId === "org_kinetic").length;
    expect(visibleProjects(db, team("usr_alex")).length).toBe(kinetic);
    expect(visibleProjects(db, team("usr_emma")).length).toBe(kinetic);
  });

  it("team members only see projects they are assigned to", () => {
    const ctx = team("usr_ava");
    const ids = visibleProjects(db, ctx).map((project) => project.id).sort();
    expect(ids).toEqual(["prj_brand", "prj_campaign", "prj_seo", "prj_website"]);
    expect(getVisibleProject(db, ctx, "prj_ecom")).toBeNull();
  });

  it("billing managers see no project data", () => {
    const ctx = team("usr_olivia");
    expect(visibleProjects(db, ctx)).toHaveLength(0);
    expect(getVisibleDeliverable(db, ctx, "dlv_homepage")).toBeNull();
  });

  it("only leads and managers can manage or submit; contributors cannot", () => {
    const website = db.projects.find((project) => project.id === "prj_website")!;
    expect(canManageProject(db, team("usr_emma"), website)).toBe(true); // manager + lead
    expect(canManageProject(db, team("usr_liam"), website)).toBe(false); // contributor
    expect(canSubmitDeliverable(db, team("usr_liam"), website)).toBe(false);
    const seo = db.projects.find((project) => project.id === "prj_seo")!;
    expect(canManageProject(db, team("usr_ava"), seo)).toBe(true); // member but project lead
    expect(canSubmitDeliverable(db, team("usr_ava"), seo)).toBe(true);
  });
});

describe("client portal boundaries", () => {
  it("clients only see shared projects of their own client", () => {
    const ids = visibleProjects(db, client("usr_daniel")).map((project) => project.id).sort();
    expect(ids).toEqual(["prj_seo", "prj_website"]);
  });

  it("a client cannot open another client's deliverable in the same workspace", () => {
    expect(getVisibleDeliverable(db, client("usr_daniel"), "dlv_screens")).toBeNull(); // NovaTech
    expect(getVisibleDeliverable(db, client("usr_priya"), "dlv_screens")?.id).toBe("dlv_screens");
  });

  it("unshared projects stay hidden even from their own client", () => {
    db.clientMemberships.push({
      id: "clm_grace",
      organizationId: "org_kinetic",
      clientId: "cli_meridian",
      userId: "usr_zara",
      role: "approver",
      status: "active",
      joinedAt: NOW.toISOString(),
    });
    const ctx = client("usr_zara");
    expect(visibleProjects(db, ctx)).toHaveLength(0);
    expect(getVisibleProject(db, ctx, "prj_meridian")).toBeNull();
  });

  it("clients never see drafts, internal tasks, internal comments or internal files", () => {
    const ctx = client("usr_daniel");
    const draft = db.deliverables.find((item) => item.id === "dlv_templates")!;
    expect(canViewDeliverable(db, ctx, draft)).toBe(false);
    expect(visibleTasks(db, ctx, db.tasks).some((task) => !task.clientVisible)).toBe(false);
    expect(visibleComments(ctx, db.comments).some((item) => item.visibility === "internal")).toBe(false);
    expect(visibleFiles(ctx, db.files).some((item) => item.visibility === "internal")).toBe(false);
    expect(visibleActivity(db, ctx, db.activity).some((event) => event.visibility === "internal")).toBe(false);
  });

  it("only approvers can decide, and only while a version is in review", () => {
    const homepage = db.deliverables.find((item) => item.id === "dlv_homepage")!;
    expect(canDecideOnDeliverable(db, client("usr_daniel"), homepage)).toBe(true);
    expect(canDecideOnDeliverable(db, client("usr_chris"), homepage)).toBe(false); // viewer
    expect(canDecideOnDeliverable(db, team("usr_alex"), homepage)).toBe(false); // team can't approve for the client
    const approved = db.deliverables.find((item) => item.id === "dlv_sitemap")!;
    expect(canDecideOnDeliverable(db, client("usr_daniel"), approved)).toBe(false);
  });
});
