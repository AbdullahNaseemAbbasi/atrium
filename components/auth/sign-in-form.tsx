"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/lib/actions/auth";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.message}</FormMessage>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Work email" htmlFor="email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          defaultValue={state?.values?.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          required
        />
      </Field>
      <Field
        label={
          <span className="flex w-full items-center justify-between">
            Password
            <Link href="/forgot-password" className="text-xs font-normal text-cyan-300 hover:text-cyan-200">
              Forgot password?
            </Link>
          </span>
        }
        htmlFor="password"
        error={errors.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          required
        />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
