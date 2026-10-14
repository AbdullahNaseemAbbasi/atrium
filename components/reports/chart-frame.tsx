"use client";

import * as React from "react";
import { BarChart3, CheckCheck, Clock3, HeartPulse, Table2, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

const ICONS = { throughput: BarChart3, turnaround: Clock3, firstPass: CheckCheck, workload: Users, health: HeartPulse } satisfies Record<string, LucideIcon>;

/**
 * Card wrapper for one chart: title, a "View as table" toggle (every value
 * reachable without hovering) and a "How we calculate this" note.
 */
export function ChartFrame({
  icon,
  title,
  description,
  howTo,
  chart,
  table,
  className,
}: {
  icon: keyof typeof ICONS;
  title: string;
  description: string;
  howTo: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = React.useState(false);
  return (
    <Card className={className ? `flex flex-col ${className}` : "flex flex-col"}>
      <CardHeader
        icon={ICONS[icon]}
        title={title}
        description={description}
        action={
          <Button variant="outline" size="xs" aria-pressed={asTable} onClick={() => setAsTable((value) => !value)}>
            {asTable ? <BarChart3 size={13} aria-hidden="true" /> : <Table2 size={13} aria-hidden="true" />}
            {asTable ? "View as chart" : "View as table"}
          </Button>
        }
      />
      <div className="flex-1 px-4 pb-4 sm:px-5">{asTable ? table : chart}</div>
      <details className="group border-t border-line px-4 py-3 text-xs sm:px-5">
        <summary className="cursor-pointer select-none text-ink-muted marker:text-ink-faint hover:text-ink">How we calculate this</summary>
        <div className="mt-2 max-w-2xl leading-relaxed text-ink-muted">{howTo}</div>
      </details>
    </Card>
  );
}

/** Compact table used by every chart's table view. */
export function ChartTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="relative max-h-[320px] overflow-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-raised">
          <tr className="text-left text-xs text-ink-faint">
            {columns.map((column, index) => (
              <th key={column} scope="col" className={index === 0 ? "px-3 py-2.5 font-medium" : "px-3 py-2.5 text-right font-medium"}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-white/[0.05]">
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row" className="px-3 py-2 text-left font-normal text-ink-secondary">
                    {cell}
                  </th>
                ) : (
                  <td key={index} className="px-3 py-2 text-right tabular-nums text-ink">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
