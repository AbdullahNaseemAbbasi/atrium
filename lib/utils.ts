import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInCalendarDays, format, formatDistanceStrict, isValid, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toDate(value: string | Date) {
  return typeof value === "string" ? parseISO(value) : value;
}

/** "Apr 28, 2026" */
export function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = toDate(value);
  return isValid(date) ? format(date, "MMM d, yyyy") : "—";
}

/** "Apr 28" */
export function formatShortDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = toDate(value);
  return isValid(date) ? format(date, "MMM d") : "—";
}

/** "Apr 28, 2026 · 14:05" */
export function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const date = toDate(value);
  return isValid(date) ? format(date, "MMM d, yyyy · HH:mm") : "—";
}

/** "3 hours ago". `now` is passed in so callers stay deterministic. */
export function formatRelative(value: string | Date, now: Date) {
  const date = toDate(value);
  if (!isValid(date)) return "—";
  if (Math.abs(now.getTime() - date.getTime()) < 45_000) return "just now";
  return formatDistanceStrict(date, now, { addSuffix: true });
}

/** Whole days from `now` until `value`. Negative when the date has passed. */
export function daysUntil(value: string | Date, now: Date) {
  return differenceInCalendarDays(toDate(value), now);
}

/** Human due label: "Due today", "Due in 3 days", "4 days overdue". */
export function dueLabel(value: string | null | undefined, now: Date) {
  if (!value) return "No due date";
  const days = daysUntil(value, now);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "")} ${units[unit]}`;
}

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Compact counts for stat tiles: 1,284 / 12.9K / 4.2M */
export function formatCompact(value: number) {
  if (Math.abs(value) < 10_000) return value.toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** First value of a search param (Next.js gives string | string[] | undefined). */
export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
