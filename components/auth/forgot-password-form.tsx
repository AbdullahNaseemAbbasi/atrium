"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/auth";
import { buttonClasses } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  const errors = state?.fieldErrors ?? {};

  if (state?.ok) {
    return (
      <div className="text-center" role="status">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,.15)]">
          <MailCheck size={26} aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm leading-relaxed text-ink-secondary">{state.message}</p>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Didn&apos;t get it? Check your spam folder, or wait a minute and try again.
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-3 text-left text-xs leading-relaxed text-ink-muted">
          <span className="font-medium text-ink-secondary">Demo build:</span> no email is sent. To see the next step,{" "}
          <Link href="/reset-password?token=demo-reset-token" className="text-cyan-300 hover:text-cyan-200">
            open the reset screen
          </Link>
          .
        </div>
        <Link href="/login" className={buttonClasses({ variant: "outline", size: "lg", className: "mt-6 w-full" })}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.message}</FormMessage>}
      <Field label="Work email" htmlFor="email" error={errors.email} hint="We'll send a link to reset your password." required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@studio.example"
          defaultValue={state?.values?.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : "email-hint"}
          required
          autoFocus
        />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="Sending link…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
