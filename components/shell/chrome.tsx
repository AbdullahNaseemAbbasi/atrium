import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/misc";

/** Fixed ambient glow + faint grid behind every app screen. */
export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-32 top-20 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
      <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-blue-600/[0.05] blur-[110px]" />
      <div className="absolute bottom-0 left-1/3 h-[380px] w-[380px] rounded-full bg-sky-500/[0.035] blur-[120px]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:40px_40px]" />
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
    <div className="sticky top-0 z-50 pt-3">
      <div className="flex h-[70px] items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#0b1722]/95 px-4 lg:px-6">
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
