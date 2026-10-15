"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { z } from "zod";
import { requireTeamContext } from "@/lib/auth/context";
import { can, CLIENT_ROLE_LABELS } from "@/lib/auth/permissions";
import { checkLimit, getPlan } from "@/lib/billing/plans";
import { recordActivity, recordAudit } from "@/lib/data/events";
import { getDb, newId, saveDb } from "@/lib/data/store";
import type { Client, ClientRole, Database } from "@/lib/data/types";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

/* ---------- Validation ---------- */

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => value || undefined);

const clientSchema = z.object({
  companyName: z.string().trim().min(2, "Use at least 2 characters.").max(80, "Keep it under 80 characters."),
  contactName: z.string().trim().min(2, "Add the main contact's name.").max(80, "Keep it under 80 characters."),
  email: z.string().trim().toLowerCase().max(160, "That email is too long.").pipe(z.email("Enter a valid email address.")),
  phone: optionalText(32, "Keep the phone number under 32 characters.").refine(
    (value) => !value || /^[+()\d\s.-]{6,32}$/.test(value),
    "Use digits, spaces and + ( ) - only.",
  ),
  website: optionalText(120, "Keep the website under 120 characters.")
    .transform((value) => value?.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase() || undefined)
    .refine((value) => !value || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(value), "Enter a domain like acme.example."),
  industry: z.string().trim().min(2, "Add an industry.").max(60, "Keep it under 60 characters."),
  status: z.enum(["active", "onboarding", "paused", "archived"], "Choose a status."),
  brandHue: z.coerce.number().int("Pick a brand colour.").min(0, "Pick a brand colour.").max(360, "Pick a brand colour."),
  notes: optionalText(1000, "Keep notes under 1,000 characters."),
});

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().max(160, "That email is too long.").pipe(z.email("Enter a valid email address.")),
  role: z.enum(["approver", "viewer"], "Choose a role."),
});

const idSchema = z.string().trim().min(1).max(80);
const roleSchema = z.enum(["approver", "viewer"]);
const accessSchema = z.enum(["active", "suspended"]);

const INVITE_DAYS = 7;

/* ---------- Helpers ---------- */

function planFor(db: Database, orgId: string) {
  const subscription = db.subscriptions.find((item) => item.organizationId === orgId);
  return getPlan(subscription?.planKey ?? "starter");
}

function countedClients(db: Database, orgId: string, excludeId?: string) {
  return db.clients.filter((client) => client.organizationId === orgId && client.status !== "archived" && client.id !== excludeId).length;
}

function nameTaken(db: Database, orgId: string, name: string, excludeId?: string) {
  const lower = name.toLowerCase();
  return db.clients.some((client) => client.organizationId === orgId && client.id !== excludeId && client.companyName.toLowerCase() === lower);
}

/** Field errors from zod plus the duplicate-name check, so every problem shows in one pass. */
async function invalidClient(error: z.ZodError, formData: FormData, orgId: string, excludeId?: string): Promise<ActionState> {
  const state = invalid(error, formValues(formData));
  const name = String(formData.get("companyName") ?? "").trim();
  if (state?.fieldErrors && name.length >= 2 && !state.fieldErrors.companyName && nameTaken((await getDb()), orgId, name, excludeId)) {
    state.fieldErrors.companyName = ["A client with this name already exists."];
  }
  return state;
}

async function manageAccessContext(orgSlug: string) {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "clients.manage_access")) return null;
  return { ctx, db: (await getDb()) };
}

/* ---------- Create & edit ---------- */

export async function createClient(orgSlug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "clients.manage")) return fail("You don't have permission to add clients.");

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return await invalidClient(parsed.error, formData, ctx.org.id);
  const input = parsed.data;
  if (input.status === "archived") {
    return fail("New clients can't start archived.", { status: ["Choose Active, Onboarding or Paused."] }, formValues(formData));
  }

  const db = await getDb();
  if (nameTaken(db, ctx.org.id, input.companyName)) {
    return fail("Please fix the highlighted fields.", { companyName: ["A client with this name already exists."] }, formValues(formData));
  }

  // Plan limits are enforced here, not just in the UI.
  const plan = planFor(db, ctx.org.id);
  const usage = checkLimit(plan, "clients", countedClients(db, ctx.org.id));
  if (!usage.allowed) {
    return fail(
      `Your ${plan.name} plan includes ${usage.limit} client portals and all of them are in use. Archive a client you no longer work with or upgrade your plan.`,
      undefined,
      formValues(formData),
    );
  }

  const id = newId("cli");
  const client: Client = {
    id,
    organizationId: ctx.org.id,
    companyName: input.companyName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    website: input.website,
    industry: input.industry,
    status: input.status,
    brandHue: input.brandHue,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  db.clients.push(client);

  recordAudit(db, ctx, { action: "client.created", entityType: "client", entityId: id, summary: `Created client ${client.companyName}` });
  recordActivity(db, ctx, { verb: "client.added", targetType: "client", targetId: id, targetLabel: client.companyName, visibility: "internal" });

  await saveDb();
  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  await saveDb();
  redirect(`/w/${ctx.org.slug}/clients/${id}?created=1`);
}

export async function updateClient(orgSlug: string, clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "clients.manage")) return fail("You don't have permission to edit clients.");
  const db = await getDb();
  const client = db.clients.find((item) => item.id === clientId && item.organizationId === ctx.org.id);
  if (!client) return fail("Client not found.");

  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return await invalidClient(parsed.error, formData, ctx.org.id, client.id);
  const input = parsed.data;
  if (nameTaken(db, ctx.org.id, input.companyName, client.id)) {
    return fail("Please fix the highlighted fields.", { companyName: ["Another client already uses this name."] }, formValues(formData));
  }

  const wasArchived = client.status === "archived";
  const archiving = !wasArchived && input.status === "archived";
  const restoring = wasArchived && input.status !== "archived";
  if (restoring) {
    const plan = planFor(db, ctx.org.id);
    const usage = checkLimit(plan, "clients", countedClients(db, ctx.org.id, client.id));
    if (!usage.allowed) {
      return fail(
        `Your ${plan.name} plan includes ${usage.limit} client portals and all of them are in use. Archive another client or upgrade before restoring this one.`,
        { status: ["Keep this client archived for now."] },
        formValues(formData),
      );
    }
  }

  Object.assign(client, {
    companyName: input.companyName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    website: input.website,
    industry: input.industry,
    status: input.status,
    brandHue: input.brandHue,
    notes: input.notes,
  });

  // Archiving closes the client portal for every portal user, so it is an access change.
  if (archiving || restoring) {
    recordAudit(db, ctx, {
      action: archiving ? "client.access_revoked" : "client.access_granted",
      entityType: "client",
      entityId: client.id,
      summary: archiving ? `Archived ${client.companyName} and closed its portal` : `Restored ${client.companyName} and reopened its portal`,
      metadata: { status: input.status },
    });
  }

  await saveDb();
  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  await saveDb();
  redirect(`/w/${ctx.org.slug}/clients/${client.id}?saved=1`);
}

/* ---------- Portal access ---------- */

export async function inviteClientUser(orgSlug: string, clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const scope = await manageAccessContext(orgSlug);
  if (!scope) return fail("Only owners and managers can give portal access.");
  const { ctx, db } = scope;
  const client = db.clients.find((item) => item.id === clientId && item.organizationId === ctx.org.id);
  if (!client) return fail("Client not found.");
  if (client.status === "archived") return fail("This client is archived. Change its status before inviting anyone.");

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));
  const { email, role } = parsed.data;
  const values = formValues(formData);
  const now = new Date();

  const user = db.users.find((item) => item.email.toLowerCase() === email);
  if (user) {
    if (db.memberships.some((item) => item.organizationId === ctx.org.id && item.userId === user.id && item.status === "active")) {
      return fail("Please fix the highlighted fields.", { email: ["This person is on your team. Portal access is for client contacts."] }, values);
    }
    const existing = db.clientMemberships.find((item) => item.organizationId === ctx.org.id && item.userId === user.id);
    if (existing && existing.clientId === client.id) {
      return fail(
        "Please fix the highlighted fields.",
        { email: [existing.status === "active" ? "They already have portal access." : "Their access is paused. Restore it from the list instead."] },
        values,
      );
    }
    if (existing) {
      const other = db.clients.find((item) => item.id === existing.clientId);
      return fail("Please fix the highlighted fields.", { email: [`They already use the ${other?.companyName ?? "another client's"} portal.`] }, values);
    }
  }
  const pending = db.invitations.some(
    (item) =>
      item.organizationId === ctx.org.id &&
      item.kind === "client" &&
      item.clientId === client.id &&
      item.email.toLowerCase() === email &&
      item.status === "pending" &&
      Date.parse(item.expiresAt) > now.getTime(),
  );
  if (pending) return fail("Please fix the highlighted fields.", { email: ["An invitation to this address is already pending."] }, values);

  const id = newId("inv");
  db.invitations.push({
    id,
    organizationId: ctx.org.id,
    email,
    kind: "client",
    role,
    clientId: client.id,
    status: "pending",
    invitedByUserId: ctx.user.id,
    createdAt: now.toISOString(),
    expiresAt: addDays(now, INVITE_DAYS).toISOString(),
  });
  recordAudit(db, ctx, {
    action: "client.access_granted",
    entityType: "invitation",
    entityId: id,
    summary: `Invited ${email} to the ${client.companyName} portal as ${CLIENT_ROLE_LABELS[role]}`,
    metadata: { role, clientId: client.id },
  });
  recordActivity(db, ctx, { verb: "member.invited", targetType: "client", targetId: client.id, targetLabel: email, visibility: "internal" });

  await saveDb();
  refresh();
  return ok(`Invitation sent to ${email}.`);
}

async function loadPortalMembership(orgSlug: string, membershipId: string) {
  const scope = await manageAccessContext(orgSlug);
  if (!scope) return { error: "Only owners and managers can change portal access." } as const;
  const { ctx, db } = scope;
  if (!idSchema.safeParse(membershipId).success) return { error: "Portal user not found." } as const;
  const membership = db.clientMemberships.find((item) => item.id === membershipId && item.organizationId === ctx.org.id);
  const client = membership ? db.clients.find((item) => item.id === membership.clientId && item.organizationId === ctx.org.id) : undefined;
  const user = membership ? db.users.find((item) => item.id === membership.userId) : undefined;
  if (!membership || !client || !user) return { error: "Portal user not found." } as const;
  return { ctx, db, membership, client, user } as const;
}

export async function setPortalAccess(orgSlug: string, membershipId: string, status: "active" | "suspended"): Promise<ActionState> {
  const parsed = accessSchema.safeParse(status);
  if (!parsed.success) return fail("Choose a valid access state.");
  const loaded = await loadPortalMembership(orgSlug, membershipId);
  if ("error" in loaded) return fail(loaded.error ?? "Not allowed.");
  const { ctx, db, membership, client, user } = loaded;
  if (membership.status === parsed.data) return ok();

  membership.status = parsed.data;
  const revoking = parsed.data === "suspended";
  recordAudit(db, ctx, {
    action: revoking ? "client.access_revoked" : "client.access_granted",
    entityType: "client_membership",
    entityId: membership.id,
    summary: revoking
      ? `Revoked ${user.name}'s access to the ${client.companyName} portal`
      : `Restored ${user.name}'s access to the ${client.companyName} portal`,
    metadata: { clientId: client.id, role: membership.role },
  });
  await saveDb();
  refresh();
  return ok(revoking ? `${user.name} can no longer open the portal.` : `${user.name} has portal access again.`);
}

export async function setPortalRole(orgSlug: string, membershipId: string, role: ClientRole): Promise<ActionState> {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return fail("Choose Approver or Viewer.");
  const loaded = await loadPortalMembership(orgSlug, membershipId);
  if ("error" in loaded) return fail(loaded.error ?? "Not allowed.");
  const { ctx, db, membership, client, user } = loaded;
  if (membership.role === parsed.data) return ok();

  const from = membership.role;
  membership.role = parsed.data;
  recordAudit(db, ctx, {
    action: parsed.data === "approver" ? "client.access_granted" : "client.access_revoked",
    entityType: "client_membership",
    entityId: membership.id,
    summary: `Changed ${user.name} from ${CLIENT_ROLE_LABELS[from]} to ${CLIENT_ROLE_LABELS[parsed.data]} on the ${client.companyName} portal`,
    metadata: { from, to: parsed.data, clientId: client.id },
  });
  await saveDb();
  refresh();
  return ok(`${user.name} is now ${parsed.data === "approver" ? "an Approver" : "a Viewer"}.`);
}

async function loadClientInvitation(orgSlug: string, invitationId: string) {
  const scope = await manageAccessContext(orgSlug);
  if (!scope) return null;
  const { ctx, db } = scope;
  if (!idSchema.safeParse(invitationId).success) return null;
  const invitation = db.invitations.find((item) => item.id === invitationId && item.organizationId === ctx.org.id && item.kind === "client");
  const client = invitation ? db.clients.find((item) => item.id === invitation.clientId && item.organizationId === ctx.org.id) : undefined;
  if (!invitation || !client) return null;
  return { ctx, db, invitation, client };
}

export async function revokeClientInvitation(orgSlug: string, invitationId: string): Promise<ActionState> {
  const loaded = await loadClientInvitation(orgSlug, invitationId);
  if (!loaded) return fail("Invitation not found.");
  const { ctx, db, invitation, client } = loaded;
  if (invitation.status !== "pending" && invitation.status !== "expired") return fail("This invitation can't be revoked any more.");
  invitation.status = "revoked";
  recordAudit(db, ctx, {
    action: "invitation.revoked",
    entityType: "invitation",
    entityId: invitation.id,
    summary: `Revoked the ${client.companyName} portal invitation for ${invitation.email}`,
  });
  await saveDb();
  refresh();
  return ok(`Invitation for ${invitation.email} revoked.`);
}

export async function resendClientInvitation(orgSlug: string, invitationId: string): Promise<ActionState> {
  const loaded = await loadClientInvitation(orgSlug, invitationId);
  if (!loaded) return fail("Invitation not found.");
  const { ctx, db, invitation, client } = loaded;
  if (invitation.status !== "pending" && invitation.status !== "expired") return fail("This invitation can't be sent again.");
  if (client.status === "archived") return fail("This client is archived. Change its status before inviting anyone.");
  invitation.status = "pending";
  invitation.expiresAt = addDays(new Date(), INVITE_DAYS).toISOString();
  recordAudit(db, ctx, {
    action: "client.access_granted",
    entityType: "invitation",
    entityId: invitation.id,
    summary: `Re-sent the ${client.companyName} portal invitation to ${invitation.email}`,
    metadata: { role: invitation.role },
  });
  await saveDb();
  refresh();
  return ok(`Invitation re-sent to ${invitation.email}. It's valid for ${INVITE_DAYS} days.`);
}
