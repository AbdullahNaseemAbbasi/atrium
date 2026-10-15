"use server";

import { addDays } from "date-fns";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/context";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { checkLimit, getPlan } from "@/lib/billing/plans";
import type { TeamContext } from "@/lib/data/access";
import { recordActivity, recordAudit } from "@/lib/data/events";
import { getDb, isSlugTaken, newId, saveDb } from "@/lib/data/store";
import type { Invitation, Membership, Organization, Subscription } from "@/lib/data/types";
import {
  INDUSTRIES,
  INVITATION_DAYS,
  INVITE_ROLES,
  MAX_INVITES,
  TRIAL_DAYS,
  isValidTimeZone,
  slugIssue,
} from "@/components/onboarding/options";
import { fail, formValues, invalid, type ActionState } from "./result";

export interface SlugCheck {
  slug: string;
  available: boolean;
  message: string;
}

/** Live availability check for the onboarding wizard. Signed-in users only. */
export async function checkSlugAvailability(rawSlug: string): Promise<SlugCheck> {
  const slug = String(rawSlug ?? "").trim().toLowerCase();
  const user = await getCurrentUser();
  if (!user) return { slug, available: false, message: "Sign in to check workspace addresses." };
  const issue = slugIssue(slug);
  if (issue) return { slug, available: false, message: issue };
  const taken = await isSlugTaken(slug);
  return taken
    ? { slug, available: false, message: "That address is already taken. Try adding your city or a short word." }
    : { slug, available: true, message: "This address is available." };
}

const workspaceSchema = z
  .object({
    name: z.string().trim().min(2, "Use at least 2 characters.").max(60, "Keep the name under 60 characters."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .superRefine((value, ctx) => {
        const issue = slugIssue(value);
        if (issue) ctx.addIssue({ code: "custom", message: issue });
      }),
    timezone: z.string().refine(isValidTimeZone, "Choose a timezone."),
    industry: z.enum(INDUSTRIES, { error: "Choose the option closest to your business." }),
    plan: z.enum(["starter", "professional"], { error: "Choose a plan." }),
    invites: z
      .array(
        z.object({
          email: z.string().trim().toLowerCase().email("Enter a valid email address."),
          role: z.enum(INVITE_ROLES, { error: "Choose a role." }),
        }),
      )
      .max(MAX_INVITES, `Invite up to ${MAX_INVITES} people now. You can add more later.`),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.invites.forEach((invite, index) => {
      if (seen.has(invite.email)) {
        ctx.addIssue({ code: "custom", message: "This email is already in the list.", path: ["invites", index, "email"] });
      }
      seen.add(invite.email);
    });
  });

function readInvites(formData: FormData) {
  const emails = formData.getAll("inviteEmail").map(String);
  const roles = formData.getAll("inviteRole").map(String);
  return emails
    .map((email, index) => ({ email, role: roles[index] ?? "member" }))
    .filter((invite) => invite.email.trim() !== "");
}

function hueFor(slug: string) {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/**
 * Creates a workspace for the signed-in user: organization, owner membership,
 * subscription (Starter, or a Professional trial) and pending invitations.
 */
export async function createWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  const values = formValues(formData);
  const parsed = workspaceSchema.safeParse({ ...Object.fromEntries(formData), invites: readInvites(formData) });
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;

  const db = await getDb();
  if (await isSlugTaken(input.slug)) {
    return fail("That workspace address was taken a moment ago.", { slug: ["That address is already taken. Try another."] }, values);
  }

  const ownEmail = user.email.toLowerCase();
  const ownIndex = input.invites.findIndex((invite) => invite.email === ownEmail);
  if (ownIndex !== -1) {
    return fail("You'll be the owner, so there's no need to invite yourself.", { [`invites.${ownIndex}.email`]: ["That's your own email address."] }, values);
  }

  // The owner takes one seat; invitations must fit in the rest of the plan.
  const plan = getPlan(input.plan);
  if (!checkLimit(plan, "seats", 1, input.invites.length).allowed) {
    const room = Math.max((plan.limits.seats ?? 0) - 1, 0);
    const extra = input.invites.length - room;
    const message = `${plan.name} includes ${plan.limits.seats} seats, so it fits you and ${room === 1 ? "1 teammate" : `${room} teammates`}. Remove ${extra} invitation${extra === 1 ? "" : "s"} or start the Professional trial.`;
    return fail(message, { plan: [message] }, values);
  }

  const now = new Date();
  const createdAt = now.toISOString();

  const org: Organization = {
    id: newId("org"),
    name: input.name,
    slug: input.slug,
    timezone: input.timezone,
    industry: input.industry,
    brandHue: hueFor(input.slug),
    createdAt,
  };
  const membership: Membership = {
    id: newId("mem"),
    organizationId: org.id,
    userId: user.id,
    role: "owner",
    status: "active",
    joinedAt: createdAt,
  };
  const trial = input.plan === "professional";
  const trialEnds = addDays(now, TRIAL_DAYS).toISOString();
  const subscription: Subscription = {
    id: newId("sub"),
    organizationId: org.id,
    planKey: input.plan,
    status: trial ? "trialing" : "active",
    interval: "month",
    currentPeriodEnd: trial ? trialEnds : addDays(now, 30).toISOString(),
    cancelAtPeriodEnd: false,
    trialEndsAt: trial ? trialEnds : undefined,
  };

  db.organizations.push(org);
  db.memberships.push(membership);
  db.subscriptions.push(subscription);

  const ctx: TeamContext = { kind: "team", user, org, membership, role: "owner" };
  recordAudit(db, ctx, {
    action: "workspace.created",
    entityType: "organization",
    entityId: org.id,
    summary: `Created workspace ${org.name}`,
    metadata: { event: "created", slug: org.slug },
  });
  recordAudit(db, ctx, {
    action: "billing.plan_changed",
    entityType: "subscription",
    entityId: subscription.id,
    summary: trial ? `Started a ${TRIAL_DAYS}-day Professional trial` : "Started on the Starter plan",
    metadata: { from: "none", to: input.plan, trial },
  });

  for (const invite of input.invites) {
    const invitation: Invitation = {
      id: newId("inv"),
      organizationId: org.id,
      email: invite.email,
      kind: "team",
      role: invite.role,
      status: "pending",
      invitedByUserId: user.id,
      createdAt,
      expiresAt: addDays(now, INVITATION_DAYS).toISOString(),
    };
    db.invitations.push(invitation);
    recordAudit(db, ctx, {
      action: "member.invited",
      entityType: "invitation",
      entityId: invitation.id,
      summary: `Invited ${invite.email} as ${ROLE_LABELS[invite.role]}`,
      metadata: { role: invite.role },
    });
    recordActivity(db, ctx, {
      verb: "member.invited",
      targetType: "member",
      targetId: invitation.id,
      targetLabel: invite.email,
      visibility: "internal",
    });
  }

  await saveDb();
  redirect(`/w/${org.slug}?welcome=1`);
}
