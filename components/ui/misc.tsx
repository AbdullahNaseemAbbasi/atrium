import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "./button";

/* ---------- Progress ---------- */

export function ProgressBar({
  value,
  label,
  size = "md",
  tone = "cyan",
  className,
}: {
  value: number;
  label?: string;
  size?: "sm" | "md";
  tone?: "cyan" | "amber" | "red" | "emerald";
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const fill = {
    cyan: "from-cyan-500 to-sky-400 shadow-[0_0_10px_rgba(34,211,238,.4)]",
    amber: "from-amber-500 to-amber-300",
    red: "from-red-500 to-rose-400",
    emerald: "from-emerald-500 to-emerald-300",
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label ?? "Progress"}
      className={cn("overflow-hidden rounded-full bg-white/[0.06]", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div style={{ width: `${clamped}%` }} className={cn("h-full rounded-full bg-gradient-to-r", fill)} />
    </div>
  );
}

/* ---------- Page header ---------- */

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-cyan-300">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink-muted">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-5 pb-5 pt-7 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumbs && (
          <div className="mb-3">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        )}
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </section>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-cyan-400/10 blur-xl" aria-hidden="true" />
        <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-300">
          <Icon size={24} aria-hidden="true" />
        </div>
      </div>
      <h3 className="mt-4 font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ---------- Skeletons ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 p-5", className)} role="status" aria-label="Loading">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("card space-y-3 p-5", className)} role="status" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card flex items-start gap-4 p-5">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Tables ---------- */

export function TableWrap({ className, children }: { className?: string; children: React.ReactNode }) {
  // `relative` keeps absolutely positioned children (sr-only labels) inside the scroller.
  return <div className={cn("relative overflow-x-auto px-4 pb-4 sm:px-5 sm:pb-5", className)}>{children}</div>;
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-y border-white/[0.05] bg-white/[0.018] text-left text-xs text-ink-faint">{children}</tr>
    </thead>
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return <th scope="col" className={cn("whitespace-nowrap px-3 py-3 font-medium", className)} {...props} />;
}

export function Tr({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("border-b border-white/[0.05] transition-colors hover:bg-white/[0.015]", className)} {...props} />;
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-3 py-3.5 align-middle text-ink-muted", className)} {...props} />;
}

/* ---------- Filter chips & pagination (link based, server friendly) ---------- */

export function FilterChips({
  items,
  label,
}: {
  items: { label: string; href: string; active: boolean; count?: number }[];
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "true" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition",
            item.active
              ? "border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,.2)]"
              : "border-white/[0.08] bg-white/[0.02] text-ink-muted hover:border-white/15 hover:text-ink",
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={cn("tabular-nums", item.active ? "text-cyan-200" : "text-ink-faint")}>{item.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 px-4 pb-4 text-xs text-ink-faint sm:flex-row sm:px-5">
      <p>
        Showing <span className="text-ink-secondary">{from}</span>–<span className="text-ink-secondary">{to}</span> of{" "}
        <span className="text-ink-secondary">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="Previous page">
          <ChevronLeft size={14} /> Prev
        </PageLink>
        <span className="px-2 tabular-nums text-ink-muted">
          {page} / {pageCount}
        </span>
        <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} label="Next page">
          Next <ChevronRight size={14} />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={buttonClasses({ variant: "outline", size: "sm", className: "opacity-40" })}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} scroll={false} className={buttonClasses({ variant: "outline", size: "sm" })}>
      {children}
    </Link>
  );
}

/* ---------- Key/value list ---------- */

export function DetailList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-white/[0.05]", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="text-ink-faint">{item.label}</dt>
          <dd className="text-right text-ink-secondary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Inline note ---------- */

export function FormNote({
  icon: Icon,
  tone = "neutral",
  className,
  children,
}: {
  icon: LucideIcon;
  tone?: "neutral" | "warning";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "warning" ? "border-amber-500/20 bg-amber-500/[0.05] text-amber-100/90" : "border-line bg-white/[0.025] text-ink-muted",
        className,
      )}
    >
      <Icon size={16} className={cn("mt-0.5 flex-none", tone === "warning" ? "text-amber-300" : "text-cyan-300")} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/* ---------- Kbd ---------- */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
      {children}
    </kbd>
  );
}
