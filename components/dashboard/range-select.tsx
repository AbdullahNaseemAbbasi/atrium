"use client";

import { CalendarDays } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

export function RangeSelect({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="relative flex w-fit items-center gap-3 rounded-xl border border-white/[0.08] bg-surface-raised px-4 py-3 text-sm text-ink-secondary transition hover:border-white/15">
      <CalendarDays size={18} aria-hidden="true" />
      <span className="sr-only">Comparison period</span>
      <select
        value={value}
        onChange={(event) => router.replace(`${pathname}?range=${event.target.value}`, { scroll: false })}
        className="cursor-pointer appearance-none bg-transparent pr-6 outline-none focus-visible:outline-none [&>option]:bg-surface-raised"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-4 h-4 w-4 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
