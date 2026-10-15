import "server-only";
import Stripe from "stripe";
import type { BillingInterval, PlanKey } from "@/lib/data/types";
import { usesSupabase } from "@/lib/supabase/config";
import { lookupKeyFor } from "./stripe-flow";

/**
 * Stripe, in test mode only. It's used when STRIPE_SECRET_KEY is set and the
 * app runs on Supabase: webhooks need a database that outlives the request.
 * Unit tests, E2E tests and the in-memory demo keep the simulated checkout.
 * Products, prices and the customer portal come from `pnpm stripe:setup`.
 */
export function stripeEnabled() {
  return usesSupabase() && Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!/^(sk|rk)_test_/.test(key)) {
    throw new Error("Atrium runs Stripe in test mode only: STRIPE_SECRET_KEY must be a sk_test_ or rk_test_ key.");
  }
  client ??= new Stripe(key, { maxNetworkRetries: 1, timeout: 20_000, appInfo: { name: "Atrium" } });
  return client;
}

/** Thrown when Stripe hasn't been prepared with `pnpm stripe:setup`. */
export class StripeSetupError extends Error {}

const priceIds = new Map<string, string>();

/** The Stripe price for a plan, found by its lookup key. */
export async function stripePriceId(planKey: PlanKey, interval: BillingInterval): Promise<string> {
  const lookupKey = lookupKeyFor(planKey, interval);
  const cached = priceIds.get(lookupKey);
  if (cached) return cached;
  const { data } = await stripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (!data[0]) throw new StripeSetupError(`No Stripe price with lookup key ${lookupKey}. Run pnpm stripe:setup.`);
  priceIds.set(lookupKey, data[0].id);
  return data[0].id;
}

let portalConfiguration: string | undefined;

/** The customer portal configuration made by `pnpm stripe:setup` (plan switching, cancel, cards, invoices). */
export async function portalConfigurationId(): Promise<string> {
  if (portalConfiguration) return portalConfiguration;
  const { data } = await stripe().billingPortal.configurations.list({ active: true, limit: 100 });
  const found = data.find((item) => item.metadata?.atrium === "portal");
  if (!found) throw new StripeSetupError("No Atrium customer portal configuration in Stripe. Run pnpm stripe:setup.");
  portalConfiguration = found.id;
  return found.id;
}
