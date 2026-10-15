"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { checkout } from "@/lib/actions/billing";
import type { ActionState } from "@/lib/actions/result";
import type { BillingInterval, PlanKey } from "@/lib/data/types";
import { FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

/**
 * The only thing this form posts is the plan key and interval. The amount and
 * price come from the server; with Stripe connected the action redirects to
 * Stripe's checkout or updates the Stripe subscription.
 */
export function CheckoutForm({
  orgSlug,
  plan,
  interval,
  payLabel,
  pendingLabel = "Processing test payment…",
  disabled = false,
}: {
  orgSlug: string;
  plan: PlanKey;
  interval: BillingInterval;
  payLabel: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState((previous: ActionState, formData: FormData) => checkout(orgSlug, previous, formData), null);
  return (
    <form action={formAction} className="space-y-3">
      {state && !state.ok && <FormMessage>{state.message}</FormMessage>}
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />
      <SubmitButton size="lg" className="w-full" disabled={disabled} pendingLabel={pendingLabel}>
        <Lock size={16} aria-hidden="true" /> {payLabel}
      </SubmitButton>
    </form>
  );
}
