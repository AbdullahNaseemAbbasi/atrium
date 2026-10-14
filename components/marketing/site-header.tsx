import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptionalViewer } from "@/lib/data/queries/shell";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { MobileMenu, NavLinks, NavLinksView } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center rounded-2xl border border-white/[0.08] bg-[#0b1722]/85 pl-4 pr-2 shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur-xl sm:pl-5 sm:pr-3">
        <Link href="/" aria-label="Atrium home" className="flex-none">
          <Logo size={28} />
        </Link>
        <Suspense fallback={<NavLinksView pathname={null} />}>
          <NavLinks />
        </Suspense>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Suspense fallback={<GuestActions />}>
              <ViewerActions />
            </Suspense>
          </div>
          <MobileMenu
            actions={
              <Suspense fallback={<GuestActions stacked />}>
                <ViewerActions stacked />
              </Suspense>
            }
          />
        </div>
      </div>
    </header>
  );
}

function GuestActions({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className={cn("flex gap-2", stacked && "flex-col")}>
      <Link href="/login" className={buttonClasses({ variant: stacked ? "outline" : "ghost", size: stacked ? "lg" : "md" })}>
        Sign in
      </Link>
      <Link href="/signup" className={buttonClasses({ size: stacked ? "lg" : "md" })}>
        Start free
      </Link>
    </div>
  );
}

/** Reads the session, so it always renders inside a Suspense boundary. */
async function ViewerActions({ stacked = false }: { stacked?: boolean }) {
  const viewer = await getOptionalViewer();
  if (!viewer) return <GuestActions stacked={stacked} />;
  const firstName = viewer.name.split(" ")[0];
  return (
    <div className={cn("flex items-center gap-3", stacked && "flex-col items-stretch")}>
      <span className={cn("text-xs text-ink-faint", stacked ? "text-center" : "hidden lg:inline")}>Signed in as {firstName}</span>
      <Link href={viewer.home} className={buttonClasses({ size: stacked ? "lg" : "md" })}>
        Open app <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}
