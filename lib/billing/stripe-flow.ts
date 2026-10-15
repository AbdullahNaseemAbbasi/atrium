import type { BillingInterval, PlanKey, Subscription } from "@/lib/data/types";
import { getPlan, PLANS } from "./plans";
import { priceIdFor } from "./prices";

/**
 * How a plan change runs when Stripe is connected. Pure, so the checkout page
 * and the action agree, and tests can cover it.
 *
 * - checkout: no Stripe subscription yet (free plan, or demo data) and a paid
 *   target: Stripe Checkout creates one.
 * - change: an active Stripe subscription moving to another paid price: the
 *   subscription's price is swapped, prorated.
 * - cancel: an active Stripe subscription moving to the free plan: it ends at
 *   the end of the paid period, then the workspace is back on Starter.
 * - local: free to free, nothing to bill.
 */
export type StripeFlow = "checkout" | "change" | "cancel" | "local";

/** Demo data and the simulated checkout use made-up IDs containing "_TEST_". */
export function isRealStripeId(id: string | undefined): id is string {
  return Boolean(id && !id.includes("_TEST_"));
}

export function hasStripeSubscription(subscription: Subscription) {
  return isRealStripeId(subscription.providerSubscriptionId) && subscription.status !== "canceled" && getPlan(subscription.planKey).price.month > 0;
}

export function stripeFlowFor(subscription: Subscription, target: PlanKey): StripeFlow {
  const free = getPlan(target).price.month === 0;
  if (hasStripeSubscription(subscription)) return free ? "cancel" : "change";
  return free ? "local" : "checkout";
}

/** Stripe Price lookup keys carry the plan, so a webhook can be mapped back to the catalogue. */
export function lookupKeyFor(planKey: PlanKey, interval: BillingInterval) {
  return `atrium_${planKey}_${interval}`;
}

/**
 * The catalogue price ID for a Stripe price, or null when the lookup key is
 * unknown or the amount differs from the catalogue (a price edited in the
 * Stripe dashboard can't change what a workspace pays for).
 */
export function catalogueIdForStripePrice(price: { lookup_key: string | null; unit_amount: number | null; recurring: { interval: string } | null }) {
  const match = /^atrium_([a-z]+)_(month|year)$/.exec(price.lookup_key ?? "");
  if (!match || !(match[1] in PLANS)) return null;
  const planKey = match[1] as PlanKey;
  const interval = match[2] as BillingInterval;
  if (price.recurring?.interval !== interval) return null;
  if (price.unit_amount !== getPlan(planKey).price[interval]) return null;
  return priceIdFor(planKey, interval);
}
