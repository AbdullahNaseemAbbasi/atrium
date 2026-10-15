"use server";

import { refresh, revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getPlan } from "@/lib/billing/plans";
import { isInterval, isPlanKey, priceIdFor, trustedPrice } from "@/lib/billing/prices";
import { computeUsage, downgradeBlockers } from "@/lib/billing/usage";
import { newEventId, simulateProviderDelivery, type BillingEvent } from "@/lib/billing/webhooks";
import { portalConfigurationId, stripe, stripeEnabled, stripePriceId, StripeSetupError } from "@/lib/billing/stripe";
import { hasStripeSubscription, isRealStripeId, stripeFlowFor } from "@/lib/billing/stripe-flow";
import { planRelation, subscriptionFor } from "@/lib/data/queries/billing";
import { getDb, saveDb } from "@/lib/data/store";
import type { BillingInterval } from "@/lib/data/types";
import { fail, ok, type ActionState } from "./result";

async function clientIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "local";
}

const unix = (date: Date) => Math.floor(date.getTime() / 1000);

async function requestOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocol}://${host}`;
}

/** Stripe's own error text is for developers; people get a plain message and the details go to the log. */
function stripeFailure(error: unknown, doing: string): ActionState {
  if (error instanceof StripeSetupError) return fail(`Stripe isn't set up yet: ${error.message}`);
  console.error(`[atrium] Stripe ${doing} failed`, error instanceof Error ? error.message : error);
  return fail(`Stripe couldn't ${doing} right now. Try again in a moment.`);
}

function periodEnd(from: Date, interval: BillingInterval) {
  const end = new Date(from);
  if (interval === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

/**
 * The checkout form's action. With Stripe connected (test mode), plan changes
 * run through Stripe and its webhooks update the workspace; otherwise the
 * simulated checkout below runs.
 */
export async function checkout(orgSlug: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  return stripeEnabled() ? stripeCheckout(orgSlug, previous, formData) : completeTestCheckout(orgSlug, previous, formData);
}

/**
 * Plan changes through Stripe. Nothing about the plan is written here: the
 * webhooks Stripe sends afterwards go through the shared processor, and
 * Realtime refreshes the billing page when they land.
 *
 * - checkout: a hosted Stripe Checkout page creates the subscription.
 * - change: the subscription's price is swapped and the difference invoiced now.
 * - cancel (moving to Starter): the subscription ends with the paid period.
 */
async function stripeCheckout(orgSlug: string, previous: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "billing.manage")) return fail("Only owners and billing managers can change the plan.");
  const planKey = formData.get("plan");
  const intervalInput = formData.get("interval");
  if (!isPlanKey(planKey) || !isInterval(intervalInput)) return fail("Choose a plan and billing interval.");
  const plan = getPlan(planKey);
  const interval: BillingInterval = plan.price.month === 0 ? "month" : intervalInput;

  const db = await getDb();
  const subscription = subscriptionFor(db, ctx.org.id);
  const relation = planRelation(subscription, planKey, interval);
  if (relation === "current" && subscription.status !== "canceled") return fail(`You're already on ${plan.name} (${interval === "year" ? "yearly" : "monthly"}).`);
  if (relation === "downgrade") {
    const blockers = downgradeBlockers(plan, computeUsage(db, ctx.org.id));
    if (blockers.length > 0) return fail(`You can't move to ${plan.name} yet. ${blockers.map((item) => item.message).join(" ")}`);
  }

  const flow = stripeFlowFor(subscription, planKey);
  if (flow === "local") return completeTestCheckout(orgSlug, previous, formData);

  const base = `/w/${ctx.org.slug}`;
  const metadata = { organizationId: ctx.org.id, initiatedByUserId: ctx.user.id };
  let destination: string;
  try {
    if (flow === "cancel") {
      await stripe().subscriptions.update(subscription.providerSubscriptionId!, { cancel_at_period_end: true, metadata });
      destination = `${base}/billing?scheduled=1`;
    } else if (flow === "change") {
      const current = await stripe().subscriptions.retrieve(subscription.providerSubscriptionId!);
      await stripe().subscriptions.update(current.id, {
        items: [{ id: current.items.data[0].id, price: await stripePriceId(planKey, interval) }],
        proration_behavior: "always_invoice",
        cancel_at_period_end: false,
        metadata,
      });
      destination = `${base}/billing?changing=1`;
    } else {
      if (!db.subscriptions.some((item) => item.organizationId === ctx.org.id)) {
        db.subscriptions.push({ ...subscription, id: `sub_${ctx.org.id.replace(/^org_/, "")}` });
      }
      const row = db.subscriptions.find((item) => item.organizationId === ctx.org.id)!;
      if (!isRealStripeId(row.providerCustomerId)) {
        const customer = await stripe().customers.create({ name: ctx.org.name, email: ctx.user.email, metadata: { organizationId: ctx.org.id } });
        row.providerCustomerId = customer.id;
        await saveDb();
      }
      const origin = await requestOrigin();
      const session = await stripe().checkout.sessions.create({
        mode: "subscription",
        customer: row.providerCustomerId,
        client_reference_id: ctx.org.id,
        line_items: [{ price: await stripePriceId(planKey, interval), quantity: 1 }],
        // Plans are priced in USD; without this Stripe shows and charges local currency (PKR in Pakistan).
        adaptive_pricing: { enabled: false },
        metadata,
        subscription_data: { metadata },
        success_url: `${origin}${base}/billing?checkout=success`,
        cancel_url: `${origin}${base}/billing/checkout?plan=${planKey}&interval=${interval}&canceled=1`,
      });
      if (!session.url) return fail("Stripe didn't return a checkout page. Try again.");
      destination = session.url;
    }
  } catch (error) {
    return stripeFailure(error, flow === "checkout" ? "start the checkout" : "update the subscription");
  }
  redirect(destination);
}

/** Opens Stripe's customer portal: cards, invoices, switching plans and cancelling. */
export async function openBillingPortal(orgSlug: string): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "billing.manage")) return fail("Only owners and billing managers can manage billing.");
  if (!stripeEnabled()) return fail("Billing is simulated in this environment.");
  const subscription = subscriptionFor(await getDb(), ctx.org.id);
  if (!isRealStripeId(subscription.providerCustomerId)) return fail("Subscribe to a paid plan first; the portal opens after the first Stripe checkout.");
  let url: string;
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      configuration: await portalConfigurationId(),
      return_url: `${await requestOrigin()}/w/${ctx.org.slug}/billing`,
    });
    url = session.url;
  } catch (error) {
    return stripeFailure(error, "open the billing portal");
  }
  redirect(url);
}

/**
 * Completes the simulated test checkout.
 *
 * 1. Plan key and interval are the only client input; the price comes from
 *    the server-side catalogue.
 * 2. The provider's `checkout.session.completed` and
 *    `customer.subscription.updated` webhooks are simulated: signed and fed
 *    through the same verification + processor as /api/webhooks/billing.
 * 3. The processor updates the subscription, writes the audit entry and
 *    notifies billing users; we then redirect back with a success flag.
 */
export async function completeTestCheckout(orgSlug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "billing.manage")) return fail("Only owners and billing managers can change the plan.");

  const planKey = formData.get("plan");
  const intervalInput = formData.get("interval");
  if (!isPlanKey(planKey) || !isInterval(intervalInput)) return fail("Choose a plan and billing interval.");
  const plan = getPlan(planKey);
  const interval: BillingInterval = plan.price.month === 0 ? "month" : intervalInput;

  const db = await getDb();
  const subscription = subscriptionFor(db, ctx.org.id);
  const relation = planRelation(subscription, planKey, interval);
  if (relation === "current" && subscription.status !== "canceled") return fail(`You're already on ${plan.name} (${interval === "year" ? "yearly" : "monthly"}).`);
  if (relation === "downgrade") {
    const blockers = downgradeBlockers(plan, computeUsage(db, ctx.org.id));
    if (blockers.length > 0) return fail(`You can't move to ${plan.name} yet. ${blockers.map((item) => item.message).join(" ")}`);
  }
  if (!db.subscriptions.some((item) => item.organizationId === ctx.org.id)) {
    db.subscriptions.push({ ...subscription, id: `sub_${ctx.org.id.replace(/^org_/, "")}` });
  }

  const price = trustedPrice(planKey, interval);
  const now = new Date();
  const ip = await clientIp();
  const customerId = subscription.providerCustomerId ?? `cus_TEST_${ctx.org.id.replace(/^org_/, "")}`;
  const subscriptionId = subscription.providerSubscriptionId ?? `sub_TEST_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

  const events: BillingEvent[] = [
    {
      id: newEventId(),
      type: "checkout.session.completed",
      created: unix(now),
      data: {
        organizationId: ctx.org.id,
        customerId,
        subscriptionId,
        priceId: price.priceId,
        amountCents: price.amountCents,
        currency: price.currency,
        // Stripe's public test card. No card data is ever collected.
        paymentMethod: price.amountCents > 0 ? { brand: "Visa", last4: "4242", expMonth: 12, expYear: now.getUTCFullYear() + 8 } : undefined,
        initiatedByUserId: ctx.user.id,
      },
    },
    {
      id: newEventId(),
      type: "customer.subscription.updated",
      created: unix(now),
      data: {
        organizationId: ctx.org.id,
        subscriptionId,
        priceId: price.priceId,
        status: "active",
        currentPeriodEnd: unix(periodEnd(now, interval)),
        cancelAtPeriodEnd: false,
        trialEnd: null,
        initiatedByUserId: ctx.user.id,
      },
    },
  ];

  for (const event of events) {
    const result = simulateProviderDelivery(db, event, { now, ip });
    if (result.httpStatus !== 200) return fail(`The test payment couldn't be completed: ${result.body.message}`);
  }

  await saveDb();
  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  await saveDb();
  redirect(`/w/${ctx.org.slug}/billing?upgraded=1`);
}

/** Schedules or undoes cancellation at the end of the current period (via the same webhook path). */
export async function setCancelAtPeriodEnd(orgSlug: string, cancel: boolean): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "billing.manage")) return fail("Only owners and billing managers can cancel the subscription.");
  const db = await getDb();
  const subscription = db.subscriptions.find((item) => item.organizationId === ctx.org.id);
  if (!subscription || subscription.planKey === "starter") return fail("The free Starter plan has nothing to cancel.");
  if (subscription.cancelAtPeriodEnd === cancel) return ok(cancel ? "Cancellation was already scheduled." : "The subscription is already active.");

  if (stripeEnabled() && hasStripeSubscription(subscription)) {
    try {
      await stripe().subscriptions.update(subscription.providerSubscriptionId!, {
        cancel_at_period_end: cancel,
        metadata: { organizationId: ctx.org.id, initiatedByUserId: ctx.user.id },
      });
    } catch (error) {
      return stripeFailure(error, "update the subscription");
    }
    // Stripe's webhook updates the workspace in a moment; Realtime refreshes the page.
    return ok(cancel ? "Cancellation sent to Stripe. You keep every feature until the period ends." : "Resume sent to Stripe. The subscription renews as usual.");
  }

  const now = new Date();
  const result = simulateProviderDelivery(
    db,
    {
      id: newEventId(),
      type: "customer.subscription.updated",
      created: unix(now),
      data: {
        organizationId: ctx.org.id,
        subscriptionId: subscription.providerSubscriptionId ?? `sub_TEST_${ctx.org.id.replace(/^org_/, "")}`,
        priceId: priceIdFor(subscription.planKey, subscription.interval),
        status: subscription.status,
        currentPeriodEnd: unix(new Date(subscription.currentPeriodEnd)),
        cancelAtPeriodEnd: cancel,
        trialEnd: subscription.trialEndsAt ? unix(new Date(subscription.trialEndsAt)) : null,
        initiatedByUserId: ctx.user.id,
      },
    },
    { now, ip: await clientIp() },
  );
  if (result.httpStatus !== 200) return fail(`Couldn't update the subscription: ${result.body.message}`);
  await saveDb();
  refresh();
  return ok(cancel ? "Cancellation scheduled. You keep every feature until the period ends." : "Subscription resumed. It renews as usual.");
}
