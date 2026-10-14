"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CreditCard, Database, History, Plug, Settings2, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavTabs } from "@/components/ui/nav-tabs";

export interface SettingsNavSection {
  key: string;
  group: "Account" | "Workspace";
  label: string;
  description: string;
  href: string;
}

const ICONS: Record<string, LucideIcon> = {
  profile: UserRound,
  notifications: Bell,
  workspace: Settings2,
  integrations: Plug,
  "audit-log": History,
  data: Database,
};

/** Settings sub-navigation: a left column on desktop, route tabs on smaller screens. */
export function SettingsNav({ sections, billingHref }: { sections: SettingsNavSection[]; billingHref: string | null }) {
  const pathname = usePathname();
  const groups = (["Account", "Workspace"] as const).map((group) => ({ group, items: sections.filter((item) => item.group === group) }));

  return (
    <>
      <NavTabs
        label="Settings sections"
        className="lg:hidden"
        tabs={[
          ...sections.map((section) => ({ href: section.href, label: section.label, icon: ICONS[section.key] })),
          ...(billingHref ? [{ href: billingHref, label: "Billing", icon: CreditCard }] : []),
        ]}
      />
      <nav aria-label="Settings sections" className="card sticky top-[96px] hidden p-2 lg:block">
        {groups.map(({ group, items }) => (
          <div key={group} className="py-1.5">
            <p className="px-3 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">{group}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = ICONS[item.key] ?? Settings2;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                        active ? "bg-cyan-500/10 text-cyan-200" : "text-ink-secondary hover:bg-white/[0.04] hover:text-ink",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,.9)]" aria-hidden="true" />
                      )}
                      <Icon size={17} aria-hidden="true" className={active ? "text-cyan-300" : "text-ink-faint"} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="block truncate text-xs text-ink-faint">{item.description}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {billingHref && (
          <div className="mt-1 border-t border-line pt-2">
            <Link
              href={billingHref}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-ink-secondary transition hover:bg-white/[0.04] hover:text-ink"
            >
              <CreditCard size={17} aria-hidden="true" className="text-ink-faint" />
              <span>
                <span className="block text-sm font-medium">Billing & plans</span>
                <span className="block text-xs text-ink-faint">Plan, usage, invoices</span>
              </span>
            </Link>
          </div>
        )}
      </nav>
    </>
  );
}
