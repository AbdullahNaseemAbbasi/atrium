import type { BillingInterval, PlanKey } from "@/lib/data/types";
import { PLANS } from "./plans";

/**
 * Trusted price catalogue (test mode). The browser only ever sends a plan key
 * and an interval; the server maps them to a provider price ID and amount
 * here. Webhooks map a price ID back to a plan, so a forged or unknown price
 * can never change what a workspace is on.
 */
export interface TrustedPrice {
  priceId: string;
  planKey: PlanKey;
  interval: BillingInterval;
  amountCents: number;
  currency: "USD";
}

export function priceIdFor(planKey: PlanKey, interval: BillingInterval) {
  return `price_TEST_${planKey}_${interval}`;
}

export function trustedPrice(planKey: PlanKey, interval: BillingInterval): TrustedPrice {
  return { priceId: priceIdFor(planKey, interval), planKey, interval, amountCents: PLANS[planKey].price[interval], currency: "USD" };
}

const BY_ID = new Map<string, TrustedPrice>(
  (Object.keys(PLANS) as PlanKey[]).flatMap((planKey) =>
    (["month", "year"] as BillingInterval[]).map((interval) => [priceIdFor(planKey, interval), trustedPrice(planKey, interval)] as const),
  ),
);

/** Returns null for any price ID that isn't in the catalogue. */
export function priceFromId(priceId: string): TrustedPrice | null {
  return BY_ID.get(priceId) ?? null;
}

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && value in PLANS;
}

export function isInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year";
}
