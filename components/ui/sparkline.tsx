"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SparkPoint {
  label: string;
  value: number;
}

/**
 * 12-point trend line for stat tiles. Past weeks use a muted stroke, the
 * current week is the accent end-dot (2px surface ring). Hovering or focusing
 * shows the exact weekly value; the full series is also available to screen
 * readers as a list.
 */
export function Sparkline({
  points,
  tone = "cyan",
  label,
  className,
}: {
  points: SparkPoint[];
  tone?: "cyan" | "red" | "amber";
  label: string;
  className?: string;
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const width = 84;
  const height = 34;
  const pad = 5;
  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (index: number) => pad + (index * (width - pad * 2)) / Math.max(points.length - 1, 1);
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1)},${height - pad} L${x(0)},${height - pad} Z`;
  const stroke = { cyan: "#22d3ee", red: "#f87171", amber: "#fbbf24" }[tone];
  const last = points.length - 1;
  const shown = active ?? last;

  if (points.length < 2) return null;

  return (
    <div className={cn("relative", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}: ${points.map((point) => `${point.label} ${point.value}`).join(", ")}`}
        className="overflow-visible"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const relative = ((event.clientX - rect.left) / rect.width) * width;
          const index = Math.round(((relative - pad) / (width - pad * 2)) * last);
          setActive(Math.min(last, Math.max(0, index)));
        }}
        onPointerLeave={() => setActive(null)}
      >
        <path d={area} fill={stroke} opacity={0.1} />
        <path d={path} fill="none" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
        <path
          d={`M${x(last - 1)},${y(points[last - 1].value)} L${x(last)},${y(points[last].value)}`}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {active !== null && active !== last && (
          <line x1={x(active)} x2={x(active)} y1={pad - 2} y2={height - pad} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        )}
        <circle cx={x(shown)} cy={y(points[shown].value)} r={4} fill={shown === last ? stroke : "#94a3b8"} stroke="#101b26" strokeWidth={2} />
        <rect width={width} height={height} fill="transparent" />
      </svg>
      {active !== null && (
        <div
          className="pointer-events-none absolute -top-9 right-0 z-10 whitespace-nowrap rounded-lg border border-line-strong bg-surface-raised px-2 py-1 text-[11px] text-ink-secondary shadow-lg"
          role="status"
        >
          {points[active].label}: <span className="font-semibold text-ink">{points[active].value}</span>
        </div>
      )}
    </div>
  );
}
