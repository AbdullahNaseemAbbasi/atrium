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
import { planRelation, subscriptionFor } from "@/lib/data/queries/billing";
import { getDb } from "@/lib/data/store";
import type { BillingInterval } from "@/lib/data/types";
import { fail, ok, type ActionState } from "./result";

async function clientIp() {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "local";
}

const unix = (date: Date) => Math.floor(date.getTime() / 1000);

function periodEnd(from: Date, interval: BillingInterval) {
  const end = new Date(from);
  if (interval === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
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

  const db = getDb();
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

  revalidatePath(`/w/${ctx.org.slug}`, "layout");
  redirect(`/w/${ctx.org.slug}/billing?upgraded=1`);
}

/** Schedules or undoes cancellation at the end of the current period (via the same webhook path). */
export async function setCancelAtPeriodEnd(orgSlug: string, cancel: boolean): Promise<ActionState> {
  const ctx = await requireTeamContext(orgSlug);
  if (!can(ctx.role, "billing.manage")) return fail("Only owners and billing managers can cancel the subscription.");
  const db = getDb();
  const subscription = db.subscriptions.find((item) => item.organizationId === ctx.org.id);
  if (!subscription || subscription.planKey === "starter") return fail("The free Starter plan has nothing to cancel.");
  if (subscription.cancelAtPeriodEnd === cancel) return ok(cancel ? "Cancellation was already scheduled." : "The subscription is already active.");

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
  refresh();
  return ok(cancel ? "Cancellation scheduled. You keep every feature until the period ends." : "Subscription resumed. It renews as usual.");
}
