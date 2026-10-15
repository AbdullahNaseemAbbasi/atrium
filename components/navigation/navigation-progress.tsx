"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar along the top of the window while a link click waits for the
 * next page, so a click never looks ignored. Next.js changes the URL as soon
 * as it can show the new page or its loading skeleton; the bar covers the
 * time before that. It appears only after 120ms (cached and prefetched pages
 * open without it), then fills and fades when the URL changes. A navigation
 * that never changes the URL (a redirect back to the same page, a failed
 * load) gives up after 15 seconds.
 */
interface Pending {
  /** The URL (path and query) the click left from. */
  from: string;
  /** Whether the bar became visible (loading outlasted the delay). */
  shown: boolean;
  id: number;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = search ? `${pathname}?${search}` : pathname;
  const [pending, setPending] = React.useState<Pending | null>(null);
  const nextId = React.useRef(0);

  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || !anchor.href || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const url = new URL(anchor.href, window.location.href);
      // Other sites, and file downloads and exports (they never change the page).
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      const from = window.location.pathname + window.location.search;
      const id = ++nextId.current;
      setPending({ from, shown: false, id });
      window.setTimeout(() => setPending((value) => (value?.id === id && value.from === from ? null : value)), 15_000);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!pending) return null;
  const loading = pending.from === current;
  if (!loading && !pending.shown) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[2px]" aria-hidden="true">
      <div
        key={`${pending.id}-${loading ? "loading" : "done"}`}
        className={`h-full origin-left bg-brand shadow-[0_0_10px_rgba(34,211,238,0.7)] ${loading ? "animate-nav-progress" : "animate-nav-done"}`}
        onAnimationStart={loading ? () => setPending((value) => (value?.id === pending.id ? { ...value, shown: true } : value)) : undefined}
      />
    </div>
  );
}
