import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  Crown,
  Download,
  FlaskConical,
  Gauge,
  Layers,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { getBillingOverview, type BillingOverview } from "@/lib/data/queries/billing";
import { Badge, InvoiceStatusBadge, SubscriptionStatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, IconBox } from "@/components/ui/card";
import { FlashToast } from "@/components/ui/flash-toast";
import { CardSkeleton, EmptyState, FormNote, PageHeader, ProgressBar, Skeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { PlanComparison } from "@/components/billing/plan-comparison";
import { CancelSubscriptionButton } from "@/components/billing/subscription-actions";

export const metadata: Metadata = { title: "Billing & plans" };

export default function BillingPage({ params }: PageProps<"/w/[org]/billing">) {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <Billing params={params} />
    </Suspense>
  );
}

async function Billing({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await getBillingOverview(org);
  return (
    <>
      <FlashToast messages={{ upgraded: "Plan updated. The test payment and its invoice are recorded below." }} />
      <PageHeader
        title="Billing & plans"
        description={`Plan, usage and invoices for ${data.orgName}.`}
        actions={
          <Badge tone="amber" className="py-1.5">
            <FlaskConical size={13} aria-hidden="true" /> Test mode · no real charges
          </Badge>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <CurrentPlan data={data} />
        <Usage data={data} />
      </section>

      <Card className="mt-4" id="plans">
        <CardHeader
          icon={Layers}
          title="Compare plans"
          description={data.canManage ? "Upgrades apply straight away. Downgrades need usage within the new plan's limits." : "Only the owner or billing manager can change plans."}
        />
        <PlanComparison plans={data.plans} currentInterval={data.subscription.interval} base={data.base} canManage={data.canManage} />
      </Card>

      <Invoices data={data} />
    </>
  );
}

function CurrentPlan({ data }: { data: BillingOverview }) {
  const sub = data.subscription;
  const card = sub.paymentMethod;
  const intervalText = sub.interval === "year" ? "year" : "month";
  return (
    <Card className="flex flex-col">
      <CardHeader icon={Crown} tone="amber" title="Current plan" action={<SubscriptionStatusBadge status={sub.status} />} />
      <div className="flex flex-1 flex-col px-4 pb-5 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-3xl font-semibold text-ink">{sub.planName}</p>
          <p className="text-ink-secondary">
            {sub.isFree ? (
              "Free"
            ) : (
              <>
                <span className="text-xl font-semibold text-ink">{formatMoney(sub.priceCents)}</span>
                <span className="text-sm text-ink-faint"> / {intervalText}</span>
              </>
            )}
          </p>
        </div>
        <p className="mt-1 text-sm text-ink-muted">{sub.tagline}</p>

        {sub.cancelAtPeriodEnd && (
          <FormNote icon={AlertTriangle} tone="warning" className="mt-4">
            <span className="font-medium text-amber-100">Cancels on {formatDate(sub.currentPeriodEnd)}.</span> You keep every {sub.planName} feature until
            then. After that the workspace moves to the free Starter plan.
          </FormNote>
        )}
        {sub.status === "past_due" && (
          <FormNote icon={AlertTriangle} tone="warning" className="mt-4">
            The last test payment failed. Update the payment method to keep paid features.
          </FormNote>
        )}

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <Fact icon={CalendarClock} label={sub.trialEndsAt ? "Trial ends" : sub.cancelAtPeriodEnd ? "Access until" : sub.isFree ? "Current period ends" : "Renews on"}>
            {formatDate(sub.trialEndsAt ?? sub.currentPeriodEnd)}
            <span className="block text-xs text-ink-faint">
              {sub.daysLeft === 0 ? "Today" : `In ${sub.daysLeft} ${sub.daysLeft === 1 ? "day" : "days"}`} · billed {sub.interval === "year" ? "yearly" : "monthly"}
            </span>
          </Fact>
          <Fact icon={CreditCard} label="Payment method">
            {card ? (
              <>
                {card.brand} •••• {card.last4}
                <span className="block text-xs text-ink-faint">
                  Test card · expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}
                </span>
              </>
            ) : (
              <>
                None on file
                <span className="block text-xs text-ink-faint">Added when you choose a paid plan</span>
              </>
            )}
          </Fact>
        </dl>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <a href="#plans" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Change plan
          </a>
          {data.canManage && !sub.isFree && sub.status !== "canceled" && (
            <CancelSubscriptionButton
              orgSlug={data.orgSlug}
              cancelAtPeriodEnd={sub.cancelAtPeriodEnd}
              periodEndText={formatDate(sub.currentPeriodEnd)}
              planName={sub.planName}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function Fact({ icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] p-3.5">
      <IconBox icon={icon} size="sm" />
      <div className="min-w-0">
        <dt className="text-xs text-ink-faint">{label}</dt>
        <dd className="mt-0.5 text-sm text-ink">{children}</dd>
      </div>
    </div>
  );
}

function Usage({ data }: { data: BillingOverview }) {
  return (
    <Card>
      <CardHeader icon={Gauge} title="Usage" description={`Measured live against the ${data.subscription.planName} limits.`} />
      <ul className="space-y-5 px-4 pb-5 sm:px-5">
        {data.meters.map((meter) => {
          const tone = meter.level === "limit" ? "red" : meter.level === "warning" ? "amber" : "cyan";
          return (
            <li key={meter.key}>
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-ink-secondary">{meter.label}</span>
                <span className="tabular-nums text-ink">
                  {meter.usedText}
                  <span className="text-ink-faint"> {meter.limit === null ? "· Unlimited" : `of ${meter.limitText}`}</span>
                </span>
              </div>
              <ProgressBar
                value={meter.limit === null ? 0 : meter.percent}
                tone={tone}
                label={`${meter.label}: ${meter.usedText} of ${meter.limitText}`}
              />
              {meter.level !== "ok" && (
                <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs", meter.level === "limit" ? "text-red-300" : "text-amber-300")}>
                  <AlertTriangle size={12} aria-hidden="true" />
                  {meter.level === "limit"
                    ? meter.used > (meter.limit ?? 0)
                      ? "Over the limit. New items are blocked until you upgrade or free some up."
                      : "Limit reached. Upgrade to add more."
                    : `Over 80% used. ${meter.percent}% of your limit.`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Invoices({ data }: { data: BillingOverview }) {
  return (
    <Card className="mt-4">
      <CardHeader icon={Receipt} title="Invoices" description="Receipts download as a simple HTML file. All amounts are test-mode records." />
      {data.invoices.length === 0 ? (
        <EmptyState
          compact
          icon={Receipt}
          title="No invoices yet"
          description="Invoices appear here after the first payment on a paid plan."
          action={
            <a href="#plans" className={buttonClasses({ variant: "secondary" })}>
              Compare plans
            </a>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-white/[0.05] border-t border-line px-4 pb-2 sm:hidden">
            {data.invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    {invoice.number} <InvoiceStatusBadge status={invoice.status} />
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                  </p>
                </div>
                <span className="tabular-nums text-ink-secondary">{formatMoney(invoice.amountCents, invoice.currency)}</span>
                <a
                  href={invoice.downloadHref}
                  download
                  className={buttonClasses({ variant: "outline", size: "icon-sm" })}
                  aria-label={`Download receipt ${invoice.number}`}
                >
                  <Download size={14} />
                </a>
              </li>
            ))}
          </ul>
          <TableWrap className="hidden sm:block">
            <Table className="min-w-[680px]">
              <THead>
                <Th>Invoice</Th>
                <Th>Billing period</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th>Issued</Th>
                <Th className="text-right">
                  <span className="sr-only">Download</span>
                </Th>
              </THead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <Tr key={invoice.id}>
                    <Td className="whitespace-nowrap font-medium text-ink">{invoice.number}</Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums text-ink-secondary">{formatMoney(invoice.amountCents, invoice.currency)}</Td>
                    <Td>
                      <InvoiceStatusBadge status={invoice.status} />
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(invoice.issuedAt)}</Td>
                    <Td className="text-right">
                      <a
                        href={invoice.downloadHref}
                        download
                        className={buttonClasses({ variant: "outline", size: "xs" })}
                        aria-label={`Download receipt ${invoice.number}`}
                      >
                        <Download size={13} /> Receipt
                      </a>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}
    </Card>
  );
}

function BillingSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
      <Skeleton className="mt-4 h-[460px] rounded-2xl" />
    </div>
  );
}
