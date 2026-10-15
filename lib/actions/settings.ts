"use server";

import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/data/events";
import { DEMO_PASSWORD } from "@/lib/data/seed";
import { getDb } from "@/lib/data/store";
import type { IntegrationKey, NotificationGroup } from "@/lib/data/types";
import { INDUSTRIES, INTEGRATIONS, NOTIFICATION_GROUPS, TIMEZONE_VALUES } from "@/lib/settings/options";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

const hue = z.coerce.number({ error: "Pick a colour." }).int("Pick a colour.").min(0, "Pick a colour.").max(359, "Pick a colour.");

/** Accepts the stored timezone even if it's not in the curated list (users imported from elsewhere). */
const timezone = (current: string) =>
  z.string().refine((value) => TIMEZONE_VALUES.has(value) || value === current, "Choose a timezone from the list.");

/* ---------- Profile ---------- */

export async function updateProfile(orgSlug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  const schema = z.object({
    name: z.string().trim().min(2, "Enter your full name.").max(80, "Keep your name under 80 characters."),
    title: z.string().trim().max(80, "Keep the title under 80 characters.").default(""),
    timezone: timezone(ctx.user.timezone),
    avatarHue: hue,
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  // A user only ever edits their own row; the id comes from the session, not the form.
  const user = getDb().users.find((item) => item.id === ctx.user.id);
  if (!user) return fail("Your account could not be found. Sign in again.");
  user.name = parsed.data.name;
  user.title = parsed.data.title || undefined;
  user.timezone = parsed.data.timezone;
  user.avatarHue = parsed.data.avatarHue;

  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  return ok("Profile saved.");
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: z.string().min(10, "Use at least 10 characters.").regex(/[0-9]/, "Include at least one number."),
    confirmPassword: z.string().min(1, "Repeat the new password."),
  })
  .refine((value) => value.password === value.confirmPassword, { message: "Passwords don't match.", path: ["confirmPassword"] })
  .refine((value) => value.password !== value.currentPassword, { message: "Choose a password you haven't used here.", path: ["password"] });

export async function changePassword(orgSlug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireTeamContext(orgSlug);
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  // Demo accounts share one password; Supabase Auth verifies and stores it in production.
  if (parsed.data.currentPassword !== DEMO_PASSWORD) {
    return fail("Please fix the highlighted fields.", { currentPassword: ["That isn't your current password."] });
  }
  return ok("Your new password passed every check. Demo accounts keep the shared password, so nothing was changed.");
}

/* ---------- Workspace ---------- */

export async function updateWorkspace(orgSlug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "workspace.update")) return fail("Only workspace owners can change these settings.");

  const schema = z.object({
    name: z.string().trim().min(2, "Use at least 2 characters.").max(60, "Keep the name under 60 characters."),
    timezone: timezone(ctx.org.timezone),
    industry: z.string().refine((value) => INDUSTRIES.includes(value) || value === ctx.org.industry, "Choose an industry from the list."),
    website: z
      .string()
      .trim()
      .max(120, "Keep the address under 120 characters.")
      .transform((value) => value.replace(/^https?:\/\//i, "").replace(/\/+$/, ""))
      .refine((value) => value === "" || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[\w\-./]*)?$/i.test(value), "Enter a domain such as studio.example."),
    brandHue: hue,
  });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  const org = getDb().organizations.find((item) => item.id === ctx.org.id);
  if (!org) return fail("Workspace not found.");
  const next = { ...parsed.data, website: parsed.data.website || undefined };
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((key) => (org[key] ?? "") !== (next[key] ?? ""));
  if (changed.length === 0) return ok("No changes to save.");

  const metadata: Record<string, string> = { fields: changed.join(", ") };
  if (changed.includes("name")) metadata.previousName = org.name;
  Object.assign(org, next);
  recordAudit(getDb(), ctx, {
    action: "workspace.updated",
    entityType: "organization",
    entityId: org.id,
    summary: `Updated workspace ${changed.map((key) => FIELD_LABELS[key]).join(", ")}`,
    metadata,
  });

  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  return ok("Workspace settings saved.");
}

const FIELD_LABELS: Record<string, string> = { name: "name", timezone: "timezone", industry: "industry", website: "website", brandHue: "brand colour" };

/* ---------- Notifications ---------- */

export async function updateNotificationPreferences(orgSlug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  const digest = z.enum(["off", "daily", "weekly"], { error: "Choose a digest option." }).safeParse(formData.get("digest"));
  if (!digest.success) return fail("Please fix the highlighted fields.", { digest: ["Choose a digest option."] });

  // Switches post the groups that are ON; everything else is muted.
  const groups = NOTIFICATION_GROUPS.map((group) => group.key);
  const enabled = (channel: "inApp" | "email") => new Set(formData.getAll(channel).map(String));
  const muted = {
    inApp: groups.filter((group) => !enabled("inApp").has(group)) as NotificationGroup[],
    email: groups.filter((group) => !enabled("email").has(group)) as NotificationGroup[],
  };

  const db = getDb();
  const existing = db.notificationPreferences.find((item) => item.userId === ctx.user.id && item.organizationId === ctx.org.id);
  if (existing) {
    existing.muted = muted;
    existing.digest = digest.data;
  } else {
    db.notificationPreferences.push({ userId: ctx.user.id, organizationId: ctx.org.id, muted, digest: digest.data });
  }
  refresh();
  return ok("Notification preferences saved.");
}

/* ---------- Integrations ---------- */

const integrationKeys = INTEGRATIONS.map((item) => item.key) as [Exclude<IntegrationKey, "stripe">, ...Exclude<IntegrationKey, "stripe">[]];
const integrationKey = z.enum(integrationKeys);

export async function connectIntegration(orgSlug: string, key: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "integrations.manage")) return fail("Only workspace owners can connect integrations.");
  const parsedKey = integrationKey.safeParse(key);
  if (!parsedKey.success) return fail("That integration isn't available.");
  const meta = INTEGRATIONS.find((item) => item.key === parsedKey.data)!;
  const account = z
    .string()
    .trim()
    .min(2, `Enter the ${meta.accountLabel.startsWith(meta.name) ? meta.accountLabel : meta.accountLabel.toLowerCase()}.`)
    .max(80, "Keep it under 80 characters.")
    .regex(/^[^<>]*$/, "Remove angle brackets.")
    .safeParse(formData.get("account") ?? "");
  if (!account.success) return fail("Please fix the highlighted fields.", { account: [account.error.issues[0].message] }, formValues(formData));

  const db = getDb();
  if (db.integrations.some((item) => item.organizationId === ctx.org.id && item.key === meta.key)) {
    return fail(`${meta.name} is already connected. Disconnect it first to switch accounts.`);
  }
  db.integrations.push({ organizationId: ctx.org.id, key: meta.key, account: account.data, connectedAt: new Date().toISOString(), connectedByUserId: ctx.user.id });
  recordAudit(db, ctx, {
    action: "integration.connected",
    entityType: "integration",
    entityId: meta.key,
    summary: `Connected ${meta.name} (${account.data})`,
    metadata: { integration: meta.key, change: "connected" },
  });
  refresh();
  return ok(`${meta.name} connected (demo, no data is sent).`);
}

export async function disconnectIntegration(orgSlug: string, key: string): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "integrations.manage")) return fail("Only workspace owners can disconnect integrations.");
  const parsedKey = integrationKey.safeParse(key);
  if (!parsedKey.success) return fail("That integration isn't available.");
  const db = getDb();
  const connection = db.integrations.find((item) => item.organizationId === ctx.org.id && item.key === parsedKey.data);
  if (!connection) return fail("That integration isn't connected.");
  const meta = INTEGRATIONS.find((item) => item.key === parsedKey.data)!;
  db.integrations = db.integrations.filter((item) => item !== connection);
  recordAudit(db, ctx, {
    action: "integration.disconnected",
    entityType: "integration",
    entityId: meta.key,
    summary: `Disconnected ${meta.name} (${connection.account})`,
    metadata: { integration: meta.key, change: "disconnected" },
  });
  refresh();
  return ok(`${meta.name} disconnected.`);
}
