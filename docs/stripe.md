# Stripe (test mode)

With `STRIPE_SECRET_KEY` set and the app on Supabase, plan changes run
through Stripe's sandbox. Without it (unit tests, E2E tests, the in-memory
demo), the simulated checkout runs instead. Both feed the same billing
processor (`lib/billing/webhooks.ts`).

Test mode only: the app refuses `sk_live_` / `rk_live_` keys. Pay with
Stripe's test card `4242 4242 4242 4242`, any future date, any CVC.

## Setup

1. Create a Stripe account and stay in a sandbox. Live activation isn't
   needed (Stripe doesn't support Pakistan for live payments; the sandbox
   works from anywhere).
2. Put the sandbox secret key in `.env.local` as `STRIPE_SECRET_KEY`.
3. `pnpm stripe:setup` creates a product per paid plan, a monthly and a
   yearly price for each (lookup keys `atrium_<plan>_<interval>`), and a
   customer portal configuration. Run it again after changing plan prices
   in `lib/billing/plans.ts`; it only creates what's missing or changed.
4. Webhooks:
   - **Locally**, Stripe can't reach `localhost`, so the Stripe CLI forwards
     events (needs `STRIPE_API_KEY` set to the same key):
     ```bash
     npx @stripe/cli listen --print-secret     # put this in .env.local as STRIPE_WEBHOOK_SECRET
     npx @stripe/cli listen --forward-to localhost:3000/api/webhooks/stripe \
       --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed
     ```
   - **Deployed**, add an endpoint in the Stripe dashboard (Developers,
     Webhooks) for `https://<your domain>/api/webhooks/stripe` with the six
     events above, and set its signing secret as `STRIPE_WEBHOOK_SECRET`.

## Flows

`stripeFlowFor` (`lib/billing/stripe-flow.ts`) decides how a change runs:

| From | To | What happens |
|---|---|---|
| Free plan, or demo data | Paid plan | Stripe Checkout (hosted page) creates the subscription |
| Stripe subscription | Another paid plan | The subscription's price is swapped; the difference is invoiced now |
| Stripe subscription | Starter | Cancels at the end of the paid period, then the workspace is back on Starter |

"Cancel at period end" / "Resume" on the billing page update the Stripe
subscription. "Manage billing in Stripe" opens Stripe's customer portal
(cards, invoices, plan switches, cancelling). The app never writes the plan
itself in these flows: Stripe's webhooks do, and Realtime refreshes the
billing page when they land, usually within a few seconds.

## Webhooks

`/api/webhooks/stripe` checks the `Stripe-Signature` header against the raw
body, then `translateStripeEvent` (`lib/billing/stripe-events.ts`) turns the
event into the processor's events:

- `checkout.session.completed` → the checkout (customer, card) plus the
  plan, so the plan doesn't depend on which webhook arrives first.
- `customer.subscription.created` / `updated` → the plan, status, period
  end, cancellation and card, read through the SDK so the payload's API
  version doesn't matter.
- `customer.subscription.deleted` → back to Starter.
- `invoice.paid` / `invoice.payment_failed` → invoices and past-due status.

What keeps it correct:

- **Catalogue:** a Stripe price maps to a plan only through its lookup key,
  and only if its amount and interval match `lib/billing/plans.ts`. An
  edited price is rejected.
- **Idempotency and order:** duplicates are skipped by event ID; an older
  subscription event can't roll the plan back.
- **One subscription per workspace:** events for another subscription are
  rejected, except that the first real subscription replaces the demo IDs.
- **One at a time:** a workspace's webhooks are processed in turn within a
  server, so a checkout's simultaneous events don't announce the same
  change twice.
- **Failures answer 500,** so Stripe retries them.
- **USD only:** Checkout runs with adaptive pricing off, so customers pay
  the catalogue price in USD rather than a converted local amount.

Every Stripe object Atrium creates carries the workspace ID (Checkout
Session `client_reference_id`, subscription and customer metadata).
