"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/lib/actions/invitations";
import { FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

export function AcceptInvitationForm({ token, orgName }: { token: string; orgName: string }) {
  const [state, action] = useActionState(acceptInvitation.bind(null, token), null);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <FormMessage>{state.message}</FormMessage>}
      <SubmitButton className="w-full" size="lg" pendingLabel={`Joining ${orgName}…`}>
        Accept invitation
      </SubmitButton>
    </form>
  );
}
