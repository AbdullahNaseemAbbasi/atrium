import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, CreditCard, FlaskConical, Layers, ShieldCheck } from "lucide-react";
import { firstParam, formatDate, formatMoney } from "@/lib/utils";
import { getCheckout, type CheckoutSummary } from "@/lib/data/queries/billing";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { CheckoutForm } from "@/components/billing/checkout-form";

export const metadata: Metadata = { title: "Checkout · Billing" };

export default function CheckoutPage({ params, searchParams }: PageProps<"/w/[org]/billing/checkout">) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <Checkout params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getCheckout(org, firstParam(query.plan), firstParam(query.interval));
  const billingHref = `/w/${org}/billing`;

  if (!data) {
    return (
      <>
        <PageHeader title="Checkout" breadcrumbs={[{ label: "Billing", href: billingHref }, { label: "Checkout" }]} />
        <Card>
          <EmptyState
            icon={Layers}
            title="Choose a plan first"
            description="This checkout link doesn't name a plan we offer. Pick one from the plan comparison."
            action={
              <Link href={`${billingHref}#plans`} className={buttonClasses()}>
                Compare plans
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Checkout"
        breadcrumbs={[{ label: "Billing", href: `${data.base}/billing` }, { label: "Checkout" }]}
        description={
          data.relation === "switch"
            ? `Switch ${data.orgName} to ${data.interval === "year" ? "yearly" : "monthly"} billing on ${data.plan.name}.`
            : `${data.relation === "upgrade" ? "Upgrade" : "Move"} ${data.orgName} from ${data.currentPlanName} to ${data.plan.name}.`
        }
        actions={
          <Link href={`${data.base}/billing`} className={buttonClasses({ variant: "ghost" })}>
            <ArrowLeft size={16} /> Back to billing
          </Link>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-amber-500/25 bg-amber-500/[0.08] px-5 py-3 text-sm text-amber-100">
          <FlaskConical size={16} className="flex-none text-amber-300" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-amber-200">Test mode.</strong> This checkout imitates the payment provider&apos;s hosted page. No card is
            charged and no card details are collected.
          </span>
        </div>
        <div className="grid lg:grid-cols-[1.1fr_.9fr]">
          <OrderSummary data={data} />
          <Payment data={data} />
        </div>
      </Card>
    </>
  );
}

function OrderSummary({ data }: { data: CheckoutSummary }) {
  const free = data.amountCents === 0;
  const period = data.interval === "year" ? "year" : "month";
  return (
    <section aria-labelledby="summary-title" className="p-5 sm:p-7">
      <p className="text-xs font-medium text-ink-faint">Atrium · {data.orgName}</p>
      <h2 id="summary-title" className="mt-2 text-xl font-semibold text-ink">
        {data.plan.name} plan
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{data.plan.tagline}</p>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold text-ink">{free ? "Free" : formatMoney(data.amountCents)}</span>
        {!free && <span className="text-sm text-ink-faint">per {period}</span>}
      </p>
      {data.interval === "year" && data.yearlySavingsCents > 0 && (
        <p className="mt-1 text-sm text-emerald-300">{formatMoney(data.yearlySavingsCents)} less than 12 monthly payments.</p>
      )}

      <dl className="mt-6 divide-y divide-white/[0.06] border-y border-white/[0.06] text-sm">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-ink-muted">
            Atrium {data.plan.name} · billed {data.interval === "year" ? "yearly" : "monthly"}
          </dt>
          <dd className="tabular-nums text-ink">{formatMoney(data.amountCents)}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-ink-muted">Tax</dt>
          <dd className="text-ink-faint">Not calculated in test mode</dd>
        </div>
        <div className="flex justify-between gap-4 py-3 font-semibold">
          <dt className="text-ink">Due today</dt>
          <dd className="tabular-nums text-ink">{formatMoney(data.amountCents)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-ink-faint">
        {free
          ? "Starter is free. Your paid subscription ends now and no further invoices are issued."
          : `A new billing period starts today and renews on ${formatDate(data.renewsOn)} at ${formatMoney(data.amountCents)}. Test mode doesn't prorate unused time. Cancel any time from Billing.`}
      </p>

      <ul className="mt-6 grid gap-2 text-sm text-ink-secondary sm:grid-cols-2">
        {data.plan.highlights.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check size={15} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Payment({ data }: { data: CheckoutSummary }) {
  const free = data.amountCents === 0;
  const blocked = data.relation === "downgrade" && data.blockers.length > 0;
  const current = data.relation === "current";
  return (
    <section aria-labelledby="payment-title" className="border-t border-line bg-white/[0.015] p-5 sm:p-7 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <h2 id="payment-title" className="font-semibold text-ink">
          {free ? "Confirm change" : "Payment"}
        </h2>
        <Badge tone="amber">
          <FlaskConical size={12} aria-hidden="true" /> Test mode
        </Badge>
      </div>

      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <dt className="text-xs text-ink-faint">Email for receipts</dt>
          <dd className="mt-1 rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5 text-ink-secondary">{data.email}</dd>
        </div>
        {!free && (
          <div>
            <dt className="text-xs text-ink-faint">Card (test card, read only)</dt>
            <dd className="mt-1 overflow-hidden rounded-xl border border-line bg-white/[0.02]">
              <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5 font-mono text-ink-secondary">
                <CreditCard size={16} className="flex-none text-ink-faint" aria-hidden="true" />
                4242 4242 4242 4242
              </div>
              <div className="grid grid-cols-2 font-mono text-ink-secondary">
                <span className="border-r border-line px-3.5 py-2.5">12 / 34</span>
                <span className="px-3.5 py-2.5">CVC 123</span>
              </div>
            </dd>
            <p className="mt-1.5 text-xs text-ink-faint">Stripe&apos;s public test card. Never enter a real card in a test checkout.</p>
          </div>
        )}
      </dl>

      <div className="mt-6">
        {blocked ? (
          <div className="mb-4 space-y-1.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 text-sm text-amber-100/90" role="alert">
            <p className="flex items-center gap-1.5 font-medium text-amber-200">
              <AlertTriangle size={15} aria-hidden="true" /> You can&apos;t move to {data.plan.name} yet
            </p>
            {data.blockers.map((blocker) => (
              <p key={blocker.key} className="text-xs">
                {blocker.message}
              </p>
            ))}
          </div>
        ) : current ? (
          <p className="mb-4 rounded-xl border border-line bg-white/[0.02] p-3.5 text-sm text-ink-muted">
            You&apos;re already on {data.plan.name}, billed {data.currentInterval === "year" ? "yearly" : "monthly"}.
          </p>
        ) : null}
        <CheckoutForm
          orgSlug={data.orgSlug}
          plan={data.plan.key}
          interval={data.interval}
          disabled={blocked || current}
          payLabel={free ? `Switch to ${data.plan.name}` : `Pay ${formatMoney(data.amountCents)} with test card`}
        />
        <p className="mt-4 flex items-start gap-2 text-xs text-ink-faint">
          <ShieldCheck size={14} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
          The price is set on the server from the plan catalogue. Completing this sends signed test webhooks through the same handler the live
          provider uses.
        </p>
      </div>
    </section>
  );
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-[520px] rounded-2xl" />
    </div>
  );
}
