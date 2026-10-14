"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { resetPassword } from "@/lib/actions/auth";
import { buttonClasses } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";
import { PasswordField, RESET_RULES } from "./password-field";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, null);
  const errors = state?.fieldErrors ?? {};

  if (state?.ok) {
    return (
      <div className="text-center" role="status">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,.15)]">
          <ShieldCheck size={26} aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm leading-relaxed text-ink-secondary">{state.message}</p>
        <Link href="/login" className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.message}</FormMessage>}
      {errors.token && <FormMessage>This reset link is missing its code. Request a new link.</FormMessage>}
      <input type="hidden" name="token" value={token} />
      <PasswordField id="password" name="password" label="New password" rules={RESET_RULES} error={errors.password} />
      <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          required
        />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="Saving…">
        Set new password
      </SubmitButton>
    </form>
  );
}
