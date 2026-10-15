"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import type { BillingInterval, PlanKey } from "@/lib/data/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";

type Relation = "current" | "upgrade" | "downgrade" | "switch";

export interface ComparisonPlan {
  key: PlanKey;
  name: string;
  tagline: string;
  price: Record<BillingInterval, number>;
  highlights: string[];
  recommended: boolean;
  relation: Record<BillingInterval, Relation>;
  blockers: { key: string; message: string }[];
}

/** Plan cards with a monthly / yearly switch. Prices shown here are display only; checkout re-reads them on the server. */
export function PlanComparison({
  plans,
  currentInterval,
  base,
  canManage,
}: {
  plans: ComparisonPlan[];
  currentInterval: BillingInterval;
  base: string;
  canManage: boolean;
}) {
  const [interval, setBillingInterval] = React.useState<BillingInterval>(currentInterval);
  const maxSaving = Math.max(
    ...plans.filter((plan) => plan.price.month > 0).map((plan) => Math.round((1 - plan.price.year / (plan.price.month * 12)) * 100)),
  );

  return (
    <div>
      <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div role="radiogroup" aria-label="Billing interval" className="inline-flex w-fit rounded-xl border border-line bg-white/[0.02] p-1">
          {(["month", "year"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => setBillingInterval(value)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm transition",
                interval === value ? "bg-cyan-500/15 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,.15)]" : "text-ink-muted hover:text-ink",
              )}
            >
              {value === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-faint">Yearly billing saves up to {maxSaving}%. Prices in USD, before tax.</p>
      </div>

      <ul className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const relation = plan.relation[interval];
          const free = plan.price.month === 0;
          const monthly = interval === "year" ? Math.round(plan.price.year / 12) : plan.price.month;
          const blocked = relation === "downgrade" && plan.blockers.length > 0;
          const href = `${base}/billing/checkout?plan=${plan.key}&interval=${free ? "month" : interval}`;
          return (
            <li
              key={plan.key}
              className={cn(
                "relative flex flex-col rounded-2xl border p-5",
                relation === "current"
                  ? "border-cyan-400/50 bg-cyan-500/[0.06] shadow-[0_0_24px_rgba(34,211,238,.08)]"
                  : "border-line bg-white/[0.02]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
                {relation === "current" ? (
                  <Badge tone="cyan">
                    Current plan
                  </Badge>
                ) : plan.recommended ? (
                  <Badge tone="violet">Most popular</Badge>
                ) : null}
              </div>
              <p className="mt-1 min-h-[2.5rem] text-sm text-ink-muted">{plan.tagline}</p>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold text-ink">{free ? "Free" : formatMoney(monthly)}</span>
                {!free && <span className="text-sm text-ink-faint">/ month</span>}
              </p>
              <p className="mt-1 h-4 text-xs text-ink-faint">
                {free ? "No card needed" : interval === "year" ? `${formatMoney(plan.price.year)} billed yearly` : "Billed monthly"}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink-secondary">
                {plan.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={15} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                {blocked && (
                  <div className="mb-3 space-y-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3 text-xs text-amber-100/90">
                    <p className="flex items-center gap-1.5 font-medium text-amber-200">
                      <AlertTriangle size={13} aria-hidden="true" /> Your usage is above this plan
                    </p>
                    {plan.blockers.map((blocker) => (
                      <p key={blocker.key}>{blocker.message}</p>
                    ))}
                  </div>
                )}
                {relation === "current" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Your current plan
                  </Button>
                ) : !canManage ? (
                  <p className="text-center text-xs text-ink-faint">Only the owner or billing manager can change plans.</p>
                ) : blocked ? (
                  <Button variant="outline" className="w-full" disabled>
                    Downgrade unavailable
                  </Button>
                ) : (
                  <Link
                    href={href}
                    className={buttonClasses({
                      variant: relation === "upgrade" ? "primary" : relation === "switch" ? "secondary" : "outline",
                      className: "w-full",
                    })}
                  >
                    {relation === "upgrade"
                      ? `Upgrade to ${plan.name}`
                      : relation === "switch"
                        ? `Switch to ${interval === "year" ? "yearly" : "monthly"}`
                        : `Downgrade to ${plan.name}`}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
