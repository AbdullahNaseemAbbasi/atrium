import Link from "next/link";
import { Check } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { monthlyEquivalent, type Plan } from "@/lib/billing/plans";
import type { BillingInterval } from "@/lib/data/types";
import { buttonClasses } from "@/components/ui/button";

export const PLAN_CTA: Record<Plan["key"], { href: string; label: string }> = {
  starter: { href: "/signup", label: "Start free" },
  professional: { href: "/signup", label: "Start 14-day trial" },
  agency: { href: "/contact?topic=sales", label: "Talk to us" },
};

/** Plan summary card. No hooks, so it renders on the server or inside a client toggle. */
export function PlanCard({ plan, interval = "month", headingLevel = "h3" }: { plan: Plan; interval?: BillingInterval; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const free = plan.price.month === 0;
  const perMonth = monthlyEquivalent(plan, interval);
  const cta = PLAN_CTA[plan.key];
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-6 sm:p-7",
        plan.recommended
          ? "border-cyan-400/50 bg-surface"
          : "border-line bg-surface/80",
      )}
    >
      {plan.recommended && (
        <p className="mb-2 text-sm font-medium text-cyan-300">Recommended</p>
      )}
      <Heading className="text-lg font-semibold text-ink">{plan.name}</Heading>
      <p className="mt-1.5 min-h-[40px] text-sm text-ink-muted">{plan.tagline}</p>
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold text-ink tabular-nums">{free ? "Free" : formatMoney(perMonth)}</span>
        {!free && <span className="text-sm text-ink-faint">/ month</span>}
      </div>
      <p className="mt-1.5 min-h-[20px] text-xs text-ink-faint">
        {free
          ? "No card needed"
          : interval === "year"
            ? `Billed yearly at ${formatMoney(plan.price.year)}`
            : `Billed monthly, or ${formatMoney(plan.price.year)} a year`}
      </p>
      <Link
        href={cta.href}
        className={buttonClasses({ variant: plan.recommended ? "primary" : "outline", size: "lg", className: "mt-6 w-full" })}
      >
        {cta.label}
      </Link>
      <ul className="mt-7 space-y-3 border-t border-line pt-6">
        {plan.highlights.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
            <Check size={16} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
