import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { createSeed } from "@/lib/data/seed";
import type { Database } from "@/lib/data/types";
import { catalogueIdForStripePrice, stripeFlowFor } from "@/lib/billing/stripe-flow";
import { translateStripeEvent, type StripeLookups } from "@/lib/billing/stripe-events";
import { processBillingEvent } from "@/lib/billing/webhooks";

const NOW = new Date("2026-10-15T12:00:00Z");
const created = Math.floor(NOW.getTime() / 1000);
let db: Database;

beforeEach(() => {
  db = createSeed(NOW);
});

const price = (lookup: string, amount: number, interval: "month" | "year") => ({
  id: `price_${lookup}`,
  lookup_key: lookup,
  unit_amount: amount,
  recurring: { interval },
});

const visa = { id: "pm_1", card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2034 } };

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1Real",
    customer: "cus_1Real",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    default_payment_method: visa,
    metadata: { organizationId: "org_kinetic", initiatedByUserId: "usr_alex" },
    items: { data: [{ id: "si_1", current_period_end: created + 30 * 86_400, price: price("atrium_agency_month", 12900, "month") }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function lookups(sub = subscription(), customerOrg: string | null = "org_kinetic"): StripeLookups {
  return { subscription: vi.fn(async () => sub), customerOrganization: vi.fn(async () => customerOrg) };
}

const event = (type: string, object: unknown, id = "evt_1Stripe") => ({ id, type, created, data: { object } }) as unknown as Stripe.Event;

describe("catalogue mapping", () => {
  it("accepts only catalogue prices", () => {
    expect(catalogueIdForStripePrice(price("atrium_professional_year", 47000, "year"))).toBe("price_TEST_professional_year");
    expect(catalogueIdForStripePrice(price("atrium_professional_year", 100, "year"))).toBeNull();
    expect(catalogueIdForStripePrice(price("atrium_professional_year", 47000, "month"))).toBeNull();
    expect(catalogueIdForStripePrice(price("atrium_unknown_month", 4900, "month"))).toBeNull();
    expect(catalogueIdForStripePrice({ lookup_key: null, unit_amount: 4900, recurring: { interval: "month" } })).toBeNull();
  });
});

describe("which Stripe flow a plan change uses", () => {
  it("checks out new subscriptions, swaps prices, and cancels to Starter", () => {
    const kinetic = db.subscriptions.find((item) => item.organizationId === "org_kinetic")!;
    // Demo data uses made-up IDs, so its first Stripe change is a checkout.
    expect(stripeFlowFor(kinetic, "agency")).toBe("checkout");
    kinetic.providerSubscriptionId = "sub_1Real";
    expect(stripeFlowFor(kinetic, "agency")).toBe("change");
    expect(stripeFlowFor(kinetic, "starter")).toBe("cancel");
    const lumen = db.subscriptions.find((item) => item.organizationId === "org_lumen")!;
    expect(stripeFlowFor(lumen, "starter")).toBe("local");
  });
});

describe("Stripe event translation", () => {
  it("turns a completed checkout into a checkout plus the plan, without a second invoice", async () => {
    const result = await translateStripeEvent(
      event("checkout.session.completed", {
        mode: "subscription",
        payment_status: "paid",
        client_reference_id: "org_kinetic",
        customer: "cus_1Real",
        subscription: "sub_1Real",
        amount_total: 12900,
        currency: "usd",
        metadata: { organizationId: "org_kinetic", initiatedByUserId: "usr_alex" },
      }),
      lookups(),
    );
    if ("ignored" in result) throw new Error(result.ignored);
    expect(result.organizationId).toBe("org_kinetic");
    expect(result.events.map((item) => item.type)).toEqual(["checkout.session.completed", "customer.subscription.updated"]);
    const [checkout, plan] = result.events;
    expect(checkout.data).toMatchObject({ priceId: "price_TEST_agency_month", amountCents: 12900, currency: "USD", recordInvoice: false });
    expect(plan.id).toBe("evt_1Stripe_sub");
    expect(plan.data).toMatchObject({ status: "active", paymentMethod: { brand: "Visa", last4: "4242" } });

    const invoicesBefore = db.invoices.length;
    for (const item of result.events) expect(processBillingEvent(db, item, { now: NOW }).status).toBe("processed");
    const kinetic = db.subscriptions.find((item) => item.organizationId === "org_kinetic")!;
    expect(kinetic).toMatchObject({ planKey: "agency", providerSubscriptionId: "sub_1Real", providerCustomerId: "cus_1Real" });
    expect(db.invoices.length).toBe(invoicesBefore);
  });

  it("still applies the plan when customer credit lowers what the checkout charged", async () => {
    const result = await translateStripeEvent(
      event("checkout.session.completed", {
        mode: "subscription",
        payment_status: "paid",
        client_reference_id: "org_kinetic",
        customer: "cus_1Real",
        subscription: "sub_1Real",
        amount_total: 4901,
        currency: "usd",
        metadata: {},
      }),
      lookups(),
    );
    if ("ignored" in result) throw new Error(result.ignored);
    expect(result.events[0].data).toMatchObject({ amountCents: 12900 });
    for (const item of result.events) expect(processBillingEvent(db, item, { now: NOW }).status).toBe("processed");
    expect(db.subscriptions.find((item) => item.organizationId === "org_kinetic")!.planKey).toBe("agency");
  });

  it("reads subscription details through the SDK, whatever the payload's API version", async () => {
    const fromEvent = subscription({ default_payment_method: "pm_1" });
    const l = lookups(subscription());
    const result = await translateStripeEvent(event("customer.subscription.updated", fromEvent), l);
    if ("ignored" in result) throw new Error(result.ignored);
    expect(l.subscription).toHaveBeenCalledWith("sub_1Real");
    expect(result.events[0].data).toMatchObject({ paymentMethod: { brand: "Visa" } });
  });

  it("finds the workspace through the customer when metadata is missing", async () => {
    const result = await translateStripeEvent(event("customer.subscription.deleted", subscription({ metadata: {} })), lookups(subscription(), "org_lumen"));
    expect("ignored" in result ? null : result.organizationId).toBe("org_lumen");
  });

  it("records paid invoices and skips free ones", async () => {
    const invoice = {
      amount_paid: 4900,
      amount_due: 4900,
      currency: "usd",
      customer: "cus_1Real",
      parent: { subscription_details: { metadata: { organizationId: "org_kinetic" } } },
      lines: { data: [{ period: { start: created, end: created + 30 * 86_400 } }] },
      period_start: created,
      period_end: created,
    };
    const paid = await translateStripeEvent(event("invoice.paid", invoice), lookups());
    if ("ignored" in paid) throw new Error(paid.ignored);
    expect(paid.events[0].data).toMatchObject({ amountCents: 4900, currency: "USD", periodEnd: created + 30 * 86_400 });
    expect("ignored" in (await translateStripeEvent(event("invoice.paid", { ...invoice, amount_paid: 0 }), lookups()))).toBe(true);
  });

  it("rejects a price that isn't in the catalogue", async () => {
    const edited = subscription({ items: { data: [{ id: "si_1", current_period_end: created, price: price("atrium_agency_month", 99, "month") }] } });
    const result = await translateStripeEvent(event("customer.subscription.updated", edited), lookups(edited));
    if ("ignored" in result) throw new Error(result.ignored);
    const kinetic = db.subscriptions.find((item) => item.organizationId === "org_kinetic")!;
    kinetic.providerSubscriptionId = "sub_1Real";
    expect(processBillingEvent(db, result.events[0], { now: NOW }).status).toBe("failed");
    expect(kinetic.planKey).toBe("professional");
  });

  it("accepts the first real subscription even if its event beats the checkout", async () => {
    const result = await translateStripeEvent(event("customer.subscription.created", subscription()), lookups());
    if ("ignored" in result) throw new Error(result.ignored);
    expect(processBillingEvent(db, result.events[0], { now: NOW }).status).toBe("processed");
    expect(db.subscriptions.find((item) => item.organizationId === "org_kinetic")).toMatchObject({ planKey: "agency", providerSubscriptionId: "sub_1Real" });
  });

  it("rejects events for another subscription once a real one is stored", async () => {
    const kinetic = db.subscriptions.find((item) => item.organizationId === "org_kinetic")!;
    kinetic.providerSubscriptionId = "sub_1Other";
    const result = await translateStripeEvent(event("customer.subscription.updated", subscription()), lookups());
    if ("ignored" in result) throw new Error(result.ignored);
    expect(processBillingEvent(db, result.events[0], { now: NOW }).status).toBe("failed");
    expect(kinetic.planKey).toBe("professional");
  });

  it("ignores events Atrium doesn't use", async () => {
    expect("ignored" in (await translateStripeEvent(event("charge.refunded", {}), lookups()))).toBe(true);
  });
});

describe("ending a subscription", () => {
  it("puts the workspace back on Starter", () => {
    const result = processBillingEvent(
      db,
      { id: "evt_1Ended", type: "customer.subscription.deleted", created, data: { organizationId: "org_kinetic", subscriptionId: "sub_TEST_kinetic" } },
      { now: NOW },
    );
    expect(result.status).toBe("processed");
    expect(db.subscriptions.find((item) => item.organizationId === "org_kinetic")).toMatchObject({
      planKey: "starter",
      status: "active",
      providerSubscriptionId: undefined,
    });
  });
});
