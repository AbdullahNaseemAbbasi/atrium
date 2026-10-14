import "server-only";
import { connection } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/auth/context";
import { CLIENT_ROLE_DESCRIPTIONS, CLIENT_ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { formatRelative } from "@/lib/utils";
import { clientPortalsFor, teamWorkspacesFor } from "../access";
import { getDb } from "../store";
import type { ClientRole, Database, Invitation, OrgRole, User } from "../types";

/**
 * Invitation links are opened by people who may not have an account yet, so
 * this module reads invitations without a tenant context. It only ever
 * returns the workspace name, the offered role and the inviter's name; the
 * invited email address, client details and workspace slug never leave the
 * server unless the viewer is already a member.
 */

export type InvitationState = "valid" | "expired" | "revoked" | "accepted";

export interface InvitationPreview {
  token: string;
  state: InvitationState;
  orgName: string;
  orgHue: number;
  kind: Invitation["kind"];
  roleLabel: string;
  roleDescription: string;
  inviterName: string;
  expiresAt: string;
  /** "in 5 days" / "13 days ago" */
  expiresRelative: string;
  viewer: {
    name: string;
    email: string;
    /** True when the signed-in email is the one the invitation was sent to. */
    emailMatches: boolean;
    /** Where to go when the viewer already has this access. */
    memberHome: string | null;
  } | null;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function roleText(invitation: Invitation) {
  if (invitation.kind === "client") {
    const role = invitation.role as ClientRole;
    return { label: `Client ${CLIENT_ROLE_LABELS[role]?.toLowerCase() ?? "user"}`, description: CLIENT_ROLE_DESCRIPTIONS[role] ?? "" };
  }
  const role = invitation.role as OrgRole;
  return { label: ROLE_LABELS[role] ?? "Team member", description: ROLE_DESCRIPTIONS[role] ?? "" };
}

/** Pending invitations past their expiry date count as expired. */
export function invitationState(invitation: Invitation, now: Date): InvitationState {
  if (invitation.status === "pending" && Date.parse(invitation.expiresAt) <= now.getTime()) return "expired";
  if (invitation.status === "pending") return "valid";
  return invitation.status;
}

function memberHomeFor(db: Database, user: User, invitation: Invitation) {
  if (invitation.kind === "team") {
    const workspace = teamWorkspacesFor(db, user.id).find((item) => item.org.id === invitation.organizationId);
    return workspace ? `/w/${workspace.org.slug}` : null;
  }
  const portal = clientPortalsFor(db, user.id).find(
    (item) => item.org.id === invitation.organizationId && item.client.id === invitation.clientId,
  );
  return portal ? `/portal/${portal.org.slug}` : null;
}

export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  // Signed-out visitors never reach getCurrentUser's connection() call, and
  // the demo store plus expiry checks need the request clock.
  await connection();
  if (!TOKEN_PATTERN.test(token)) return null;

  const db = getDb();
  const invitation = db.invitations.find((item) => item.id === token);
  if (!invitation) return null;
  const org = db.organizations.find((item) => item.id === invitation.organizationId);
  if (!org) return null;

  const now = new Date();
  const inviter = db.users.find((item) => item.id === invitation.invitedByUserId);
  const user = await getCurrentUser();
  const role = roleText(invitation);

  return {
    token: invitation.id,
    state: invitationState(invitation, now),
    orgName: org.name,
    orgHue: org.brandHue,
    kind: invitation.kind,
    roleLabel: role.label,
    roleDescription: role.description,
    inviterName: inviter?.name ?? "A workspace admin",
    expiresAt: invitation.expiresAt,
    expiresRelative: formatRelative(invitation.expiresAt, now),
    viewer: user
      ? {
          name: user.name,
          email: user.email,
          emailMatches: user.email.toLowerCase() === invitation.email.toLowerCase(),
          memberHome: memberHomeFor(db, user, invitation),
        }
      : null,
  };
}

export interface PendingInvite {
  token: string;
  orgName: string;
  orgHue: number;
  kind: Invitation["kind"];
  roleLabel: string;
  inviterName: string;
  expiresRelative: string;
}

export interface OnboardingState {
  user: { name: string; firstName: string; email: string; timezone: string };
  /** Open invitations sent to the signed-in user's own email address. */
  pendingInvites: PendingInvite[];
  /** First workspace or portal the user can already open (for a "back" link). */
  existing: { name: string; href: string } | null;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const user = await requireUser();
  const db = getDb();
  const now = new Date();
  const email = user.email.toLowerCase();

  const pendingInvites = db.invitations
    .filter((item) => item.email.toLowerCase() === email && invitationState(item, now) === "valid")
    .filter((item) => !memberHomeFor(db, user, item))
    .map((item): PendingInvite => {
      const org = db.organizations.find((entry) => entry.id === item.organizationId);
      return {
        token: item.id,
        orgName: org?.name ?? "A workspace",
        orgHue: org?.brandHue ?? 190,
        kind: item.kind,
        roleLabel: roleText(item).label,
        inviterName: db.users.find((entry) => entry.id === item.invitedByUserId)?.name ?? "A workspace admin",
        expiresRelative: formatRelative(item.expiresAt, now),
      };
    });

  const team = teamWorkspacesFor(db, user.id)[0];
  const portal = clientPortalsFor(db, user.id)[0];
  const existing = team
    ? { name: team.org.name, href: `/w/${team.org.slug}` }
    : portal
      ? { name: `${portal.client.companyName} portal`, href: `/portal/${portal.org.slug}` }
      : null;

  return {
    user: { name: user.name, firstName: user.name.split(" ")[0] ?? user.name, email: user.email, timezone: user.timezone },
    pendingInvites,
    existing,
  };
}
