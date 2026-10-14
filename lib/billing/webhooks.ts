import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { can } from "@/lib/auth/permissions";
import { newId } from "@/lib/data/store";
import type { AuditLog, Database, ID, Notification, Subscription, WebhookEvent } from "@/lib/data/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { getPlan } from "./plans";
import { priceFromId } from "./prices";

/**
 * Billing webhook processor.
 *
 * Every subscription change, whether it comes from the provider's webhook
 * endpoint or from the simulated test checkout, goes through
 * `handleBillingWebhook` → `processBillingEvent`, so there is exactly one
 * place that changes a `Subscription`. Guarantees:
 *
 * 1. Signatures: the raw body must carry a valid `atrium-signature`
 *    (`t=<unix>,v1=<hex HMAC-SHA256 of "t.body">`) younger than 5 minutes.
 * 2. Idempotency: events are deduplicated by `providerEventId`. A replay of
 *    an event that was already processed is stored as `skipped_duplicate`
 *    and changes nothing. Failed events can be retried.
 * 3. Ordering: subscription events older than the last applied subscription
 *    event are acknowledged but ignored, so a late delivery can't roll the
 *    plan back.
 * 4. Trust: the plan comes from the price ID via the server-side catalogue,
 *    never from free-form metadata.
 */

export const SIGNATURE_HEADER = "atrium-signature";
const TOLERANCE_SECONDS = 300;
const DEV_SECRET = "whsec_atrium_local_development_only";

export function billingWebhookSecret() {
  const value = process.env.BILLING_WEBHOOK_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production" && process.env.ATRIUM_DEMO !== "true") {
    throw new Error("BILLING_WEBHOOK_SECRET must be set in production.");
  }
  return DEV_SECRET;
}

/* ---------- Signatures ---------- */

function hmac(secret: string, timestamp: number, payload: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

export function signWebhookPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${hmac(secret, timestamp, payload)}`;
}

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

export function verifyWebhookSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!header) return { ok: false, reason: "Missing signature header." };
  const parts = new Map(
    header.split(",").map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index).trim(), part.slice(index + 1).trim()] as const;
    }),
  );
  const timestamp = Number(parts.get("t"));
  const signature = parts.get("v1");
  if (!Number.isInteger(timestamp) || !signature) return { ok: false, reason: "Malformed signature header." };
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return { ok: false, reason: "Signature timestamp is outside the tolerance window." };
  const expected = Buffer.from(hmac(secret, timestamp, payload), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return { ok: false, reason: "Signature does not match." };
  return { ok: true };
}

/* ---------- Event shapes ---------- */

const id = z.string().min(3).max(80).regex(/^[A-Za-z0-9_]+$/);
const eventBase = {
  id: z.string().regex(/^evt_[A-Za-z0-9_]{4,64}$/, "Event IDs start with evt_."),
  /** Unix seconds when the provider created the event. */
  created: z.number().int().positive(),
};
const currency = z.string().regex(/^[A-Z]{3}$/);

export const billingEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...eventBase,
    type: z.literal("checkout.session.completed"),
    data: z.object({
      organizationId: id,
      customerId: id,
      subscriptionId: id,
      priceId: id,
      amountCents: z.number().int().min(0),
      currency,
      paymentMethod: z
        .object({
          brand: z.string().min(2).max(20),
          last4: z.string().regex(/^\d{4}$/),
          expMonth: z.number().int().min(1).max(12),
          expYear: z.number().int().min(2000).max(2100),
        })
        .optional(),
      /** Checkout metadata: the member who started the checkout. */
      initiatedByUserId: id.optional(),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("customer.subscription.updated"),
    data: z.object({
      organizationId: id,
      subscriptionId: id,
      priceId: id,
      status: z.enum(["trialing", "active", "past_due", "canceled", "incomplete"]),
      currentPeriodEnd: z.number().int().positive(),
      cancelAtPeriodEnd: z.boolean(),
      trialEnd: z.number().int().positive().nullable().optional(),
      initiatedByUserId: id.optional(),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("customer.subscription.deleted"),
    data: z.object({ organizationId: id, subscriptionId: id }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("invoice.paid"),
    data: z.object({ organizationId: id, amountCents: z.number().int().min(0), currency, periodStart: z.number().int(), periodEnd: z.number().int() }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("invoice.payment_failed"),
    data: z.object({ organizationId: id, amountCents: z.number().int().min(0), currency }),
  }),
]);

export type BillingEvent = z.infer<typeof billingEventSchema>;

/**
 * Stored webhook row. `eventCreatedAt` and `outcome` extend the shared
 * `WebhookEvent` type so ordering and "ignored" results can be shown.
 */
export interface StoredWebhookEvent extends WebhookEvent {
  eventCreatedAt?: string;
  outcome?: string;
  /** True when the event was valid but older than the stored state. */
  stale?: boolean;
  /** Verified payload, kept so operators can redeliver it (demo replay). */
  payload?: string;
}

export function storedEvents(db: Database) {
  return db.webhookEvents as StoredWebhookEvent[];
}

export type ProcessStatus = "processed" | "skipped_duplicate" | "ignored_stale" | "failed";

export interface ProcessResult {
  status: ProcessStatus;
  message: string;
  /** True when the subscription or invoices changed. */
  changed: boolean;
}

/* ---------- Processing ---------- */

const isSubscriptionEvent = (type: BillingEvent["type"]) => type.startsWith("customer.subscription.");

/** Creation time of the newest subscription event that was actually applied for this workspace. */
export function lastAppliedSubscriptionEventAt(db: Database, organizationId: ID): number | null {
  let latest: number | null = null;
  for (const event of storedEvents(db)) {
    if (event.organizationId !== organizationId || event.status !== "processed" || event.stale) continue;
    if (!event.eventType.startsWith("customer.subscription.")) continue;
    const at = Date.parse(event.eventCreatedAt ?? event.receivedAt);
    if (latest === null || at > latest) latest = at;
  }
  return latest;
}

function billingAudience(db: Database, organizationId: ID) {
  return db.memberships
    .filter((item) => item.organizationId === organizationId && item.status === "active" && can(item.role, "billing.view"))
    .map((item) => item.userId);
}

interface Effects {
  db: Database;
  organizationId: ID;
  actorUserId?: ID;
  ip?: string;
  now: Date;
}

function audit(fx: Effects, entry: Pick<AuditLog, "action" | "entityType" | "entityId" | "summary"> & { metadata?: AuditLog["metadata"] }) {
  fx.db.auditLogs.push({
    id: newId("aud"),
    organizationId: fx.organizationId,
    actorUserId: fx.actorUserId,
    metadata: { source: "billing webhook", ...(entry.metadata ?? {}) },
    ip: fx.ip,
    createdAt: fx.now.toISOString(),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: entry.summary,
  });
}

function notifyBilling(fx: Effects, entry: Pick<Notification, "type" | "title" | "body"> & { href: string }) {
  for (const recipientUserId of new Set(billingAudience(fx.db, fx.organizationId))) {
    if (recipientUserId === fx.actorUserId) continue;
    fx.db.notifications.push({
      id: newId("ntf"),
      organizationId: fx.organizationId,
      recipientUserId,
      createdAt: fx.now.toISOString(),
      ...entry,
    });
  }
}

function nextInvoiceNumber(db: Database, organizationId: ID, now: Date) {
  const count = db.invoices.filter((item) => item.organizationId === organizationId).length;
  return `INV-${now.getUTCFullYear()}-${String(count + 1).padStart(3, "0")}`;
}

/** The member who started a checkout is only credited if they still belong to the workspace. */
function trustedActor(db: Database, organizationId: ID, userId: ID | undefined) {
  if (!userId) return undefined;
  return db.memberships.some((item) => item.organizationId === organizationId && item.userId === userId && item.status === "active") ? userId : undefined;
}

function describeSubscriptionChange(before: Subscription, after: Subscription, interval: string) {
  const parts: string[] = [];
  if (before.planKey !== after.planKey) parts.push(`Changed plan from ${getPlan(before.planKey).name} to ${getPlan(after.planKey).name} (${interval})`);
  else if (before.interval !== after.interval) parts.push(`Switched ${getPlan(after.planKey).name} to ${interval} billing`);
  if (before.cancelAtPeriodEnd !== after.cancelAtPeriodEnd) {
    parts.push(after.cancelAtPeriodEnd ? `Scheduled cancellation for ${formatDate(after.currentPeriodEnd)}` : "Resumed the subscription");
  }
  if (before.status !== after.status && parts.length === 0) parts.push(`Subscription status changed from ${before.status} to ${after.status}`);
  return parts.join("; ");
}

/**
 * Applies one verified event to the database. Pure apart from writing to
 * `db`, so it can be unit tested with the seed.
 */
export function processBillingEvent(
  db: Database,
  event: BillingEvent,
  opts: { now?: Date; ip?: string } = {},
): ProcessResult {
  const now = opts.now ?? new Date();
  const organizationId = event.data.organizationId;
  const record: StoredWebhookEvent = {
    id: newId("whe"),
    provider: "stripe",
    providerEventId: event.id,
    eventType: event.type,
    organizationId,
    status: "processed",
    receivedAt: now.toISOString(),
    eventCreatedAt: new Date(event.created * 1000).toISOString(),
    payload: JSON.stringify(event),
  };
  const finish = (status: ProcessStatus, message: string, changed = false): ProcessResult => {
    record.status = status === "ignored_stale" ? "processed" : status;
    record.stale = status === "ignored_stale" || undefined;
    record.outcome = message;
    if (status !== "failed" && status !== "skipped_duplicate") record.processedAt = now.toISOString();
    db.webhookEvents.push(record);
    return { status, message, changed };
  };

  // 1. Idempotency: an event that was processed once never applies twice.
  if (storedEvents(db).some((item) => item.providerEventId === event.id && item.status === "processed")) {
    return finish("skipped_duplicate", "Already processed. Replay ignored.");
  }

  const org = db.organizations.find((item) => item.id === organizationId);
  const subscription = db.subscriptions.find((item) => item.organizationId === organizationId);
  if (!org || !subscription) return finish("failed", "No workspace or subscription matches this event.");

  // 2. Ordering: never let an older subscription event overwrite newer state.
  if (isSubscriptionEvent(event.type)) {
    const last = lastAppliedSubscriptionEventAt(db, organizationId);
    if (last !== null && event.created * 1000 < last) {
      return finish("ignored_stale", "Older than the stored subscription state. Acknowledged and ignored.");
    }
  }

  const fx: Effects = {
    db,
    organizationId,
    now,
    ip: opts.ip,
    actorUserId: "initiatedByUserId" in event.data ? trustedActor(db, organizationId, event.data.initiatedByUserId) : undefined,
  };
  const href = `/w/${org.slug}/billing`;

  switch (event.type) {
    case "checkout.session.completed": {
      const price = priceFromId(event.data.priceId);
      if (!price) return finish("failed", `Unknown price ${event.data.priceId}.`);
      if (price.amountCents !== event.data.amountCents) return finish("failed", "Amount does not match the catalogue price.");
      subscription.providerCustomerId = event.data.customerId;
      subscription.providerSubscriptionId = event.data.subscriptionId;
      if (event.data.paymentMethod) subscription.paymentMethod = { ...event.data.paymentMethod };
      if (event.data.amountCents > 0) {
        const start = new Date(event.created * 1000);
        const end = new Date(start);
        if (price.interval === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
        else end.setUTCMonth(end.getUTCMonth() + 1);
        const number = nextInvoiceNumber(db, organizationId, now);
        db.invoices.push({
          id: newId("inv"),
          organizationId,
          number,
          amountCents: event.data.amountCents,
          currency: event.data.currency,
          status: "paid",
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          issuedAt: now.toISOString(),
        });
        const card = subscription.paymentMethod;
        notifyBilling(fx, {
          type: "billing.invoice_paid",
          title: `Invoice ${number} paid (test mode)`,
          body: `${formatMoney(event.data.amountCents)} recorded${card ? ` on the test ${card.brand} ending ${card.last4}` : ""}. No real money moved.`,
          href,
        });
      }
      return finish("processed", "Checkout recorded: customer, payment method and invoice saved.", true);
    }

    case "customer.subscription.updated": {
      const price = priceFromId(event.data.priceId);
      if (!price) return finish("failed", `Unknown price ${event.data.priceId}.`);
      if (subscription.providerSubscriptionId && subscription.providerSubscriptionId !== event.data.subscriptionId) {
        return finish("failed", "Subscription ID does not match this workspace. Will succeed on retry once checkout is recorded.");
      }
      const before = { ...subscription };
      subscription.providerSubscriptionId = event.data.subscriptionId;
      subscription.planKey = price.planKey;
      subscription.interval = price.interval;
      subscription.status = event.data.status;
      subscription.currentPeriodEnd = new Date(event.data.currentPeriodEnd * 1000).toISOString();
      subscription.cancelAtPeriodEnd = event.data.cancelAtPeriodEnd;
      subscription.trialEndsAt = event.data.trialEnd ? new Date(event.data.trialEnd * 1000).toISOString() : undefined;

      const intervalText = price.interval === "year" ? "yearly" : "monthly";
      const summary = describeSubscriptionChange(before, subscription, intervalText);
      if (summary) {
        audit(fx, {
          action: "billing.plan_changed",
          entityType: "subscription",
          entityId: subscription.id,
          summary,
          metadata: {
            from: before.planKey,
            to: subscription.planKey,
            interval: subscription.interval,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            event: event.id,
          },
        });
        notifyBilling(fx, {
          type: "billing.invoice_paid",
          title:
            before.planKey !== subscription.planKey || before.interval !== subscription.interval
              ? `${org.name} is now on ${getPlan(subscription.planKey).name} (${intervalText})`
              : subscription.cancelAtPeriodEnd
                ? `${getPlan(subscription.planKey).name} will end on ${formatDate(subscription.currentPeriodEnd)}`
                : `${getPlan(subscription.planKey).name} subscription updated`,
          body: summary,
          href,
        });
      }
      return finish("processed", summary || "No change: the subscription already matched.", Boolean(summary));
    }

    case "customer.subscription.deleted": {
      if (subscription.providerSubscriptionId && subscription.providerSubscriptionId !== event.data.subscriptionId) {
        return finish("failed", "Subscription ID does not match this workspace.");
      }
      subscription.status = "canceled";
      subscription.cancelAtPeriodEnd = false;
      audit(fx, {
        action: "billing.plan_changed",
        entityType: "subscription",
        entityId: subscription.id,
        summary: `Subscription to ${getPlan(subscription.planKey).name} ended`,
        metadata: { event: event.id },
      });
      return finish("processed", "Subscription marked as canceled.", true);
    }

    case "invoice.paid": {
      const number = nextInvoiceNumber(db, organizationId, now);
      db.invoices.push({
        id: newId("inv"),
        organizationId,
        number,
        amountCents: event.data.amountCents,
        currency: event.data.currency,
        status: "paid",
        periodStart: new Date(event.data.periodStart * 1000).toISOString(),
        periodEnd: new Date(event.data.periodEnd * 1000).toISOString(),
        issuedAt: now.toISOString(),
      });
      if (subscription.status === "past_due") subscription.status = "active";
      notifyBilling(fx, {
        type: "billing.invoice_paid",
        title: `Invoice ${number} paid (test mode)`,
        body: `${formatMoney(event.data.amountCents)} recorded. No real money moved.`,
        href,
      });
      return finish("processed", `Invoice ${number} recorded as paid.`, true);
    }

    case "invoice.payment_failed": {
      subscription.status = "past_due";
      audit(fx, {
        action: "billing.payment_failed",
        entityType: "subscription",
        entityId: subscription.id,
        summary: `Payment of ${formatMoney(event.data.amountCents)} failed (test mode)`,
        metadata: { event: event.id },
      });
      notifyBilling(fx, {
        type: "billing.payment_failed",
        title: "A test payment failed",
        body: `${formatMoney(event.data.amountCents)} could not be collected. Update the payment method to keep the workspace active.`,
        href,
      });
      return finish("processed", "Subscription marked as past due.", true);
    }
  }
}

export interface WebhookResponse {
  httpStatus: number;
  body: { received: boolean; status?: ProcessStatus; message: string };
}

/**
 * The full receive path used by the webhook route and by the simulated
 * checkout: verify the signature over the raw body, validate the payload,
 * then process it.
 */
export function handleBillingWebhook(
  db: Database,
  rawBody: string,
  signatureHeader: string | null | undefined,
  opts: { secret?: string; now?: Date; ip?: string } = {},
): WebhookResponse {
  const now = opts.now ?? new Date();
  const check = verifyWebhookSignature(rawBody, signatureHeader, opts.secret ?? billingWebhookSecret(), Math.floor(now.getTime() / 1000));
  if (!check.ok) return { httpStatus: 400, body: { received: false, message: check.reason } };

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { httpStatus: 400, body: { received: false, message: "Body is not valid JSON." } };
  }
  const parsed = billingEventSchema.safeParse(json);
  if (!parsed.success) return { httpStatus: 400, body: { received: false, message: "Unsupported or malformed event." } };

  const result = processBillingEvent(db, parsed.data, { now, ip: opts.ip });
  // Failed events answer 500 so the provider retries them later.
  return {
    httpStatus: result.status === "failed" ? 500 : 200,
    body: { received: result.status !== "failed", status: result.status, message: result.message },
  };
}

/** Builds and signs an event the way the provider would send it. Used by the test checkout. */
export function simulateProviderDelivery(db: Database, event: BillingEvent, opts: { now?: Date; ip?: string } = {}) {
  const payload = JSON.stringify(event);
  const secret = billingWebhookSecret();
  const now = opts.now ?? new Date();
  const header = signWebhookPayload(payload, secret, Math.floor(now.getTime() / 1000));
  return handleBillingWebhook(db, payload, header, { secret, now, ip: opts.ip });
}

/** Redelivers a stored event exactly as the provider would on a retry. */
export function replayStoredEvent(db: Database, providerEventId: string, opts: { now?: Date; ip?: string } = {}) {
  const original = storedEvents(db).find((item) => item.providerEventId === providerEventId && item.payload);
  if (!original?.payload) return null;
  const event = billingEventSchema.parse(JSON.parse(original.payload));
  return simulateProviderDelivery(db, event, opts);
}

export function newEventId() {
  return `evt_TEST_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
