import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { getPlan, PLANS } from "@/lib/billing/plans";
import { priceFromId, priceIdFor, trustedPrice } from "@/lib/billing/prices";
import { computeUsage, downgradeBlockers, meterLevel, usageMeters } from "@/lib/billing/usage";
import {
  handleBillingWebhook,
  lastAppliedSubscriptionEventAt,
  processBillingEvent,
  signWebhookPayload,
  storedEvents,
  verifyWebhookSignature,
  type BillingEvent,
} from "@/lib/billing/webhooks";

const NOW = new Date("2026-10-15T12:00:00Z");
const T = Math.floor(NOW.getTime() / 1000);
const SECRET = "whsec_test_secret";

function subscriptionUpdated(id: string, created: number, overrides: Partial<Extract<BillingEvent, { type: "customer.subscription.updated" }>["data"]> = {}): BillingEvent {
  return {
    id,
    type: "customer.subscription.updated",
    created,
    data: {
      organizationId: "org_kinetic",
      subscriptionId: "sub_TEST_kinetic",
      priceId: priceIdFor("agency", "year"),
      status: "active",
      currentPeriodEnd: created + 365 * 86400,
      cancelAtPeriodEnd: false,
      initiatedByUserId: "usr_olivia",
      ...overrides,
    },
  };
}

describe("webhook signatures", () => {
  const body = JSON.stringify({ hello: "world" });

  it("accepts a fresh signature over the exact body", () => {
    expect(verifyWebhookSignature(body, signWebhookPayload(body, SECRET, T), SECRET, T)).toEqual({ ok: true });
  });

  it("rejects a missing, malformed, wrong-secret or tampered signature", () => {
    expect(verifyWebhookSignature(body, null, SECRET, T).ok).toBe(false);
    expect(verifyWebhookSignature(body, "v1=abc", SECRET, T).ok).toBe(false);
    expect(verifyWebhookSignature(body, signWebhookPayload(body, "other", T), SECRET, T).ok).toBe(false);
    expect(verifyWebhookSignature(`${body} `, signWebhookPayload(body, SECRET, T), SECRET, T).ok).toBe(false);
  });

  it("rejects signatures older than five minutes (replayed captures)", () => {
    const old = signWebhookPayload(body, SECRET, T - 301);
    expect(verifyWebhookSignature(body, old, SECRET, T)).toEqual({ ok: false, reason: "Signature timestamp is outside the tolerance window." });
  });

  it("answers 400 for bad signatures and malformed payloads without touching the database", () => {
    const db = createSeed(NOW);
    const before = db.webhookEvents.length;
    const event = JSON.stringify(subscriptionUpdated("evt_TEST_badsig", T));
    expect(handleBillingWebhook(db, event, "t=1,v1=00", { secret: SECRET, now: NOW }).httpStatus).toBe(400);
    expect(handleBillingWebhook(db, "{nope", signWebhookPayload("{nope", SECRET, T), { secret: SECRET, now: NOW }).httpStatus).toBe(400);
    const wrongShape = JSON.stringify({ id: "evt_TEST_shape", type: "charge.refunded", created: T, data: {} });
    expect(handleBillingWebhook(db, wrongShape, signWebhookPayload(wrongShape, SECRET, T), { secret: SECRET, now: NOW }).httpStatus).toBe(400);
    expect(db.webhookEvents.length).toBe(before);
  });
});

describe("webhook processor", () => {
  it("applies a subscription update, audits it and notifies other billing users", () => {
    const db = createSeed(NOW);
    const result = processBillingEvent(db, subscriptionUpdated("evt_TEST_up1", T), { now: NOW });
    expect(result.status).toBe("processed");
    const sub = db.subscriptions.find((item) => item.organizationId === "org_kinetic")!;
    expect(sub.planKey).toBe("agency");
    expect(sub.interval).toBe("year");
    const audit = db.auditLogs.at(-1)!;
    expect(audit.action).toBe("billing.plan_changed");
    expect(audit.actorUserId).toBe("usr_olivia");
    expect(audit.summary).toContain("Professional to Agency");
    // The owner hears about it; the person who made the change doesn't.
    const recipients = db.notifications.filter((item) => item.createdAt === NOW.toISOString()).map((item) => item.recipientUserId);
    expect(recipients).toContain("usr_alex");
    expect(recipients).not.toContain("usr_olivia");
    expect(recipients).not.toContain("usr_emma");
  });

  it("deduplicates by provider event ID: a replay is stored as skipped and changes nothing", () => {
    const db = createSeed(NOW);
    processBillingEvent(db, subscriptionUpdated("evt_TEST_dup", T), { now: NOW });
    const auditCount = db.auditLogs.length;
    const replay = processBillingEvent(db, subscriptionUpdated("evt_TEST_dup", T, { priceId: priceIdFor("starter", "month") }), { now: NOW });
    expect(replay.status).toBe("skipped_duplicate");
    expect(db.subscriptions.find((item) => item.organizationId === "org_kinetic")!.planKey).toBe("agency");
    expect(db.auditLogs.length).toBe(auditCount);
    expect(storedEvents(db).filter((item) => item.providerEventId === "evt_TEST_dup").map((item) => item.status)).toEqual(["processed", "skipped_duplicate"]);
  });

  it("ignores subscription events older than the stored state", () => {
    const db = createSeed(NOW);
    processBillingEvent(db, subscriptionUpdated("evt_TEST_new", T), { now: NOW });
    const late = processBillingEvent(db, subscriptionUpdated("evt_TEST_old", T - 600, { priceId: priceIdFor("professional", "month") }), { now: NOW });
    expect(late.status).toBe("ignored_stale");
    expect(db.subscriptions.find((item) => item.organizationId === "org_kinetic")!.planKey).toBe("agency");
    expect(lastAppliedSubscriptionEventAt(db, "org_kinetic")).toBe(T * 1000);
  });

  it("fails unknown prices and mismatched subscriptions so the provider retries", () => {
    const db = createSeed(NOW);
    expect(processBillingEvent(db, subscriptionUpdated("evt_TEST_price", T, { priceId: "price_TEST_free" }), { now: NOW }).status).toBe("failed");
    expect(processBillingEvent(db, subscriptionUpdated("evt_TEST_sub", T, { subscriptionId: "sub_TEST_other" }), { now: NOW }).status).toBe("failed");
    expect(db.subscriptions.find((item) => item.organizationId === "org_kinetic")!.planKey).toBe("professional");
    // A failed event can be retried with the same ID once the cause is fixed.
    expect(processBillingEvent(db, subscriptionUpdated("evt_TEST_sub", T), { now: NOW }).status).toBe("processed");
  });

  it("records a checkout: customer, test card and a paid invoice at the catalogue price", () => {
    const db = createSeed(NOW);
    const price = trustedPrice("professional", "month");
    const result = processBillingEvent(
      db,
      {
        id: "evt_TEST_checkout",
        type: "checkout.session.completed",
        created: T,
        data: {
          organizationId: "org_lumen",
          customerId: "cus_TEST_lumen",
          subscriptionId: "sub_TEST_lumen",
          priceId: price.priceId,
          amountCents: price.amountCents,
          currency: "USD",
          paymentMethod: { brand: "Visa", last4: "4242", expMonth: 12, expYear: 2034 },
        },
      },
      { now: NOW },
    );
    expect(result.status).toBe("processed");
    const sub = db.subscriptions.find((item) => item.organizationId === "org_lumen")!;
    expect(sub.providerCustomerId).toBe("cus_TEST_lumen");
    expect(sub.paymentMethod?.last4).toBe("4242");
    const invoice = db.invoices.filter((item) => item.organizationId === "org_lumen").at(-1)!;
    expect(invoice).toMatchObject({ number: "INV-2026-001", amountCents: 4900, status: "paid" });
  });

  it("rejects a checkout whose amount differs from the catalogue", () => {
    const db = createSeed(NOW);
    const result = processBillingEvent(
      db,
      {
        id: "evt_TEST_cheap",
        type: "checkout.session.completed",
        created: T,
        data: { organizationId: "org_lumen", customerId: "cus_x", subscriptionId: "sub_x", priceId: priceIdFor("agency", "year"), amountCents: 100, currency: "USD" },
      },
      { now: NOW },
    );
    expect(result.status).toBe("failed");
    expect(db.invoices.some((item) => item.organizationId === "org_lumen")).toBe(false);
  });
});

describe("trusted prices", () => {
  it("maps every plan and interval both ways and nothing else", () => {
    for (const plan of Object.values(PLANS)) {
      for (const interval of ["month", "year"] as const) {
        const price = priceFromId(priceIdFor(plan.key, interval));
        expect(price).toMatchObject({ planKey: plan.key, interval, amountCents: plan.price[interval] });
      }
    }
    expect(priceFromId("price_TEST_agency_week")).toBeNull();
  });
});

describe("usage and downgrade rules", () => {
  const db = createSeed(NOW);
  const usage = computeUsage(db, "org_kinetic");

  it("measures active projects, live clients, seats and storage per tenant", () => {
    expect(usage.projects).toBe(6);
    expect(usage.clients).toBe(6);
    expect(usage.seats).toBe(8);
    expect(computeUsage(db, "org_lumen").projects).toBe(2);
  });

  it("colours meters amber above 80% and red at the limit", () => {
    expect(meterLevel(8, 10)).toBe("ok");
    expect(meterLevel(9, 10)).toBe("warning");
    expect(meterLevel(10, 10)).toBe("limit");
    expect(meterLevel(500, null)).toBe("ok");
    const meters = usageMeters(getPlan("starter"), usage);
    expect(meters.find((item) => item.key === "seats")).toMatchObject({ level: "limit", percent: 100 });
  });

  it("blocks a downgrade and names every limit that is exceeded", () => {
    const blockers = downgradeBlockers(getPlan("starter"), usage);
    expect(blockers.map((item) => item.key)).toEqual(["projects", "clients", "seats", "storageBytes"]);
    expect(blockers[0].message).toBe("You have 6 active projects; Starter allows 3. Complete, pause or cancel 3 projects first.");
    expect(downgradeBlockers(getPlan("professional"), usage)).toEqual([]);
  });
});
