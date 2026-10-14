"use client";

import * as React from "react";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { inviteClientUser } from "@/lib/actions/clients";
import type { ActionState } from "@/lib/actions/result";
import { CLIENT_ROLE_DESCRIPTIONS, CLIENT_ROLE_LABELS } from "@/lib/auth/permissions";
import type { ClientRole } from "@/lib/data/types";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

export function InvitePortalUserButton({
  orgSlug,
  clientId,
  clientName,
  sharedProjects,
  variant = "primary",
  size = "md",
}: {
  orgSlug: string;
  clientId: string;
  clientName: string;
  sharedProjects: number;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [open, setOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((key) => key + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <UserPlus size={16} /> Invite portal user
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Invite someone from ${clientName}`}
        description={
          sharedProjects > 0
            ? `They'll see the ${sharedProjects === 1 ? "project" : `${sharedProjects} projects`} you share with ${clientName}. The invitation is valid for 7 days.`
            : `Nothing is shared with ${clientName} yet, so the portal will be empty until you share a project. The invitation is valid for 7 days.`
        }
      >
        <InviteForm key={formKey} orgSlug={orgSlug} clientId={clientId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({ orgSlug, clientId, onDone }: { orgSlug: string; clientId: string; onDone: () => void }) {
  const [state, action] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await inviteClientUser(orgSlug, clientId, previous, formData);
    if (result?.ok) {
      onDone();
      toast.success(result.message ?? "Invitation sent");
    }
    return result;
  }, null);
  const errors = state?.fieldErrors ?? {};
  const [role, setRole] = React.useState<ClientRole>((state?.values?.role as ClientRole) ?? "approver");

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && state.message && <FormMessage>{state.message}</FormMessage>}
      <Field label="Work email" htmlFor="portal-email" error={errors.email} required>
        <Input
          id="portal-email"
          name="email"
          type="email"
          autoComplete="off"
          placeholder="name@company.example"
          defaultValue={state?.values?.email}
          aria-invalid={Boolean(errors.email) || undefined}
          aria-describedby={errors.email ? "portal-email-error" : undefined}
          maxLength={160}
          autoFocus
          required
        />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium text-ink-secondary">Role</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(["approver", "viewer"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-cyan-400/30",
                role === value ? "border-cyan-400/50 bg-cyan-500/[0.07]" : "border-line bg-white/[0.02] hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="mt-1 h-4 w-4 flex-none accent-cyan-400"
              />
              <span>
                <span className="block text-sm font-medium text-ink">{CLIENT_ROLE_LABELS[value]}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{CLIENT_ROLE_DESCRIPTIONS[value]}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.role && <p className="mt-2 text-xs text-red-300">{errors.role[0]}</p>}
      </fieldset>
      <div className="flex justify-end border-t border-line pt-5">
        <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
      </div>
    </form>
  );
}
