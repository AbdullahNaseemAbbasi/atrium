import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, IconBox } from "./card";
import { Sparkline, type SparkPoint } from "./sparkline";

export interface StatDelta {
  /** Signed change against the comparison period. */
  value: number;
  /** Named comparison period, for example "vs 30 days ago". */
  period: string;
  /** Whether an increase is good news for this metric. */
  upIsGood: boolean;
}

/**
 * Stat tile: label · value · optional delta vs a named period · optional
 * 12-week trend. Delta colour = direction × whether up is good, and the arrow
 * icon carries direction so colour is never the only signal.
 */
export function StatCard({
  icon,
  label,
  value,
  caption,
  delta,
  trend,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption?: string;
  delta?: StatDelta;
  trend?: SparkPoint[];
  danger?: boolean;
}) {
  return (
    <Card className="group relative p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/15">
      <div className="flex items-start gap-4">
        <IconBox icon={icon} tone={danger ? "red" : "cyan"} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate pt-0.5 text-sm font-medium text-ink-secondary">{label}</p>
            {trend && trend.length > 1 && (
              <Sparkline points={trend} tone={danger ? "red" : "cyan"} label={`${label}, weekly`} className="-mt-1 flex-none" />
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-semibold text-ink">{value}</span>
            {delta && <DeltaChip delta={delta} />}
          </div>
          {caption && <p className="mt-1.5 text-xs text-ink-faint">{caption}</p>}
        </div>
      </div>
    </Card>
  );
}

function DeltaChip({ delta }: { delta: StatDelta }) {
  if (delta.value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
        <Minus size={12} aria-hidden="true" /> {delta.period.replace(/^vs/, "same as")}
      </span>
    );
  }
  const up = delta.value > 0;
  const good = up === delta.upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs">
      <Icon size={13} aria-hidden="true" className={good ? "text-emerald-400" : "text-red-400"} />
      <span className={cn("font-medium", good ? "text-emerald-400" : "text-red-400")}>
        {up ? "+" : "−"}
        {Math.abs(delta.value)}
      </span>
      <span className="ml-1 text-ink-faint">{delta.period}</span>
    </span>
  );
}
