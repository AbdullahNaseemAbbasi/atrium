"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { CLIENT_ROLE_LABELS, ROLE_LABELS } from "@/lib/auth/permissions";
import { checkLimit, getPlan } from "@/lib/billing/plans";
import type { ClientContext, TeamContext } from "@/lib/data/access";
import { notify, recordAudit } from "@/lib/data/events";
import { getDbForInvitation, newId, saveDb } from "@/lib/data/store";
import type { ClientRole, OrgRole } from "@/lib/data/types";
import { fail, type ActionState } from "./result";

const TEAM_ROLES: OrgRole[] = ["owner", "manager", "member", "billing"];
const CLIENT_ROLES: ClientRole[] = ["approver", "viewer"];

/**
 * Accepts a workspace or client-portal invitation for the signed-in user.
 * The token is the invitation id from the link; everything else (workspace,
 * role, client) comes from the stored invitation, never from the form.
 * Used with `useActionState(acceptInvitation.bind(null, token), null)`.
 */
export async function acceptInvitation(token: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in with the invited email address to accept this invitation.");

  const db = await getDbForInvitation(token);
  const invitation = db.invitations.find((item) => item.id === token);
  if (!invitation) return fail("This invitation doesn't exist any more.");
  const org = db.organizations.find((item) => item.id === invitation.organizationId);
  if (!org) return fail("This invitation doesn't exist any more.");

  const now = new Date();
  if (invitation.status === "revoked") return fail(`${org.name} withdrew this invitation.`);
  if (invitation.status === "accepted") return fail("This invitation has already been used. Sign in to open the workspace.");
  if (invitation.status === "expired" || Date.parse(invitation.expiresAt) <= now.getTime()) {
    return fail("This invitation has expired. Ask the person who invited you to send a new one.");
  }
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return fail(`You're signed in as ${user.email}, but this invitation was sent to a different address. Sign in with the invited email to accept it.`);
  }

  const joinedAt = now.toISOString();
  let destination: string;

  if (invitation.kind === "team") {
    const role = invitation.role as OrgRole;
    if (!TEAM_ROLES.includes(role)) return fail("This invitation has an unknown role. Ask for a new one.");

    const existing = db.memberships.find((item) => item.organizationId === org.id && item.userId === user.id);
    if (existing?.status === "suspended") {
      return fail(`Your access to ${org.name} is suspended. Ask a workspace owner to restore it.`);
    }

    if (existing) {
      // Already on the team: close the invitation and open the workspace.
      invitation.status = "accepted";
      invitation.acceptedAt = joinedAt;
      await saveDb();
      redirect(`/w/${org.slug}`);
    }

    // Seats are checked when the invitation is used, not only when it is sent.
    const subscription = db.subscriptions.find((item) => item.organizationId === org.id);
    const plan = getPlan(subscription?.planKey ?? "starter");
    const seatsUsed = db.memberships.filter((item) => item.organizationId === org.id && item.status === "active").length;
    if (!checkLimit(plan, "seats", seatsUsed).allowed) {
      return fail(
        `${org.name} is using all ${plan.limits.seats} seats on the ${plan.name} plan. Ask an owner to upgrade or free a seat, then try again.`,
      );
    }
    const membership = { id: newId("mem"), organizationId: org.id, userId: user.id, role, status: "active" as const, joinedAt };
    db.memberships.push(membership);

    invitation.status = "accepted";
    invitation.acceptedAt = joinedAt;

    const ctx: TeamContext = { kind: "team", user, org, membership, role: membership.role };
    recordAudit(db, ctx, {
      action: "invitation.accepted",
      entityType: "membership",
      entityId: membership.id,
      summary: `${user.name} joined as ${ROLE_LABELS[membership.role]} by accepting an invitation`,
      metadata: { from: "none", to: membership.role, invitationId: invitation.id },
    });
    notify(db, ctx, [invitation.invitedByUserId], {
      type: "invitation.accepted",
      title: `${user.name} joined ${org.name}`,
      body: `Accepted your invitation as ${ROLE_LABELS[membership.role]}.`,
      href: `/w/${org.slug}/team`,
    });
    destination = `/w/${org.slug}?joined=1`;
  } else {
    const role = invitation.role as ClientRole;
    if (!CLIENT_ROLES.includes(role)) return fail("This invitation has an unknown role. Ask for a new one.");
    const client = db.clients.find(
      (item) => item.id === invitation.clientId && item.organizationId === org.id && item.status !== "archived",
    );
    if (!client) return fail(`${org.name} no longer has a portal for this invitation. Ask them for a new link.`);

    const existing = db.clientMemberships.find(
      (item) => item.organizationId === org.id && item.clientId === client.id && item.userId === user.id,
    );
    if (existing?.status === "suspended") {
      return fail(`Your portal access is suspended. Contact ${org.name} to restore it.`);
    }
    if (existing) {
      invitation.status = "accepted";
      invitation.acceptedAt = joinedAt;
      await saveDb();
      redirect(`/portal/${org.slug}`);
    }

    const clientMembership = { id: newId("clm"), organizationId: org.id, clientId: client.id, userId: user.id, role, status: "active" as const, joinedAt };
    db.clientMemberships.push(clientMembership);

    invitation.status = "accepted";
    invitation.acceptedAt = joinedAt;

    const ctx: ClientContext = { kind: "client", user, org, client, clientMembership, role: clientMembership.role };
    recordAudit(db, ctx, {
      action: "invitation.accepted",
      entityType: "client_membership",
      entityId: clientMembership.id,
      summary: `${user.name} joined the ${client.companyName} portal as ${CLIENT_ROLE_LABELS[clientMembership.role]}`,
      metadata: { role: clientMembership.role, invitationId: invitation.id },
    });
    notify(db, ctx, [invitation.invitedByUserId], {
      type: "invitation.accepted",
      title: `${user.name} joined the ${client.companyName} portal`,
      body: `Accepted your invitation as ${CLIENT_ROLE_LABELS[clientMembership.role]}.`,
      href: `/w/${org.slug}/clients/${client.id}`,
    });
    destination = `/portal/${org.slug}?joined=1`;
  }

  await saveDb();
  revalidatePath("/", "layout");
  await saveDb();
  redirect(destination);
}
