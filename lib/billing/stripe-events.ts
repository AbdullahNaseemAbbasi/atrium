import type Stripe from "stripe";
import { priceFromId } from "./prices";
import { catalogueIdForStripePrice } from "./stripe-flow";
import type { BillingEvent } from "./webhooks";

/**
 * Turns verified Stripe events into the billing events the shared processor
 * understands (lib/billing/webhooks.ts), so Stripe and the simulated checkout
 * get the same idempotency, ordering, catalogue checks, audit entries and
 * notifications. The few lookups it needs are passed in, so tests run
 * without the network.
 *
 * Every Stripe object Atrium creates carries the workspace ID: the Checkout
 * Session (client_reference_id), the subscription (metadata) and the
 * customer (metadata).
 */
export interface StripeLookups {
  /** The subscription with its default payment method expanded. */
  subscription(id: string): Promise<Stripe.Subscription>;
  /** The workspace ID in the customer's metadata. */
  customerOrganization(id: string): Promise<string | null>;
}

export type Translation = { organizationId: string; events: BillingEvent[] } | { ignored: string };

type SubscriptionStatus = Extract<BillingEvent, { type: "customer.subscription.updated" }>["data"]["status"];

const STATUS: Record<string, SubscriptionStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  unpaid: "past_due",
  paused: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
};

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : value?.id);

function card(method: string | Stripe.PaymentMethod | null | undefined) {
  if (!method || typeof method === "string" || !method.card) return undefined;
  const brand = method.card.brand === "amex" ? "Amex" : method.card.brand.charAt(0).toUpperCase() + method.card.brand.slice(1);
  return { brand, last4: method.card.last4, expMonth: method.card.exp_month, expYear: method.card.exp_year };
}

/** The catalogue price for the subscription's first item, or a marker the processor rejects as unknown. */
function priceIdOf(subscription: Stripe.Subscription) {
  const price = subscription.items.data[0]?.price;
  if (!price) return "unknown_price";
  return catalogueIdForStripePrice(price) ?? `unknown_${price.id}`;
}

function subscriptionEvent(id: string, created: number, subscription: Stripe.Subscription, organizationId: string): BillingEvent {
  const item = subscription.items.data[0];
  return {
    id,
    type: "customer.subscription.updated",
    created,
    data: {
      organizationId,
      subscriptionId: subscription.id,
      priceId: priceIdOf(subscription),
      status: STATUS[subscription.status] ?? "past_due",
      currentPeriodEnd: item?.current_period_end ?? created,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || Boolean(subscription.cancel_at),
      trialEnd: subscription.trial_end,
      initiatedByUserId: subscription.metadata?.initiatedByUserId || undefined,
      paymentMethod: card(subscription.default_payment_method),
    },
  };
}

async function organizationOf(metadata: Stripe.Metadata | null | undefined, customer: string | undefined, lookups: StripeLookups) {
  return metadata?.organizationId || (customer ? await lookups.customerOrganization(customer) : null);
}

export async function translateStripeEvent(event: Stripe.Event, lookups: StripeLookups): Promise<Translation> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return { ignored: "Not a subscription checkout." };
      if (session.payment_status === "unpaid") return { ignored: "Payment still pending; the invoice events will follow." };
      const organizationId = session.client_reference_id || session.metadata?.organizationId;
      const subscriptionId = idOf(session.subscription);
      const customerId = idOf(session.customer);
      if (!organizationId || !subscriptionId || !customerId) return { ignored: "Checkout without an Atrium workspace." };
      const subscription = await lookups.subscription(subscriptionId);
      return {
        organizationId,
        events: [
          {
            id: event.id,
            type: "checkout.session.completed",
            created: event.created,
            data: {
              organizationId,
              customerId,
              subscriptionId,
              priceId: priceIdOf(subscription),
              // The catalogue amount for the verified price. amount_total can be lower for good reasons
              // (customer credit from an earlier downgrade, proration), and the processor compares
              // this to the catalogue; what was actually charged arrives with invoice.paid.
              amountCents: priceFromId(priceIdOf(subscription))?.amountCents ?? session.amount_total ?? 0,
              currency: (session.currency ?? "usd").toUpperCase(),
              paymentMethod: card(subscription.default_payment_method),
              initiatedByUserId: session.metadata?.initiatedByUserId || undefined,
              recordInvoice: false,
            },
          },
          // Apply the plan in the same delivery, so it doesn't depend on which webhook arrives first.
          subscriptionEvent(`${event.id}_sub`, event.created, subscription, organizationId),
        ],
      };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const fromEvent = event.data.object;
      const organizationId = await organizationOf(fromEvent.metadata, idOf(fromEvent.customer), lookups);
      if (!organizationId) return { ignored: "Subscription without an Atrium workspace." };
      // Read the subscription through the SDK rather than from the payload: the payload's shape follows
      // the webhook endpoint's API version (period dates moved onto items in 2025), and the card is
      // only an ID there. The event's own time still decides ordering.
      const subscription = await lookups.subscription(fromEvent.id);
      return { organizationId, events: [subscriptionEvent(event.id, event.created, subscription, organizationId)] };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const organizationId = await organizationOf(subscription.metadata, idOf(subscription.customer), lookups);
      if (!organizationId) return { ignored: "Subscription without an Atrium workspace." };
      return {
        organizationId,
        events: [{ id: event.id, type: "customer.subscription.deleted", created: event.created, data: { organizationId, subscriptionId: subscription.id } }],
      };
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      if (invoice.amount_paid === 0) return { ignored: "Nothing was charged." };
      const organizationId = await organizationOf(invoice.parent?.subscription_details?.metadata, idOf(invoice.customer ?? undefined), lookups);
      if (!organizationId) return { ignored: "Invoice without an Atrium workspace." };
      const line = invoice.lines.data[0];
      return {
        organizationId,
        events: [
          {
            id: event.id,
            type: "invoice.paid",
            created: event.created,
            data: {
              organizationId,
              amountCents: invoice.amount_paid,
              currency: invoice.currency.toUpperCase(),
              periodStart: line?.period.start ?? invoice.period_start,
              periodEnd: line?.period.end ?? invoice.period_end,
            },
          },
        ],
      };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const organizationId = await organizationOf(invoice.parent?.subscription_details?.metadata, idOf(invoice.customer ?? undefined), lookups);
      if (!organizationId) return { ignored: "Invoice without an Atrium workspace." };
      return {
        organizationId,
        events: [
          {
            id: event.id,
            type: "invoice.payment_failed",
            created: event.created,
            data: { organizationId, amountCents: invoice.amount_due, currency: invoice.currency.toUpperCase() },
          },
        ],
      };
    }

    default:
      return { ignored: `Atrium doesn't use ${event.type}.` };
  }
}

/** Lookups against the live Stripe API. */
export function stripeLookups(client: Stripe): StripeLookups {
  return {
    subscription: (id) => client.subscriptions.retrieve(id, { expand: ["default_payment_method"] }),
    async customerOrganization(id) {
      const customer = await client.customers.retrieve(id);
      return "deleted" in customer && customer.deleted ? null : (customer.metadata?.organizationId ?? null);
    },
  };
}
