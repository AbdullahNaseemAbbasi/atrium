"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Shows a one-time toast when the URL carries a flag such as `?created=1`
 * (set by a server action redirect), then removes the flag from the URL.
 * Must sit inside <Suspense> because it reads search params.
 */
export function FlashToast({ messages }: { messages: Record<string, string> }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const shown = React.useRef(false);

  React.useEffect(() => {
    if (shown.current) return;
    const hit = Object.keys(messages).find((key) => searchParams.has(key));
    if (!hit) return;
    shown.current = true;
    toast.success(messages[hit]);
    const next = new URLSearchParams(searchParams.toString());
    next.delete(hit);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [messages, pathname, router, searchParams]);

  return null;
}
