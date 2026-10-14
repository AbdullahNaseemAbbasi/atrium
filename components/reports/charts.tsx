"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, BrandTile } from "@/components/ui/avatar";

/**
 * Report charts (inline HTML, no chart library). Single-series, so no legend:
 * the card title names the series. Marks use one validated cyan step
 * (#0a9cbb, inside the dark-mode lightness band) and brighten on hover or
 * focus; text always stays in ink colours. Bars are at most 24px thick with
 * a 4px rounded data end, on hairline solid gridlines.
 */
const MARK = "#0a9cbb";
const MARK_ACTIVE = "#22d3ee";

function niceTicks(max: number, target = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((value) => value >= raw) ?? magnitude * 10);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
}

function Tooltip({ value, label, detail, style, className }: { value: string; label: string; detail?: string; style?: React.CSSProperties; className?: string }) {
  return (
    <span
      role="status"
      style={style}
      className={cn(
        "pointer-events-none absolute z-10 block whitespace-nowrap rounded-lg border border-line-strong bg-surface-raised px-2.5 py-1.5 text-xs shadow-[0_12px_30px_rgba(0,0,0,.45)]",
        className,
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-3 rounded-full" style={{ background: MARK_ACTIVE }} aria-hidden="true" />
        <span className="font-semibold text-ink">{value}</span>
      </span>
      <span className="mt-0.5 block text-ink-muted">{label}</span>
      {detail && <span className="block text-ink-faint">{detail}</span>}
    </span>
  );
}

/* ---------- Columns (time series) ---------- */

export interface ColumnPoint {
  label: string;
  detail: string;
  value: number;
}

export function ColumnChart({ points, unit, label }: { points: ColumnPoint[]; unit: [string, string]; label: string }) {
  const [active, setActive] = React.useState<number | null>(null);
  const max = Math.max(...points.map((point) => point.value), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const peak = points.findIndex((point) => point.value === max && max > 0);
  const unitFor = (value: number) => (value === 1 ? unit[0] : unit[1]);

  return (
    <figure aria-label={label} className="pt-4">
      <div className="relative h-56">
        {ticks.map((tick) => (
          <div key={tick} className="absolute left-7 right-0 border-t border-white/[0.06]" style={{ bottom: `${(tick / top) * 100}%` }} aria-hidden="true">
            <span className="absolute right-full mr-2 -translate-y-1/2 text-[11px] tabular-nums text-ink-faint">{tick}</span>
          </div>
        ))}
        <ul className="absolute inset-y-0 left-7 right-0 flex items-end">
          {points.map((point, index) => {
            const height = (point.value / top) * 100;
            const on = active === index;
            return (
              <li key={point.detail} className="flex h-full flex-1 items-end justify-center">
                <button
                  type="button"
                  className="flex h-full w-full items-end justify-center rounded-md px-[1px] focus-visible:bg-white/[0.03]"
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  aria-label={`${point.detail}: ${point.value} ${unitFor(point.value)}`}
                >
                  <span
                    className="relative block w-full max-w-[24px] rounded-t-[4px] transition-colors"
                    style={{ height: `${height}%`, background: on ? MARK_ACTIVE : MARK, minHeight: point.value > 0 ? 2 : 0 }}
                  >
                    {index === peak && !on && (
                      <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] font-medium tabular-nums text-ink-secondary">
                        {point.value}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {active !== null && (
          <Tooltip
            value={`${points[active].value} ${unitFor(points[active].value)}`}
            label={points[active].detail}
            style={{
              left: `calc(28px + (100% - 28px) * ${(active + 0.5) / points.length})`,
              bottom: `calc(${(points[active].value / top) * 100}% + 10px)`,
            }}
            className={active < 2 ? "-translate-x-[15%]" : active > points.length - 3 ? "-translate-x-[85%]" : "-translate-x-1/2"}
          />
        )}
      </div>
      <div className="ml-7 mt-2 flex border-t border-white/[0.12] pt-2" aria-hidden="true">
        {points.map((point, index) => (
          <span
            key={point.detail}
            className={cn(
              "min-w-0 flex-1 whitespace-nowrap text-center text-[11px] text-ink-faint",
              (points.length - 1 - index) % 3 !== 0 && "invisible sm:visible",
            )}
          >
            {point.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/* ---------- Horizontal bars (categories) ---------- */

export interface BarRow {
  key: string;
  label: string;
  value: number;
  valueText: string;
  detail?: string;
  leading?: { kind: "avatar" | "brand"; hue: number };
  /** Status note shown under the label, with an icon (never colour alone). */
  warning?: string;
}

export function BarList({ rows, max, label }: { rows: BarRow[]; max?: number; label: string }) {
  const [active, setActive] = React.useState<string | null>(null);
  const scale = max ?? Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul aria-label={label} className="space-y-1 pt-1">
      {rows.map((row) => {
        const width = scale > 0 ? (row.value / scale) * 82 : 0;
        const on = active === row.key;
        return (
          <li key={row.key}>
            <button
              type="button"
              className={cn(
                "relative grid w-full grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]",
                on && "bg-white/[0.03]",
              )}
              onPointerEnter={() => setActive(row.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(row.key)}
              onBlur={() => setActive(null)}
              aria-label={`${row.label}: ${row.valueText}${row.detail ? `, ${row.detail}` : ""}${row.warning ? `, ${row.warning}` : ""}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {row.leading?.kind === "avatar" && <Avatar user={{ name: row.label, avatarHue: row.leading.hue }} size="xs" />}
                {row.leading?.kind === "brand" && <BrandTile name={row.label} hue={row.leading.hue} size="sm" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink-secondary">{row.label}</span>
                  {row.warning && (
                    <span className="flex items-center gap-1 text-[11px] text-red-300">
                      <AlertTriangle size={11} aria-hidden="true" /> {row.warning}
                    </span>
                  )}
                </span>
              </span>
              <span className="relative flex h-6 items-center">
                <span
                  className="block h-3 rounded-r-[4px] transition-colors"
                  style={{ width: `${width}%`, background: on ? MARK_ACTIVE : MARK, minWidth: row.value > 0 ? 3 : 0 }}
                />
                <span className="ml-2 whitespace-nowrap text-xs tabular-nums text-ink-secondary">{row.valueText}</span>
                {on && row.detail && (
                  <Tooltip
                    value={row.valueText}
                    label={row.label}
                    detail={row.detail}
                    className="bottom-full mb-1 -translate-x-1/2"
                    style={{ left: `${Math.min(Math.max(width, 18), 70)}%` }}
                  />
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
