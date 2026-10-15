import "server-only";
import { notFound } from "next/navigation";
import { requireTeamContext } from "@/lib/auth/context";
import { assignableRoles, can, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { checkLimit, getPlan } from "@/lib/billing/plans";
import { formatRelative } from "@/lib/utils";
import type { TeamContext } from "../access";
import { getDb } from "../store";
import { newestFirst, toUserLite, type UserLite } from "../views";
import type { Database, Invitation, OrgRole } from "../types";

const ROLE_ORDER: OrgRole[] = ["owner", "manager", "member", "billing"];

export function invitationIsPending(invitation: Invitation, now: Date) {
  return invitation.status === "pending" && Date.parse(invitation.expiresAt) > now.getTime();
}

/**
 * Seats = active members + pending team invitations, so an invitation
 * reserves its seat until it's accepted, revoked or expires.
 */
export function seatUsage(db: Database, orgId: string, now: Date) {
  const subscription = db.subscriptions.find((item) => item.organizationId === orgId);
  const plan = getPlan(subscription?.planKey ?? "starter");
  const members = db.memberships.filter((item) => item.organizationId === orgId && item.status === "active").length;
  const pending = db.invitations.filter((item) => item.organizationId === orgId && item.kind === "team" && invitationIsPending(item, now)).length;
  return { planName: plan.name, members, pending, limit: checkLimit(plan, "seats", members + pending) };
}

export function roleOptions(actor: OrgRole) {
  return assignableRoles(actor).map((role) => ({ value: role, label: ROLE_LABELS[role], description: ROLE_DESCRIPTIONS[role] }));
}

export interface MemberRow {
  membershipId: string;
  user: UserLite;
  role: OrgRole;
  roleLabel: string;
  projects: number;
  leads: number;
  lastActiveText: string;
  online: boolean;
  joinedAt: string;
  isSelf: boolean;
  /** Roles this viewer may switch the member to (empty = read-only). */
  roleChoices: OrgRole[];
  canRemove: boolean;
  /** Why the controls are locked, shown as a tooltip/hint. */
  lockReason: string | null;
}

export interface TeamInvitationRow {
  id: string;
  email: string;
  role: OrgRole;
  roleLabel: string;
  status: "pending" | "expired";
  invitedBy: string;
  sentText: string;
  expiresText: string;
  canManage: boolean;
}

/** Shared role rules used by the page and re-checked by every team action. */
export function memberPermissions(ctx: TeamContext, target: { userId: string; role: OrgRole }, activeOwners: number) {
  const isSelf = target.userId === ctx.user.id;
  const assignable = assignableRoles(ctx.role);
  const lastOwner = target.role === "owner" && activeOwners <= 1;
  if (isSelf) return { roleChoices: [] as OrgRole[], canRemove: false, lockReason: "You can't change your own role or remove yourself." };
  const managesTarget = assignable.includes(target.role);
  const roleChoices = can(ctx.role, "team.manage_roles") && managesTarget && !lastOwner ? assignable : [];
  const canRemove = can(ctx.role, "team.invite") && managesTarget && !lastOwner;
  let lockReason: string | null = null;
  if (lastOwner) lockReason = "Every workspace needs at least one owner.";
  else if (!managesTarget) lockReason = `Only owners can change a ${ROLE_LABELS[target.role].toLowerCase()}.`;
  return { roleChoices, canRemove, lockReason };
}

export async function getTeam(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "team.view")) notFound();
  const db = await getDb();
  const now = new Date();

  const memberships = db.memberships.filter((item) => item.organizationId === ctx.org.id && item.status === "active");
  const activeOwners = memberships.filter((item) => item.role === "owner").length;
  const orgProjectIds = new Set(db.projects.filter((project) => project.organizationId === ctx.org.id).map((project) => project.id));

  const members: MemberRow[] = memberships
    .map((membership) => {
      const user = db.users.find((item) => item.id === membership.userId);
      if (!user) return null;
      const projectRows = db.projectMembers.filter((item) => item.userId === user.id && orgProjectIds.has(item.projectId));
      const rules = memberPermissions(ctx, { userId: user.id, role: membership.role }, activeOwners);
      const lastActive = user.lastActiveAt ? Date.parse(user.lastActiveAt) : null;
      return {
        membershipId: membership.id,
        user: toUserLite(user),
        role: membership.role,
        roleLabel: ROLE_LABELS[membership.role],
        projects: projectRows.length,
        leads: projectRows.filter((item) => item.projectRole === "lead").length,
        lastActiveText: user.lastActiveAt ? formatRelative(user.lastActiveAt, now) : "Never",
        online: lastActive !== null && now.getTime() - lastActive < 15 * 60 * 1000,
        joinedAt: membership.joinedAt,
        isSelf: user.id === ctx.user.id,
        ...rules,
      } satisfies MemberRow;
    })
    .filter((row): row is MemberRow => row !== null)
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.user.name.localeCompare(b.user.name));

  const assignable = assignableRoles(ctx.role);
  const invitations: TeamInvitationRow[] = newestFirst(
    db.invitations.filter((item) => item.organizationId === ctx.org.id && item.kind === "team" && (item.status === "pending" || item.status === "expired")),
  ).map((item) => {
    const role = item.role as OrgRole;
    return {
      id: item.id,
      email: item.email,
      role,
      roleLabel: ROLE_LABELS[role] ?? role,
      status: invitationIsPending(item, now) ? "pending" : "expired",
      invitedBy: db.users.find((user) => user.id === item.invitedByUserId)?.name ?? "Someone",
      sentText: formatRelative(item.createdAt, now),
      expiresText: formatRelative(item.expiresAt, now),
      canManage: can(ctx.role, "team.invite") && assignable.includes(role),
    };
  });

  const usage = seatUsage(db, ctx.org.id, now);
  const counts: Record<OrgRole, number> = { owner: 0, manager: 0, member: 0, billing: 0 };
  for (const member of members) counts[member.role] += 1;

  return {
    base: `/w/${ctx.org.slug}`,
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    viewerRole: ctx.role,
    members,
    invitations,
    usage,
    roleCounts: counts,
    roleOptions: roleOptions(ctx.role),
    can: {
      invite: can(ctx.role, "team.invite"),
      manageRoles: can(ctx.role, "team.manage_roles"),
    },
  };
}

export type TeamPage = Awaited<ReturnType<typeof getTeam>>;

export async function getInviteForm(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "team.invite")) notFound();
  const db = await getDb();
  const now = new Date();
  return {
    base: `/w/${ctx.org.slug}`,
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    roleOptions: roleOptions(ctx.role),
    defaultRole: (assignableRoles(ctx.role).includes("member") ? "member" : assignableRoles(ctx.role)[0]) as OrgRole,
    usage: seatUsage(db, ctx.org.id, now),
  };
}
