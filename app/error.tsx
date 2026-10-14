"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCw, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Backdrop } from "@/components/shell/chrome";
import { Button, buttonClasses } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Hook point for an error reporting service.
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <Backdrop />
      <header className="relative mx-auto flex h-20 w-full max-w-[1200px] items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Atrium home">
          <Logo size={28} />
        </Link>
      </header>
      <main id="main" className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="card w-full max-w-lg p-8 text-center sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-400/25 bg-amber-500/10 text-amber-300 shadow-[0_0_30px_rgba(251,191,36,.12)]">
            <TriangleAlert size={26} aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Something went wrong</h1>
          <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-ink-muted">
            This page hit an unexpected error. Nothing you saved has been lost. Try again, and if it keeps happening, let us know.
          </p>
          {error.digest && (
            <p className="mt-4 text-xs text-ink-faint">
              Reference: <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-ink-muted">{error.digest}</code>
            </p>
          )}
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => retry()}>
              <RotateCw size={16} aria-hidden="true" /> Try again
            </Button>
            <Link href="/" className={buttonClasses({ variant: "outline", size: "lg" })}>
              <Home size={16} aria-hidden="true" /> Go to the homepage
            </Link>
          </div>
          <p className="mt-6 text-xs text-ink-faint">
            Still stuck?{" "}
            <Link href="/contact?topic=support" className="text-cyan-300 hover:text-cyan-200">
              Contact support
            </Link>{" "}
            or check the{" "}
            <Link href="/status" className="text-cyan-300 hover:text-cyan-200">
              status page
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
