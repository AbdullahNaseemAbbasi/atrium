import { Suspense } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { getOptionalViewer } from "@/lib/data/queries/shell";
import { Logo } from "@/components/brand/logo";
import { Backdrop } from "@/components/shell/chrome";
import { Skeleton } from "@/components/ui/misc";

/** Per-user setup flow: navigations may wait on the server. */
export const instant = false;

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Backdrop />
      <div className="relative mx-auto flex min-h-dvh max-w-[980px] flex-col px-4 sm:px-6">
        <header className="flex h-20 items-center justify-between gap-4">
          <Link href="/" aria-label="Atrium home" className="flex-none">
            <Logo size={28} />
          </Link>
          <Suspense fallback={<Skeleton className="h-9 w-44 rounded-xl" />}>
            <Account />
          </Suspense>
        </header>
        <main id="main" className="flex-1 pb-12 pt-4 sm:pt-8">
          {children}
        </main>
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-line py-6 text-xs text-ink-faint sm:flex-row">
          <span>© 2026 Atrium · Demo build with synthetic data</span>
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/help" className="hover:text-ink-secondary">
              Help centre
            </Link>
            <Link href="/terms" className="hover:text-ink-secondary">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink-secondary">
              Privacy
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

async function Account() {
  const viewer = await getOptionalViewer();
  if (!viewer) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-ink-muted sm:inline">
        Signed in as <span className="text-ink-secondary">{viewer.name}</span>
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-ink-muted transition hover:border-white/15 hover:text-ink"
        >
          <LogOut size={15} aria-hidden="true" /> Sign out
        </button>
      </form>
    </div>
  );
}
