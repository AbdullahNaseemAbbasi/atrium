import { stripe, stripeEnabled } from "@/lib/billing/stripe";
import { stripeLookups, translateStripeEvent } from "@/lib/billing/stripe-events";
import { processBillingEvent } from "@/lib/billing/webhooks";
import { getDbWith, saveDb } from "@/lib/data/store";

/**
 * Stripe webhook endpoint (test mode).
 *
 * The `Stripe-Signature` header is checked against STRIPE_WEBHOOK_SECRET over
 * the exact raw body before anything else happens. Verified events are
 * translated (lib/billing/stripe-events.ts) and applied by the same processor
 * as every other billing event: duplicates are skipped, older subscription
 * events can't roll the plan back, and the plan comes from the catalogue.
 * A failed event answers 500 so Stripe retries it.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!stripeEnabled()) return Response.json({ received: false, message: "Stripe isn't enabled." }, { status: 404, headers });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ received: false, message: "STRIPE_WEBHOOK_SECRET isn't set." }, { status: 500, headers });

  const rawBody = await request.text();
  if (rawBody.length > 512 * 1024) return Response.json({ received: false, message: "Payload too large." }, { status: 413, headers });

  let event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return Response.json({ received: false, message: "Signature does not match." }, { status: 400, headers });
  }

  const translation = await translateStripeEvent(event, stripeLookups(stripe()));
  if ("ignored" in translation) return Response.json({ received: true, message: translation.ignored }, { headers });

  // Stripe sends a checkout's events together. One workspace's events run one at a time, each on
  // data loaded after the previous one saved, so the same plan change isn't applied (and announced) twice.
  const results = await oneAtATime(translation.organizationId, async () => {
    const db = await getDbWith([translation.organizationId]);
    const applied = translation.events.map((normalized) => processBillingEvent(db, normalized, { ip: "stripe" }));
    await saveDb();
    return applied;
  });
  const failed = results.find((result) => result.status === "failed");
  return Response.json(
    { received: !failed, status: failed ? "failed" : results.at(-1)?.status, message: results.map((result) => result.message).join(" ") },
    { status: failed ? 500 : 200, headers },
  );
}

/**
 * Runs `work` after any earlier work for the same key in this server process.
 * Covers a single Node server (and local development). Several serverless
 * instances can still overlap; the processor's idempotency keeps that safe,
 * at worst with a repeated notification.
 */
const queues = new Map<string, Promise<unknown>>();

async function oneAtATime<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(work);
  const settled = run.catch(() => undefined);
  queues.set(key, settled);
  try {
    return await run;
  } finally {
    if (queues.get(key) === settled) queues.delete(key);
  }
}
