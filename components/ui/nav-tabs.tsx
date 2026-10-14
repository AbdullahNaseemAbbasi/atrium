"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavTab {
  href: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  /** Match only the exact path (for index tabs). */
  exact?: boolean;
}

/** Route-based tabs with the glowing underline from the main navigation. */
export function NavTabs({ tabs, label, className }: { tabs: NavTab[]; label: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn("relative -mx-1 overflow-x-auto", className)}>
      <ul className="flex min-w-max items-center gap-1 border-b border-line px-1">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-2 px-3.5 text-sm transition-colors",
                  active ? "text-cyan-300" : "text-ink-muted hover:text-ink",
                )}
              >
                {Icon && <Icon size={16} aria-hidden="true" />}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] tabular-nums",
                      active ? "bg-cyan-500/15 text-cyan-200" : "bg-white/[0.06] text-ink-faint",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.9)]" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
