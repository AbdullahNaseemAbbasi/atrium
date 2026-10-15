/**
 * Prepares the Stripe sandbox for Atrium: one product per paid plan, a
 * monthly and a yearly price for each (with lookup keys the app and the
 * webhooks use), and a customer portal configuration. Safe to run again:
 * it only creates what's missing or out of date.
 *
 *   pnpm stripe:setup
 *
 * Reads STRIPE_SECRET_KEY from .env.local. Test keys only.
 */
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { PLAN_ORDER, PLANS } from "../lib/billing/plans";
import { lookupKeyFor } from "../lib/billing/stripe-flow";
import type { BillingInterval } from "../lib/data/types";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const index = line.indexOf("=");
  if (index > 0 && !line.startsWith("#")) process.env[line.slice(0, index)] ??= line.slice(index + 1);
}

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!/^(sk|rk)_test_/.test(key)) {
  console.error("STRIPE_SECRET_KEY must be a Stripe test key (sk_test_ or rk_test_).");
  process.exit(1);
}
const stripe = new Stripe(key);

async function main() {
  const products = (await stripe.products.list({ active: true, limit: 100 })).data;
  const portalProducts: { product: string; prices: string[] }[] = [];

  for (const planKey of PLAN_ORDER) {
    const plan = PLANS[planKey];
    if (plan.price.month === 0) continue;

    let product = products.find((item) => item.metadata?.atrium_plan === planKey);
    if (!product) {
      product = await stripe.products.create({ name: `Atrium ${plan.name}`, description: plan.tagline, metadata: { atrium_plan: planKey } });
      console.log(`created product ${product.name}`);
    }

    const priceIds: string[] = [];
    for (const interval of ["month", "year"] as BillingInterval[]) {
      const lookupKey = lookupKeyFor(planKey, interval);
      const amount = plan.price[interval];
      const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })).data[0];
      const matches =
        existing?.active && existing.unit_amount === amount && existing.currency === "usd" && existing.recurring?.interval === interval && existing.product === product.id;
      if (matches) {
        priceIds.push(existing.id);
        console.log(`kept price ${lookupKey}`);
        continue;
      }
      const price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: amount,
        recurring: { interval },
        lookup_key: lookupKey,
        // Moves the lookup key from an outdated price to this one.
        transfer_lookup_key: true,
        nickname: `${plan.name} ${interval === "year" ? "yearly" : "monthly"}`,
      });
      if (existing?.active) await stripe.prices.update(existing.id, { active: false });
      priceIds.push(price.id);
      console.log(`created price ${lookupKey}`);
    }
    portalProducts.push({ product: product.id, prices: priceIds });
  }

  const features = {
    customer_update: { enabled: true, allowed_updates: ["email" as const, "name" as const] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" as const },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price" as const],
      proration_behavior: "always_invoice" as const,
      products: portalProducts,
    },
  };
  const portal = (await stripe.billingPortal.configurations.list({ active: true, limit: 100 })).data.find((item) => item.metadata?.atrium === "portal");
  if (portal) {
    await stripe.billingPortal.configurations.update(portal.id, { features });
    console.log("updated customer portal configuration");
  } else {
    await stripe.billingPortal.configurations.create({
      business_profile: { headline: "Atrium billing (test mode)" },
      features,
      metadata: { atrium: "portal" },
    });
    console.log("created customer portal configuration");
  }
  console.log("Stripe sandbox is ready.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
