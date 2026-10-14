import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
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
        "relative flex flex-col rounded-2xl border p-6 sm:p-7",
        plan.recommended
          ? "border-cyan-400/50 bg-gradient-to-b from-cyan-500/[0.12] to-[#0e1c28]/90 shadow-[0_0_50px_rgba(34,211,238,.14)]"
          : "border-line bg-surface/80",
      )}
    >
      {plan.recommended && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/40 bg-[#0b1f2c] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-200">
          <Sparkles size={12} aria-hidden="true" /> Recommended
        </span>
      )}
      <Heading className="text-lg font-semibold text-ink">{plan.name}</Heading>
      <p className="mt-1.5 min-h-[40px] text-sm text-ink-muted">{plan.tagline}</p>
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tight text-ink tabular-nums">{free ? "Free" : formatMoney(perMonth)}</span>
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
