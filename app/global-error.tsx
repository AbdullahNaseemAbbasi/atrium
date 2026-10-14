"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary that replaces the root layout, so it brings its own
 * document, styles and colours. Kept dependency-light on purpose.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-canvas font-sans text-ink">
        <title>Something went wrong · Atrium</title>
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101b26] p-8 text-center shadow-[0_16px_50px_rgba(0,0,0,.4)]">
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none" className="mx-auto" aria-hidden="true">
              <path
                d="M5 29V15.5C5 8.6 9.9 3 16 3s11 5.6 11 12.5V29h-5.5V15.8c0-3.6-2.5-6.5-5.5-6.5s-5.5 2.9-5.5 6.5V29H5Z"
                fill="#22d3ee"
              />
            </svg>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-ink">Atrium couldn&apos;t load</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Something failed before the page could start. Your work is safe. Please try again in a moment.
            </p>
            {error.digest && (
              <p className="mt-4 text-xs text-ink-faint">
                Reference: <code className="font-mono text-ink-muted">{error.digest}</code>
              </p>
            )}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 text-sm font-semibold text-on-brand"
              >
                Try again
              </button>
              {/* A full page load on purpose: the app shell itself failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-medium text-ink-secondary hover:text-ink"
              >
                Go to the homepage
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
