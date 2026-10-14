"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { completeTestCheckout } from "@/lib/actions/billing";
import type { ActionState } from "@/lib/actions/result";
import type { BillingInterval, PlanKey } from "@/lib/data/types";
import { FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

/**
 * The only thing this form posts is the plan key and interval. The amount,
 * price ID and test card come from the server.
 */
export function CheckoutForm({
  orgSlug,
  plan,
  interval,
  payLabel,
  disabled = false,
}: {
  orgSlug: string;
  plan: PlanKey;
  interval: BillingInterval;
  payLabel: string;
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState((previous: ActionState, formData: FormData) => completeTestCheckout(orgSlug, previous, formData), null);
  return (
    <form action={formAction} className="space-y-3">
      {state && !state.ok && <FormMessage>{state.message}</FormMessage>}
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />
      <SubmitButton size="lg" className="w-full" disabled={disabled} pendingLabel="Processing test payment…">
        <Lock size={16} aria-hidden="true" /> {payLabel}
      </SubmitButton>
    </form>
  );
}
