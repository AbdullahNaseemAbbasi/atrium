"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { getPlan } from "@/lib/billing/plans";
import { computeUsage } from "@/lib/billing/usage";
import { replayStoredEvent } from "@/lib/billing/webhooks";
import { getDb, newId, resetDb, saveDb } from "@/lib/data/store";
import { SUPPORT_ACCESS_ACTION } from "@/lib/settings/options";
import { formatBytes } from "@/lib/utils";
import { usesSupabase } from "@/lib/supabase/config";
import { fail, ok, type ActionState } from "./result";

async function clientIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "local";
}

/** Restores the deterministic demo data for the demo workspaces. */
export async function resetDemoData(): Promise<void> {
  await requirePlatformAdmin();
  if (usesSupabase()) {
    const { resetDemoData: resetRemote } = await import("@/lib/data/supabase/demo-seed");
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    await resetRemote(supabaseAdmin());
  } else {
    resetDb();
  }
  revalidatePath("/", "layout");
  redirect("/admin?reset=1");
}

export interface SupportView {
  ok: true;
  workspace: {
    name: string;
    slug: string;
    createdAt: string;
    timezone: string;
    plan: string;
    subscriptionStatus: string;
    owner: { name: string; email: string } | null;
    members: { role: string; count: number }[];
    counts: { label: string; value: string }[];
    lastActivityAt: string | null;
  };
}

/**
 * Opens the support view for one workspace. Operators get metadata only
 * (plan, counts, owner contact) and every opening is written to that
 * workspace's audit log so its owners can see who looked.
 */
export async function openSupportView(organizationId: string): Promise<SupportView | { ok: false; message: string }> {
  const admin = await requirePlatformAdmin();
  const db = await getDb();
  const org = db.organizations.find((item) => item.id === organizationId);
  if (!org) return { ok: false, message: "Workspace not found." };

  db.auditLogs.push({
    id: newId("aud"),
    organizationId: org.id,
    actorUserId: admin.id,
    action: SUPPORT_ACCESS_ACTION,
    entityType: "organization",
    entityId: org.id,
    summary: `Platform support (${admin.name}) opened the support view (metadata only)`,
    metadata: { scope: "metadata", reason: "support" },
    ip: await clientIp(),
    createdAt: new Date().toISOString(),
  });

  const memberships = db.memberships.filter((item) => item.organizationId === org.id && item.status === "active");
  const ownerMembership = memberships.find((item) => item.role === "owner");
  const owner = ownerMembership ? db.users.find((user) => user.id === ownerMembership.userId) : undefined;
  const subscription = db.subscriptions.find((item) => item.organizationId === org.id);
  const usage = computeUsage(db, org.id);
  const lastActivity = db.activity
    .filter((item) => item.organizationId === org.id)
    .reduce<string | null>((latest, item) => (!latest || item.createdAt > latest ? item.createdAt : latest), null);
  const roles = ["owner", "manager", "member", "billing"] as const;
  await saveDb();

  return {
    ok: true,
    workspace: {
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
      timezone: org.timezone,
      plan: getPlan(subscription?.planKey ?? "starter").name,
      subscriptionStatus: subscription?.status ?? "active",
      owner: owner ? { name: owner.name, email: owner.email } : null,
      members: roles.map((role) => ({ role, count: memberships.filter((item) => item.role === role).length })).filter((item) => item.count > 0),
      counts: [
        { label: "Active projects", value: String(usage.projects) },
        { label: "Total projects", value: String(db.projects.filter((item) => item.organizationId === org.id).length) },
        { label: "Clients", value: String(usage.clients) },
        { label: "Client portal users", value: String(db.clientMemberships.filter((item) => item.organizationId === org.id && item.status === "active").length) },
        { label: "Storage", value: formatBytes(usage.storageBytes) },
        { label: "Open invitations", value: String(db.invitations.filter((item) => item.organizationId === org.id && item.status === "pending").length) },
      ],
      lastActivityAt: lastActivity,
    },
  };
}

/** Redelivers the newest processed event to prove idempotency: it must be recorded as a skipped duplicate. */
export async function replayWebhookEvent(providerEventId: string): Promise<ActionState> {
  await requirePlatformAdmin();
  if (!/^evt_[A-Za-z0-9_]{4,64}$/.test(providerEventId)) return fail("Unknown event.");
  const result = replayStoredEvent((await getDb()), providerEventId, { ip: await clientIp() });
  if (!result) return fail("That event has no stored payload to replay.");
  await saveDb();
  revalidatePath("/admin", "layout");
  return result.body.status === "skipped_duplicate"
    ? ok(`Replayed ${providerEventId}: recorded as a duplicate, nothing changed.`)
    : fail(`Replay returned "${result.body.status}". ${result.body.message}`);
}
