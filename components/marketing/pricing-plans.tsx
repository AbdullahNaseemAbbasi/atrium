"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PLAN_ORDER, PLANS } from "@/lib/billing/plans";
import type { BillingInterval } from "@/lib/data/types";
import { PlanCard } from "./plan-card";

/** Largest yearly discount across paid plans, as a whole percentage. */
function yearlySaving() {
  const savings = PLAN_ORDER.map((key) => PLANS[key])
    .filter((plan) => plan.price.month > 0)
    .map((plan) => 1 - plan.price.year / (plan.price.month * 12));
  return Math.floor(Math.max(0, ...savings) * 100);
}

export function PricingPlans() {
  const [interval, setBillingInterval] = React.useState<BillingInterval>("month");
  const saving = yearlySaving();
  const options: { value: BillingInterval; label: string }[] = [
    { value: "month", label: "Monthly" },
    { value: "year", label: "Yearly" },
  ];

  return (
    <div>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Billing interval" className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {options.map((option) => {
            const active = interval === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setBillingInterval(option.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    const next = option.value === "month" ? "year" : "month";
                    setBillingInterval(next);
                    (event.currentTarget.parentElement?.querySelector(`[data-value="${next}"]`) as HTMLButtonElement | null)?.focus();
                  }
                }}
                tabIndex={active ? 0 : -1}
                data-value={option.value}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition",
                  active ? "bg-cyan-500/20 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,.2)]" : "text-ink-muted hover:text-ink",
                )}
              >
                {option.label}
                {option.value === "year" && saving > 0 && (
                  <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">Save {saving}%</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Showing {interval === "year" ? "yearly" : "monthly"} prices.
      </p>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {PLAN_ORDER.map((key) => (
          <PlanCard key={key} plan={PLANS[key]} interval={interval} headingLevel="h2" />
        ))}
      </div>
    </div>
  );
}
