"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as RadixDialog } from "radix-ui";
import {
  BarChart3,
  BriefcaseBusiness,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileCheck2,
  Folder,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SquareCheckBig,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Avatar, BrandTile } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/misc";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { NavKey, SwitcherEntry, WorkspaceShell } from "@/lib/data/queries/shell";
import { CommandPalette } from "./command-palette";
import { NotificationsMenu } from "./notifications-menu";

const NAV_ICONS: Record<NavKey, typeof Folder> = {
  dashboard: LayoutDashboard,
  projects: Folder,
  tasks: SquareCheckBig,
  clients: BriefcaseBusiness,
  approvals: FileCheck2,
  team: Users,
  reports: BarChart3,
  billing: CreditCard,
  settings: Settings,
};

function isActive(pathname: string, href: string, base: string) {
  if (href === base) return pathname === base;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceHeader({ shell }: { shell: WorkspaceShell }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 pt-3">
      <div className="flex h-[70px] items-center rounded-2xl border border-white/[0.08] bg-[#0b1722]/95 px-3 shadow-xl backdrop-blur-xl sm:px-4 lg:px-6">
        <Link href={shell.base} aria-label="Atrium dashboard" className="flex-none">
          <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
        </Link>

        <OrgSwitcher current={shell.org} entries={shell.switcher} />

        <nav aria-label="Primary" className="ml-6 hidden h-full items-center gap-1 xl:flex">
          {shell.nav.map((item) => {
            const Icon = NAV_ICONS[item.key];
            const active = isActive(pathname, item.href, shell.base);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full items-center gap-2 px-3 text-sm transition-colors 2xl:px-4",
                  active ? "text-cyan-300" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon size={17} aria-hidden="true" />
                {item.label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.9)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden w-[260px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-left text-sm text-ink-faint transition hover:border-white/15 2xl:flex"
          >
            <Search size={17} aria-hidden="true" />
            <span className="flex-1">Search projects, tasks, clients…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl text-ink-muted transition hover:bg-white/5 hover:text-ink 2xl:hidden"
            aria-label="Search"
          >
            <Search size={19} />
          </button>

          <NotificationsMenu
            orgSlug={shell.org.slug}
            unread={shell.notifications.unread}
            items={shell.notifications.items}
            viewAllHref={`${shell.base}/notifications`}
          />

          <Link
            href="/help"
            className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-muted transition hover:bg-white/5 hover:text-ink lg:flex"
          >
            <CircleHelp size={18} aria-hidden="true" />
            <span className="hidden 2xl:inline">Help and support</span>
            <span className="sr-only 2xl:hidden">Help and support</span>
          </Link>

          <UserMenu shell={shell} />

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl text-ink-secondary transition hover:bg-white/5 xl:hidden"
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
        </div>
      </div>

      <CommandPalette entries={shell.search} open={paletteOpen} onOpenChange={setPaletteOpen} />
      <MobileNav shell={shell} open={mobileOpen} onOpenChange={setMobileOpen} pathname={pathname} />
    </header>
  );
}

export function OrgSwitcher({
  current,
  entries,
}: {
  current: { name: string; slug: string; hue: number };
  entries: SwitcherEntry[];
}) {
  const router = useRouter();
  return (
    <Dropdown>
      <DropdownTrigger className="ml-4 hidden max-w-[220px] items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-sm text-ink-secondary transition hover:border-white/15 hover:bg-white/[0.05] md:flex lg:ml-7">
        <Building2 size={17} className="flex-none text-ink-muted" aria-hidden="true" />
        <span className="truncate">{current.name}</span>
        <ChevronDown size={15} className="flex-none text-ink-faint" aria-hidden="true" />
      </DropdownTrigger>
      <DropdownContent align="start" className="w-[280px]">
        <DropdownLabel>Workspaces & portals</DropdownLabel>
        {entries.map((entry) => {
          const selected = entry.kind === "team" && entry.slug === current.slug;
          return (
            <DropdownItem key={`${entry.kind}-${entry.slug}`} onSelect={() => router.push(entry.href)}>
              <BrandTile name={entry.name} hue={entry.hue} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">{entry.name}</span>
                <span className="block text-xs text-ink-faint">
                  {entry.kind === "team" ? ROLE_LABELS[entry.role as keyof typeof ROLE_LABELS] : "Client portal"}
                </span>
              </span>
              {selected && <Check size={16} className="text-cyan-300" aria-label="Current workspace" />}
            </DropdownItem>
          );
        })}
        <DropdownSeparator />
        <DropdownItem onSelect={() => router.push("/onboarding")}>
          <span className="grid h-7 w-7 place-items-center rounded-md border border-dashed border-line-strong text-ink-muted">
            <Plus size={14} />
          </span>
          Create a workspace
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

function UserMenu({ shell }: { shell: WorkspaceShell }) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  return (
    <Dropdown>
      <DropdownTrigger
        className="rounded-full border border-cyan-400/25 shadow-[0_0_20px_rgba(34,211,238,.2)] transition hover:border-cyan-300/50"
        aria-label="Account menu"
      >
        <Avatar user={shell.user} size="md" />
      </DropdownTrigger>
      <DropdownContent className="w-[260px]">
        <div className="flex items-center gap-3 border-b border-line p-3">
          <Avatar user={shell.user} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{shell.user.name}</p>
            <p className="truncate text-xs text-ink-faint">{shell.user.email}</p>
            <p className="mt-0.5 text-[11px] text-cyan-300/80">{ROLE_LABELS[shell.role]}</p>
          </div>
        </div>
        <div className="pt-1.5">
          <DropdownItem onSelect={() => router.push(`${shell.base}/settings/profile`)}>
            <User size={17} /> My profile
          </DropdownItem>
          {shell.can.settings && (
            <DropdownItem onSelect={() => router.push(`${shell.base}/settings`)}>
              <Settings size={17} /> Workspace settings
            </DropdownItem>
          )}
          {shell.can.billing && (
            <DropdownItem onSelect={() => router.push(`${shell.base}/billing`)}>
              <CreditCard size={17} /> Billing & plans
            </DropdownItem>
          )}
          {shell.isPlatformAdmin && (
            <DropdownItem onSelect={() => router.push("/admin")}>
              <ShieldCheck size={17} /> Platform operations
            </DropdownItem>
          )}
          <DropdownSeparator />
          <DropdownItem danger onSelect={() => startTransition(() => signOut())}>
            <LogOut size={17} /> Sign out
          </DropdownItem>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

function MobileNav({
  shell,
  open,
  onOpenChange,
  pathname,
}: {
  shell: WorkspaceShell;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
}) {
  const extra = [
    { key: "notifications", label: "Notifications", href: `${shell.base}/notifications`, icon: Bell },
    ...(shell.can.settings ? [{ key: "settings", label: "Settings", href: `${shell.base}/settings`, icon: Settings }] : []),
    ...(shell.can.billing && shell.role !== "billing"
      ? [{ key: "billing", label: "Billing & plans", href: `${shell.base}/billing`, icon: CreditCard }]
      : []),
    { key: "profile", label: "My profile", href: `${shell.base}/settings/profile`, icon: User },
  ];
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[80] bg-[#020a10]/70 backdrop-blur-sm xl:hidden" />
        <RadixDialog.Content
          className="fixed inset-y-0 right-0 z-[90] flex w-[min(320px,88vw)] flex-col border-l border-line bg-[#0b1722] p-4 shadow-2xl xl:hidden"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between">
            <RadixDialog.Title className="text-sm font-semibold text-ink">{shell.org.name}</RadixDialog.Title>
            <RadixDialog.Close className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-white/5" aria-label="Close navigation">
              <X size={19} />
            </RadixDialog.Close>
          </div>
          <nav aria-label="Mobile" className="mt-5 flex-1 space-y-1 overflow-y-auto">
            {shell.nav.map((item) => {
              const Icon = NAV_ICONS[item.key];
              const active = isActive(pathname, item.href, shell.base);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition",
                    active ? "bg-cyan-500/10 text-cyan-200" : "text-ink-secondary hover:bg-white/[0.04]",
                  )}
                >
                  <Icon size={18} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            <div className="my-3 h-px bg-line" />
            {extra.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-ink-secondary transition hover:bg-white/[0.04]"
              >
                <item.icon size={18} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-line pt-4">
            <p className="px-1 text-xs font-medium text-ink-faint">Switch workspace</p>
            <div className="mt-2 space-y-1">
              {shell.switcher.map((entry) => (
                <Link
                  key={`${entry.kind}-${entry.slug}`}
                  href={entry.href}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-ink-secondary hover:bg-white/[0.04]"
                >
                  <BrandTile name={entry.name} hue={entry.hue} size="sm" />
                  <span className="truncate">{entry.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
