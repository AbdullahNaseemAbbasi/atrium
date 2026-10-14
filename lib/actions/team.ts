"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { z } from "zod";
import { requireTeamContext } from "@/lib/auth/context";
import { assignableRoles, can, ROLE_LABELS } from "@/lib/auth/permissions";
import { recordActivity, recordAudit } from "@/lib/data/events";
import { invitationIsPending, memberPermissions, seatUsage } from "@/lib/data/queries/team";
import { getDb, newId } from "@/lib/data/store";
import type { OrgRole } from "@/lib/data/types";
import { fail, formValues, ok, type ActionState } from "./result";

const MAX_INVITES = 10;
const INVITE_DAYS = 7;

const roleSchema = z.enum(["owner", "manager", "member", "billing"], "Choose a role.");
const idSchema = z.string().trim().min(1).max(80);
const emailSchema = z.email();

/** Splits a pasted list on commas, semicolons, whitespace and new lines. */
function splitEmails(raw: string) {
  return raw
    .split(/[\s,;]+/)
    .map((item) => item.trim().replace(/^<|>$/g, "").toLowerCase())
    .filter(Boolean);
}

export async function inviteMembers(orgSlug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "team.invite")) return fail("You don't have permission to invite people.");
  const values = formValues(formData);

  const parsedRole = roleSchema.safeParse(formData.get("role"));
  if (!parsedRole.success || !assignableRoles(ctx.role).includes(parsedRole.data)) {
    return fail("Please fix the highlighted fields.", { role: ["Choose a role you're allowed to assign."] }, values);
  }
  const role = parsedRole.data;

  const raw = String(formData.get("emails") ?? "");
  if (raw.length > 4000) return fail("Please fix the highlighted fields.", { emails: ["That list is too long."] }, values);
  const emails = [...new Set(splitEmails(raw))];
  if (emails.length === 0) return fail("Please fix the highlighted fields.", { emails: ["Add at least one email address."] }, values);
  const invalidEmails = emails.filter((email) => !emailSchema.safeParse(email).success || email.length > 160);
  if (invalidEmails.length > 0) {
    return fail("Please fix the highlighted fields.", { emails: [`Check ${invalidEmails.slice(0, 3).join(", ")}${invalidEmails.length > 3 ? "…" : ""}. ${invalidEmails.length === 1 ? "It isn't" : "They aren't"} a valid email.`] }, values);
  }
  if (emails.length > MAX_INVITES) {
    return fail("Please fix the highlighted fields.", { emails: [`Invite up to ${MAX_INVITES} people at a time. You added ${emails.length}.`] }, values);
  }

  const db = getDb();
  const now = new Date();
  const memberEmails = new Set(
    db.memberships
      .filter((item) => item.organizationId === ctx.org.id && item.status === "active")
      .map((item) => db.users.find((user) => user.id === item.userId)?.email.toLowerCase())
      .filter(Boolean),
  );
  const existing = emails.filter((email) => memberEmails.has(email));
  if (existing.length > 0) {
    return fail("Please fix the highlighted fields.", { emails: [`Already on the team: ${existing.join(", ")}. Remove ${existing.length === 1 ? "it" : "them"} from the list.`] }, values);
  }
  const portalEmails = new Set(
    db.clientMemberships
      .filter((item) => item.organizationId === ctx.org.id && item.status === "active")
      .map((item) => db.users.find((user) => user.id === item.userId)?.email.toLowerCase())
      .filter(Boolean),
  );
  const clients = emails.filter((email) => portalEmails.has(email));
  if (clients.length > 0) {
    return fail("Please fix the highlighted fields.", { emails: [`${clients.join(", ")} ${clients.length === 1 ? "is a client portal user" : "are client portal users"}. Use a different address for team access.`] }, values);
  }
  const pending = emails.filter((email) =>
    db.invitations.some((item) => item.organizationId === ctx.org.id && item.kind === "team" && item.email.toLowerCase() === email && invitationIsPending(item, now)),
  );
  if (pending.length > 0) {
    return fail("Please fix the highlighted fields.", { emails: [`Already invited: ${pending.join(", ")}. Re-send from the team page instead.`] }, values);
  }

  // Seat limit is enforced here, not just in the UI.
  const usage = seatUsage(db, ctx.org.id, now);
  if (usage.limit.limit !== null && usage.members + usage.pending + emails.length > usage.limit.limit) {
    const left = Math.max(usage.limit.limit - usage.members - usage.pending, 0);
    return fail(
      left === 0
        ? `All ${usage.limit.limit} seats on your ${usage.planName} plan are taken (pending invitations hold a seat). Remove someone, revoke an invitation or upgrade.`
        : `Your ${usage.planName} plan has ${left} ${left === 1 ? "seat" : "seats"} left and you're inviting ${emails.length}. Invite fewer people or upgrade.`,
      { emails: [`${left} ${left === 1 ? "seat" : "seats"} left on your plan.`] },
      values,
    );
  }

  for (const email of emails) {
    const id = newId("inv");
    db.invitations.push({
      id,
      organizationId: ctx.org.id,
      email,
      kind: "team",
      role,
      status: "pending",
      invitedByUserId: ctx.user.id,
      createdAt: now.toISOString(),
      expiresAt: addDays(now, INVITE_DAYS).toISOString(),
    });
    recordAudit(db, ctx, { action: "member.invited", entityType: "invitation", entityId: id, summary: `Invited ${email} as ${ROLE_LABELS[role]}`, metadata: { role } });
    recordActivity(db, ctx, { verb: "member.invited", targetType: "member", targetId: id, targetLabel: email, visibility: "internal" });
  }

  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  redirect(`/w/${ctx.org.slug}/team?invited=${emails.length}`);
}

/* ---------- Members ---------- */

async function loadMember(orgSlug: string, membershipId: string) {
  const ctx = await requireTeamContext(orgSlug);
  const db = getDb();
  if (!idSchema.safeParse(membershipId).success) return null;
  const membership = db.memberships.find((item) => item.id === membershipId && item.organizationId === ctx.org.id && item.status === "active");
  const user = membership ? db.users.find((item) => item.id === membership.userId) : undefined;
  if (!membership || !user) return null;
  const activeOwners = db.memberships.filter((item) => item.organizationId === ctx.org.id && item.status === "active" && item.role === "owner").length;
  return { ctx, db, membership, user, rules: memberPermissions(ctx, { userId: user.id, role: membership.role }, activeOwners), activeOwners };
}

export async function changeMemberRole(orgSlug: string, membershipId: string, role: OrgRole): Promise<ActionState> {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return fail("Choose a valid role.");
  const loaded = await loadMember(orgSlug, membershipId);
  if (!loaded) return fail("Member not found.");
  const { ctx, db, membership, user, rules, activeOwners } = loaded;
  if (membership.role === parsed.data) return ok();
  if (rules.roleChoices.length === 0 || !rules.roleChoices.includes(parsed.data)) {
    return fail(rules.lockReason ?? "You can't assign that role.");
  }
  // Belt and braces: never leave the workspace without an owner.
  if (membership.role === "owner" && parsed.data !== "owner" && activeOwners <= 1) return fail("Every workspace needs at least one owner.");

  const from = membership.role;
  membership.role = parsed.data;
  recordAudit(db, ctx, {
    action: "member.role_changed",
    entityType: "membership",
    entityId: membership.id,
    summary: `Changed ${user.name} from ${ROLE_LABELS[from]} to ${ROLE_LABELS[parsed.data]}`,
    metadata: { from, to: parsed.data },
  });
  refresh();
  return ok(`${user.name} is now ${parsed.data === "owner" ? "an" : "a"} ${ROLE_LABELS[parsed.data]}.`);
}

export async function removeMember(orgSlug: string, membershipId: string): Promise<ActionState> {
  const loaded = await loadMember(orgSlug, membershipId);
  if (!loaded) return fail("Member not found.");
  const { ctx, db, membership, user, rules } = loaded;
  if (!rules.canRemove) return fail(rules.lockReason ?? "You can't remove this member.");

  // Soft removal: the membership stays for history but no longer grants access.
  membership.status = "suspended";
  const orgProjectIds = new Set(db.projects.filter((project) => project.organizationId === ctx.org.id).map((project) => project.id));
  db.projectMembers = db.projectMembers.filter((item) => !(item.userId === user.id && orgProjectIds.has(item.projectId)));
  let unassigned = 0;
  for (const task of db.tasks) {
    if (task.organizationId === ctx.org.id && task.assigneeUserId === user.id && task.status !== "done") {
      task.assigneeUserId = undefined;
      unassigned += 1;
    }
  }
  recordAudit(db, ctx, {
    action: "member.removed",
    entityType: "membership",
    entityId: membership.id,
    summary: `Removed ${user.name} (${ROLE_LABELS[membership.role]}) from the workspace`,
    metadata: { role: membership.role, unassignedTasks: unassigned },
  });
  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  return ok(unassigned > 0 ? `${user.name} was removed. ${unassigned} open ${unassigned === 1 ? "task is" : "tasks are"} now unassigned.` : `${user.name} was removed.`);
}

/* ---------- Invitations ---------- */

async function loadTeamInvitation(orgSlug: string, invitationId: string) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "team.invite")) return null;
  if (!idSchema.safeParse(invitationId).success) return null;
  const db = getDb();
  const invitation = db.invitations.find((item) => item.id === invitationId && item.organizationId === ctx.org.id && item.kind === "team");
  if (!invitation || !assignableRoles(ctx.role).includes(invitation.role as OrgRole)) return null;
  return { ctx, db, invitation };
}

export async function revokeTeamInvitation(orgSlug: string, invitationId: string): Promise<ActionState> {
  const loaded = await loadTeamInvitation(orgSlug, invitationId);
  if (!loaded) return fail("Invitation not found.");
  const { ctx, db, invitation } = loaded;
  if (invitation.status !== "pending" && invitation.status !== "expired") return fail("This invitation can't be revoked any more.");
  invitation.status = "revoked";
  recordAudit(db, ctx, { action: "invitation.revoked", entityType: "invitation", entityId: invitation.id, summary: `Revoked invitation for ${invitation.email}` });
  refresh();
  return ok(`Invitation for ${invitation.email} revoked.`);
}

export async function resendTeamInvitation(orgSlug: string, invitationId: string): Promise<ActionState> {
  const loaded = await loadTeamInvitation(orgSlug, invitationId);
  if (!loaded) return fail("Invitation not found.");
  const { ctx, db, invitation } = loaded;
  if (invitation.status !== "pending" && invitation.status !== "expired") return fail("This invitation can't be sent again.");
  const now = new Date();
  const wasPending = invitationIsPending(invitation, now);
  if (!wasPending) {
    // An expired invitation released its seat; renewing it takes one again.
    const usage = seatUsage(db, ctx.org.id, now);
    if (!usage.limit.allowed) return fail(`All ${usage.limit.limit} seats on your ${usage.planName} plan are taken. Free a seat or upgrade first.`);
  }
  invitation.status = "pending";
  invitation.expiresAt = addDays(now, INVITE_DAYS).toISOString();
  recordAudit(db, ctx, {
    action: "member.invited",
    entityType: "invitation",
    entityId: invitation.id,
    summary: `Re-sent invitation to ${invitation.email} as ${ROLE_LABELS[invitation.role as OrgRole]}`,
    metadata: { role: invitation.role },
  });
  refresh();
  return ok(`Invitation re-sent to ${invitation.email}. It's valid for ${INVITE_DAYS} days.`);
}
