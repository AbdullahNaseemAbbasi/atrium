import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/misc";

/** Fixed background behind every screen: layered light over the navy canvas (see .backdrop-light in globals.css). */
export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="backdrop-light absolute inset-0" />
      <div className="backdrop-grain absolute inset-0" />
    </div>
  );
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <Backdrop />
      <div className="relative mx-auto flex min-h-dvh max-w-[1600px] flex-col px-4 sm:px-6 xl:px-8">{children}</div>
    </div>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-auto flex flex-col gap-4 px-1 py-6 text-xs text-ink-faint md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-5">
        <Logo size={20} className="[&>span:last-child]:text-sm [&>span:last-child]:text-ink-secondary" />
        <span>© 2026 Atrium. All rights reserved.</span>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/help" className="hover:text-ink-secondary">Help center</Link>
        <Link href="/contact" className="hover:text-ink-secondary">Contact support</Link>
        <Link href="/privacy" className="hover:text-ink-secondary">Privacy policy</Link>
        <Link href="/terms" className="hover:text-ink-secondary">Terms of service</Link>
        <Link href="/status" className="hover:text-ink-secondary">
          System status
        </Link>
      </nav>
    </footer>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="sticky top-0 z-50">
      <div className="flex h-[70px] items-center gap-4 rounded-b-2xl border border-t-0 border-white/[0.08] bg-[#0b1722]/95 px-4 lg:px-6">
        <Logo />
        <Skeleton className="ml-6 hidden h-10 w-40 md:block" />
        <div className="ml-6 hidden gap-3 xl:flex">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-20" />
          ))}
        </div>
        <Skeleton className="ml-auto h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}
