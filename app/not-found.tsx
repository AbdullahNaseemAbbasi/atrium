import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, Home, LifeBuoy } from "lucide-react";
import { getOptionalViewer } from "@/lib/data/queries/shell";
import { Logo } from "@/components/brand/logo";
import { Backdrop } from "@/components/shell/chrome";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <Backdrop />
      <header className="relative mx-auto flex h-20 w-full max-w-[1200px] items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Atrium home">
          <Logo size={28} />
        </Link>
      </header>
      <main id="main" className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl text-center">
          <div className="relative mx-auto w-fit">
            <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
            <p className="relative bg-gradient-to-b from-cyan-200 to-sky-500 bg-clip-text font-mono text-[96px] font-semibold leading-none tracking-tight text-transparent sm:text-[128px]">
              404
            </p>
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink sm:text-4xl">We couldn&apos;t find that page</h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-ink-muted">
            The link may be mistyped, or the page was moved. If it&apos;s a project or file, it may belong to a workspace you
            don&apos;t have access to.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Suspense fallback={<SignInLink />}>
              <AppLink />
            </Suspense>
            <Link href="/" className={buttonClasses({ variant: "outline", size: "lg" })}>
              <Home size={16} aria-hidden="true" /> Go to the homepage
            </Link>
          </div>
          <nav aria-label="Helpful links" className="mx-auto mt-12 grid max-w-lg gap-2 text-left sm:grid-cols-3">
            {[
              { href: "/help", label: "Help centre", icon: BookOpen },
              { href: "/status", label: "System status", icon: Compass },
              { href: "/contact", label: "Contact us", icon: LifeBuoy },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 whitespace-nowrap rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-sm text-ink-muted transition hover:border-cyan-400/25 hover:text-ink"
              >
                <item.icon size={16} className="text-cyan-300" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}

function SignInLink() {
  return (
    <Link href="/login" className={buttonClasses({ size: "lg" })}>
      Sign in <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

/** Reads the session, so it renders inside Suspense. */
async function AppLink() {
  const viewer = await getOptionalViewer();
  if (!viewer) return <SignInLink />;
  return (
    <Link href={viewer.home} className={buttonClasses({ size: "lg" })}>
      Back to the app <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}
