import { Suspense } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getOptionalViewer } from "@/lib/data/queries/shell";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { MobileMenu, NavLinks, NavLinksView } from "./site-nav";
import { ctaClasses } from "./primitives";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center px-5 sm:px-8">
        <Link href="/" aria-label="Atrium home" className="flex-none">
          <Logo size={26} />
        </Link>
        <Suspense fallback={<NavLinksView pathname={null} />}>
          <NavLinks />
        </Suspense>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
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
    <div className={cn("flex items-center gap-2", stacked && "flex-col items-stretch")}>
      <Link href="/login" className={buttonClasses({ variant: stacked ? "outline" : "ghost", size: stacked ? "lg" : "md" })}>
        Sign in
      </Link>
      <Link href="/signup" className={stacked ? ctaClasses("primary") : ctaClasses("primary", "h-10 px-4")}>
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
      <span className={cn("text-sm text-ink-faint", stacked ? "text-center" : "hidden lg:inline")}>Signed in as {firstName}</span>
      <Link href={viewer.home} className={stacked ? ctaClasses("primary") : ctaClasses("primary", "h-10 px-4")}>
        Open the app
      </Link>
    </div>
  );
}
