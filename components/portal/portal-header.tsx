"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as RadixDialog } from "radix-ui";
import { ArrowLeftRight, Bell, FileCheck2, Files, Folder, Home, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
import { Avatar, BrandTile } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/misc";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { signOut } from "@/lib/actions/auth";
import { CLIENT_ROLE_LABELS } from "@/lib/auth/permissions";
import type { PortalShell } from "@/lib/data/queries/shell";

interface PortalNavItem {
  key: string;
  label: string;
  href: string;
  icon: typeof Folder;
  /** Extra path prefixes that keep this item highlighted. */
  also?: string[];
  badge?: number;
}

function navFor(shell: PortalShell): PortalNavItem[] {
  const base = shell.base;
  return [
    { key: "overview", label: "Overview", href: base, icon: Home },
    { key: "projects", label: "Projects", href: `${base}/projects`, icon: Folder },
    {
      key: "approvals",
      label: "Approvals",
      href: `${base}/approvals`,
      icon: FileCheck2,
      also: [`${base}/deliverables`],
      badge: shell.pendingReviews,
    },
    { key: "files", label: "Files", href: `${base}/files`, icon: Files },
  ];
}

function isActive(pathname: string, item: PortalNavItem, base: string) {
  if (item.href === base) return pathname === base;
  return [item.href, ...(item.also ?? [])].some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

function PendingBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn("rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-200", className)}
      aria-label={`${count} waiting for review`}
    >
      {count}
    </span>
  );
}

/**
 * Client portal header: the client's brand first ("Acme Co. with Kinetic
 * Studio"), four destinations, notifications and the account menu. Same
 * chrome as the team app, fewer controls.
 */
export function PortalHeader({ shell }: { shell: PortalShell }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const nav = navFor(shell);

  return (
    <header className="sticky top-0 z-50">
      <div className="flex h-[70px] items-center rounded-b-2xl border border-t-0 border-white/[0.08] bg-[#0b1722]/95 px-3 shadow-xl backdrop-blur-xl sm:px-4 lg:px-6">
        <Link href={shell.base} className="flex min-w-0 max-w-[260px] shrink items-center gap-3 lg:max-w-[240px] xl:max-w-[300px]" aria-label={`${shell.client.name} portal home`}>
          <LogoMark size={24} className="hidden flex-none drop-shadow-[0_0_14px_rgba(34,211,238,.45)] sm:block" />
          <span className="hidden h-7 w-px bg-line-strong sm:block" aria-hidden="true" />
          <BrandTile name={shell.client.name} hue={shell.client.hue} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-semibold text-ink">{shell.client.name}</span>
            <span className="block truncate text-xs text-ink-faint">with {shell.org.name}</span>
          </span>
        </Link>

        <nav aria-label="Portal" className="ml-6 hidden h-full flex-none items-center gap-1 lg:flex xl:ml-10">
          {nav.map((item) => {
            const active = isActive(pathname, item, shell.base);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full items-center gap-2 px-3.5 text-sm transition-colors",
                  active ? "text-cyan-300" : "text-ink-muted hover:text-ink",
                )}
              >
                <item.icon size={17} aria-hidden="true" />
                {item.label}
                {item.badge !== undefined && <PendingBadge count={item.badge} />}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.9)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-none items-center gap-1.5 sm:gap-2">
          <NotificationsMenu
            orgSlug={shell.org.slug}
            unread={shell.notifications.unread}
            items={shell.notifications.items}
            viewAllHref={`${shell.base}/notifications`}
          />
          <UserMenu shell={shell} />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-secondary transition hover:bg-white/5 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={21} />
            {shell.pendingReviews > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <MobileNav shell={shell} nav={nav} open={mobileOpen} onOpenChange={setMobileOpen} pathname={pathname} />
    </header>
  );
}

function UserMenu({ shell }: { shell: PortalShell }) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const others = shell.switcher.filter((entry) => !(entry.kind === "client" && entry.slug === shell.org.slug));
  return (
    <Dropdown>
      <DropdownTrigger
        className="rounded-full border border-cyan-400/25 shadow-[0_0_20px_rgba(34,211,238,.2)] transition hover:border-cyan-300/50"
        aria-label="Account menu"
      >
        <Avatar user={shell.user} size="md" />
      </DropdownTrigger>
      <DropdownContent className="w-[270px]">
        <div className="flex items-center gap-3 border-b border-line p-3">
          <Avatar user={shell.user} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{shell.user.name}</p>
            <p className="truncate text-xs text-ink-faint">{shell.user.email}</p>
            <p className="mt-0.5 text-[11px] text-cyan-300/80">
              {CLIENT_ROLE_LABELS[shell.role]} · {shell.client.name}
            </p>
          </div>
        </div>
        <div className="pt-1.5">
          <DropdownItem onSelect={() => router.push(`${shell.base}/notifications`)}>
            <Bell size={17} /> Notifications
          </DropdownItem>
          {others.length > 0 && (
            <>
              <DropdownSeparator />
              <DropdownLabel>Switch to</DropdownLabel>
              {others.map((entry) => (
                <DropdownItem key={`${entry.kind}-${entry.slug}`} onSelect={() => router.push(entry.href)}>
                  <BrandTile name={entry.name} hue={entry.hue} size="sm" />
                  <span className="truncate">{entry.name}</span>
                </DropdownItem>
              ))}
            </>
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
  nav,
  open,
  onOpenChange,
  pathname,
}: {
  shell: PortalShell;
  nav: PortalNavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const others = shell.switcher.filter((entry) => !(entry.kind === "client" && entry.slug === shell.org.slug));
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[80] bg-[#020a10]/70 backdrop-blur-sm lg:hidden" />
        <RadixDialog.Content
          className="fixed inset-y-0 right-0 z-[90] flex w-[min(320px,88vw)] flex-col border-l border-line bg-[#0b1722] p-4 shadow-2xl lg:hidden"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandTile name={shell.client.name} hue={shell.client.hue} size="sm" />
              <RadixDialog.Title className="truncate text-sm font-semibold text-ink">{shell.client.name} portal</RadixDialog.Title>
            </div>
            <RadixDialog.Close className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-white/5" aria-label="Close navigation">
              <X size={19} />
            </RadixDialog.Close>
          </div>
          <nav aria-label="Mobile" className="mt-5 flex-1 space-y-1 overflow-y-auto">
            {nav.map((item) => {
              const active = isActive(pathname, item, shell.base);
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
                  <item.icon size={18} aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && <PendingBadge count={item.badge} />}
                </Link>
              );
            })}
            <div className="my-3 h-px bg-line" />
            <Link
              href={`${shell.base}/notifications`}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-ink-secondary transition hover:bg-white/[0.04]"
            >
              <Bell size={18} aria-hidden="true" />
              <span className="flex-1">Notifications</span>
              {shell.notifications.unread > 0 && (
                <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-red-200">{shell.notifications.unread}</span>
              )}
            </Link>
            {others.map((entry) => (
              <Link
                key={`${entry.kind}-${entry.slug}`}
                href={entry.href}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-ink-secondary transition hover:bg-white/[0.04]"
              >
                <ArrowLeftRight size={18} aria-hidden="true" />
                <span className="truncate">{entry.name}</span>
              </Link>
            ))}
          </nav>
          <div className="border-t border-line pt-4">
            <div className="flex items-center gap-3 px-1">
              <Avatar user={shell.user} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{shell.user.name}</p>
                <p className="truncate text-xs text-ink-faint">{CLIENT_ROLE_LABELS[shell.role]}</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => signOut())}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <LogOut size={15} aria-hidden="true" /> Sign out
              </button>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function PortalHeaderSkeleton() {
  return (
    <div className="sticky top-0 z-50">
      <div className="flex h-[70px] items-center gap-3 rounded-b-2xl border border-t-0 border-white/[0.08] bg-[#0b1722]/95 px-4 lg:px-6">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="ml-10 hidden gap-5 lg:flex">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-20" />
          ))}
        </div>
        <Skeleton className="ml-auto h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}
