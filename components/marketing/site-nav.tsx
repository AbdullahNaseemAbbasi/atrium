"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as RadixDialog } from "radix-ui";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

export const MARKETING_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/help", label: "Help" },
] as const;

function isActive(pathname: string | null, href: string) {
  return Boolean(pathname && (pathname === href || pathname.startsWith(`${href}/`)));
}

/** Desktop links. Rendered without a pathname as the Suspense fallback. */
export function NavLinksView({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="ml-8 hidden items-center gap-1 md:flex">
      {MARKETING_LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-[0.9375rem] transition-colors",
              active ? "text-ink underline decoration-cyan-400 decoration-2 underline-offset-[10px]" : "text-ink-muted hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function NavLinks() {
  const pathname = usePathname();
  return <NavLinksView pathname={pathname} />;
}

/**
 * Slide-over menu for small screens. `actions` is server-rendered (it reads the
 * session to choose between "Sign in" and "Open app").
 */
export function MobileMenu({ actions }: { actions: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger
        className="grid h-10 w-10 place-items-center rounded-xl text-ink-secondary transition hover:bg-white/5 hover:text-ink md:hidden"
        aria-label="Open menu"
      >
        <Menu size={21} aria-hidden="true" />
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[80] bg-[#020a10]/70 backdrop-blur-sm animate-fade-in md:hidden" />
        <RadixDialog.Content
          className="fixed inset-y-0 right-0 z-[90] flex w-[min(340px,90vw)] flex-col border-l border-line bg-[#0b1722] p-5 shadow-2xl animate-fade-in focus:outline-none md:hidden"
          aria-describedby={undefined}
          // Close after following any link inside the panel (including the server-rendered actions).
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          <div className="flex items-center justify-between">
            <RadixDialog.Title className="sr-only">Menu</RadixDialog.Title>
            <Link href="/" aria-label="Atrium home">
              <Logo size={26} />
            </Link>
            <RadixDialog.Close className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-white/5 hover:text-ink" aria-label="Close menu">
              <X size={19} aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          <nav aria-label="Mobile" className="mt-8 space-y-1">
            <MobileLinks />
          </nav>
          <div className="mt-auto border-t border-line pt-5">{actions}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function MobileLinks() {
  const pathname = usePathname();
  return (
    <>
      {[{ href: "/", label: "Home" }, ...MARKETING_LINKS, { href: "/contact", label: "Contact" }].map((link) => {
        const active = link.href === "/" ? pathname === "/" : isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center rounded-xl px-3 py-3 text-[15px] transition",
              active ? "bg-cyan-500/10 text-cyan-200" : "text-ink-secondary hover:bg-white/[0.04] hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
