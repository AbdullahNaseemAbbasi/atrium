import "server-only";
import { addMonths, addYears, differenceInCalendarDays, parseISO } from "date-fns";
import { notFound } from "next/navigation";
import { requireTeamContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getPlan, PLAN_ORDER, PLANS } from "@/lib/billing/plans";
import { isInterval, isPlanKey, trustedPrice } from "@/lib/billing/prices";
import { computeUsage, downgradeBlockers, usageMeters, type DowngradeBlocker } from "@/lib/billing/usage";
import type { TeamContext } from "../access";
import { getDb } from "../store";
import type { BillingInterval, Database, PlanKey, Subscription } from "../types";

/** A workspace without a subscription row is on the free Starter plan. */
export function subscriptionFor(db: Database, organizationId: string): Subscription {
  return (
    db.subscriptions.find((item) => item.organizationId === organizationId) ?? {
      id: `sub_free_${organizationId}`,
      organizationId,
      planKey: "starter",
      status: "active",
      interval: "month",
      currentPeriodEnd: new Date().toISOString(),
      cancelAtPeriodEnd: false,
    }
  );
}

async function requireBilling(orgSlug: string, permission: "billing.view" | "billing.manage"): Promise<TeamContext> {
  const ctx = await requireTeamContext(orgSlug);
  // Billing is invisible to roles without access: 404, not 403.
  if (!can(ctx.role, permission)) notFound();
  return ctx;
}

export type PlanRelation = "current" | "upgrade" | "downgrade" | "switch";

export function planRelation(current: Subscription, target: PlanKey, interval: BillingInterval): PlanRelation {
  const from = PLAN_ORDER.indexOf(current.planKey);
  const to = PLAN_ORDER.indexOf(target);
  if (from === to) return current.interval === interval || target === "starter" ? "current" : "switch";
  return to > from ? "upgrade" : "downgrade";
}

export async function getBillingOverview(orgSlug: string) {
  const ctx = await requireBilling(orgSlug, "billing.view");
  const db = getDb();
  const now = new Date();
  const subscription = subscriptionFor(db, ctx.org.id);
  const plan = getPlan(subscription.planKey);
  const usage = computeUsage(db, ctx.org.id);
  const base = `/w/${ctx.org.slug}`;

  return {
    base,
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    canManage: can(ctx.role, "billing.manage"),
    isBillingRole: ctx.role === "billing",
    subscription: {
      planKey: subscription.planKey,
      planName: plan.name,
      tagline: plan.tagline,
      status: subscription.status,
      interval: subscription.interval,
      priceCents: plan.price[subscription.interval],
      currentPeriodEnd: subscription.currentPeriodEnd,
      daysLeft: Math.max(0, differenceInCalendarDays(parseISO(subscription.currentPeriodEnd), now)),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEndsAt: subscription.trialEndsAt ?? null,
      paymentMethod: subscription.paymentMethod ?? null,
      isFree: plan.price.month === 0,
    },
    meters: usageMeters(plan, usage),
    plans: PLAN_ORDER.map((key) => {
      const target = PLANS[key];
      return {
        key,
        name: target.name,
        tagline: target.tagline,
        price: target.price,
        highlights: target.highlights,
        recommended: Boolean(target.recommended),
        relation: { month: planRelation(subscription, key, "month"), year: planRelation(subscription, key, "year") },
        blockers: downgradeBlockers(target, usage),
      };
    }),
    invoices: db.invoices
      .filter((item) => item.organizationId === ctx.org.id)
      .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
      .map((item) => ({ ...item, downloadHref: `/api/w/${ctx.org.slug}/invoices/${item.id}` })),
  };
}

export type BillingOverview = Awaited<ReturnType<typeof getBillingOverview>>;

export interface CheckoutSummary {
  base: string;
  orgSlug: string;
  orgName: string;
  email: string;
  plan: { key: PlanKey; name: string; tagline: string; highlights: string[] };
  interval: BillingInterval;
  amountCents: number;
  monthlyEquivalentCents: number;
  yearlySavingsCents: number;
  relation: PlanRelation;
  currentPlanName: string;
  currentInterval: BillingInterval;
  renewsOn: string;
  blockers: DowngradeBlocker[];
}

/** Checkout requires `billing.manage`. The amount always comes from the server-side catalogue. */
export async function getCheckout(orgSlug: string, planParam: string | undefined, intervalParam: string | undefined): Promise<CheckoutSummary | null> {
  const ctx = await requireBilling(orgSlug, "billing.manage");
  if (!isPlanKey(planParam)) return null;
  const interval: BillingInterval = isInterval(intervalParam) ? intervalParam : "month";
  const db = getDb();
  const now = new Date();
  const subscription = subscriptionFor(db, ctx.org.id);
  const plan = getPlan(planParam);
  const price = trustedPrice(planParam, interval);
  const effectiveInterval: BillingInterval = plan.price.month === 0 ? "month" : interval;
  return {
    base: `/w/${ctx.org.slug}`,
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    email: ctx.user.email,
    plan: { key: plan.key, name: plan.name, tagline: plan.tagline, highlights: plan.highlights },
    interval: effectiveInterval,
    amountCents: price.amountCents,
    monthlyEquivalentCents: effectiveInterval === "year" ? Math.round(plan.price.year / 12) : plan.price.month,
    yearlySavingsCents: Math.max(0, plan.price.month * 12 - plan.price.year),
    relation: planRelation(subscription, plan.key, effectiveInterval),
    currentPlanName: getPlan(subscription.planKey).name,
    currentInterval: subscription.interval,
    renewsOn: (effectiveInterval === "year" ? addYears(now, 1) : addMonths(now, 1)).toISOString(),
    blockers: downgradeBlockers(plan, computeUsage(db, ctx.org.id)),
  };
}
