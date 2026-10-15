import "server-only";
import { subDays } from "date-fns";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { getPlan } from "@/lib/billing/plans";
import { storedEvents } from "@/lib/billing/webhooks";
import { computeUsage } from "@/lib/billing/usage";
import { signDownload, verifyDownload } from "@/lib/storage/signed-urls";
import { formatRelative } from "@/lib/utils";
import { getDb } from "../store";
import { newestFirst, paginate } from "../views";
import type { Database, SubscriptionStatus, WebhookStatus } from "../types";

/**
 * Platform operations read models. Operators see workspace metadata and
 * system health, never project content (names of projects, tasks, files and
 * comments stay out of every shape returned here).
 */

export type HealthStatus = "operational" | "sandbox" | "degraded" | "down";

export interface HealthCheck {
  key: string;
  name: string;
  status: HealthStatus;
  latencyMs: number;
  detail: string;
}

function timed<T>(run: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = run();
  return { value, ms: Math.round((performance.now() - start) * 100) / 100 };
}

/** Each check performs a real round trip through the demo service it names. */
function runHealthChecks(db: Database, now: Date): HealthCheck[] {
  const store = timed(() => db.organizations.length + db.projects.length + db.tasks.length + db.auditLogs.length);

  const storage = timed(() => {
    const signed = signDownload({ objectId: "health-check", kind: "file", userId: "platform", orgSlug: "health" });
    return verifyDownload(signed.token) !== null;
  });

  const events = storedEvents(db);
  const dayAgo = subDays(now, 1).getTime();
  const recentFailures = events.filter((event) => event.status === "failed" && Date.parse(event.receivedAt) >= dayAgo).length;
  const last = newestFirst(events.map((event) => ({ ...event, createdAt: event.receivedAt })))[0];
  const webhook = timed(() => events.length);

  return [
    {
      key: "store",
      name: "Data store",
      status: "operational",
      latencyMs: store.ms,
      detail: `In-memory demo store answered a full scan (${store.value.toLocaleString("en-US")} rows). Supabase Postgres replaces it in production.`,
    },
    {
      key: "storage",
      name: "File storage",
      status: storage.value ? "operational" : "down",
      latencyMs: storage.ms,
      detail: storage.value ? "Signed a 60-second download URL and verified it." : "Could not verify a freshly signed URL.",
    },
    {
      key: "email",
      name: "Email delivery",
      status: "sandbox",
      latencyMs: 0,
      detail: "Sandbox mode: emails are recorded as in-app notifications and never sent.",
    },
    {
      key: "webhooks",
      name: "Billing webhooks",
      status: recentFailures > 0 ? "degraded" : "operational",
      latencyMs: webhook.ms,
      detail:
        recentFailures > 0
          ? `${recentFailures} failed ${recentFailures === 1 ? "event" : "events"} in the last 24 hours. The provider retries them.`
          : last
            ? `Signature checks on. Last event ${formatRelative(last.receivedAt, now)}.`
            : "Signature checks on. No events received yet.",
    },
  ];
}

export async function getAdminOverview() {
  const admin = await requirePlatformAdmin();
  const db = await getDb();
  const now = new Date();
  const events = storedEvents(db);
  const storageBytes = db.organizations.reduce((sum, org) => sum + computeUsage(db, org.id).storageBytes, 0);
  const teamUserIds = new Set(db.memberships.filter((item) => item.status === "active").map((item) => item.userId));
  const clientUserIds = new Set(db.clientMemberships.filter((item) => item.status === "active").map((item) => item.userId));

  return {
    adminName: admin.name,
    checkedAt: now.toISOString(),
    checks: runHealthChecks(db, now),
    metrics: {
      workspaces: db.organizations.length,
      teamUsers: teamUserIds.size,
      clientUsers: clientUserIds.size,
      projects: db.projects.length,
      storageBytes,
      webhooks: {
        processed: events.filter((event) => event.status === "processed" && !event.stale).length,
        skipped: events.filter((event) => event.status === "skipped_duplicate" || event.stale).length,
        failed: events.filter((event) => event.status === "failed").length,
      },
    },
  };
}

export interface AdminWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  hue: number;
  planName: string;
  status: SubscriptionStatus;
  interval: string;
  members: number;
  clients: number;
  projects: number;
  storageBytes: number;
  createdAt: string;
}

export async function listAdminWorkspaces(query: { q?: string }) {
  await requirePlatformAdmin();
  const db = await getDb();
  const q = query.q?.trim().toLowerCase() ?? "";
  const rows: AdminWorkspaceRow[] = db.organizations
    .filter((org) => !q || org.name.toLowerCase().includes(q) || org.slug.includes(q))
    .map((org) => {
      const subscription = db.subscriptions.find((item) => item.organizationId === org.id);
      const usage = computeUsage(db, org.id);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        hue: org.brandHue,
        planName: getPlan(subscription?.planKey ?? "starter").name,
        status: subscription?.status ?? "active",
        interval: subscription?.interval === "year" ? "Yearly" : "Monthly",
        members: usage.seats,
        clients: usage.clients,
        projects: db.projects.filter((item) => item.organizationId === org.id).length,
        storageBytes: usage.storageBytes,
        createdAt: org.createdAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { rows, total: db.organizations.length, q: query.q ?? "" };
}

const DEFAULT_OUTCOME: Record<WebhookStatus, string> = {
  processed: "Applied.",
  skipped_duplicate: "Already processed. Replay ignored.",
  failed: "Handler error. The provider retries with backoff.",
};

export const WEBHOOK_FILTERS = ["all", "processed", "skipped", "failed"] as const;
export type WebhookFilter = (typeof WEBHOOK_FILTERS)[number];

export async function listWebhookEvents(query: { status?: string; page?: string }) {
  await requirePlatformAdmin();
  const db = await getDb();
  const now = new Date();
  const status: WebhookFilter = (WEBHOOK_FILTERS as readonly string[]).includes(query.status ?? "") ? (query.status as WebhookFilter) : "all";
  const all = storedEvents(db);
  const matches = (event: (typeof all)[number], filter: WebhookFilter) =>
    filter === "all" ||
    (filter === "processed" && event.status === "processed" && !event.stale) ||
    (filter === "skipped" && (event.status === "skipped_duplicate" || Boolean(event.stale))) ||
    (filter === "failed" && event.status === "failed");

  const rows = newestFirst(
    all.filter((event) => matches(event, status)).map((event) => ({
      id: event.id,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      status: event.status,
      stale: Boolean(event.stale),
      outcome: event.outcome ?? DEFAULT_OUTCOME[event.status],
      workspace: db.organizations.find((org) => org.id === event.organizationId)?.name ?? "Unknown",
      createdAt: event.receivedAt,
      eventCreatedAt: event.eventCreatedAt ?? null,
      when: formatRelative(event.receivedAt, now),
    })),
  );
  const replayable = newestFirst(
    all.filter((event) => event.status === "processed" && !event.stale && event.payload).map((event) => ({ ...event, createdAt: event.receivedAt })),
  )[0];

  return {
    status,
    counts: Object.fromEntries(WEBHOOK_FILTERS.map((filter) => [filter, all.filter((event) => matches(event, filter)).length])) as Record<WebhookFilter, number>,
    page: paginate(rows, Number(query.page) || 1, 15),
    replayCandidate: replayable ? { providerEventId: replayable.providerEventId, eventType: replayable.eventType } : null,
  };
}
