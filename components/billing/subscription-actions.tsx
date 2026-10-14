"use client";

import * as React from "react";
import { CalendarX2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { setCancelAtPeriodEnd } from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";

/** Cancel at period end / resume. Both go through the billing webhook processor on the server. */
export function CancelSubscriptionButton({
  orgSlug,
  cancelAtPeriodEnd,
  periodEndText,
  planName,
}: {
  orgSlug: string;
  cancelAtPeriodEnd: boolean;
  periodEndText: string;
  planName: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const run = (cancel: boolean) => {
    if (cancel && !window.confirm(`Cancel ${planName} at the end of the period? You keep every feature until ${periodEndText}, then move to Starter.`)) {
      return;
    }
    startTransition(async () => {
      const result = await setCancelAtPeriodEnd(orgSlug, cancel);
      if (result?.ok) toast.success(result.message);
      else toast.error(result?.message ?? "Couldn't update the subscription.");
    });
  };

  return cancelAtPeriodEnd ? (
    <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(false)}>
      <RotateCcw size={14} /> {pending ? "Resuming…" : "Resume subscription"}
    </Button>
  ) : (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(true)} className="text-ink-muted hover:text-red-300">
      <CalendarX2 size={14} /> {pending ? "Cancelling…" : "Cancel at period end"}
    </Button>
  );
}
