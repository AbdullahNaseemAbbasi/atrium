"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import { Checkbox, Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";
import { PasswordField, SIGN_UP_RULES } from "./password-field";

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, null);
  const errors = state?.fieldErrors ?? {};
  const values = state?.values ?? {};
  const emailTaken = Boolean(errors.email?.some((message) => message.toLowerCase().includes("already")));

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && (!state.fieldErrors || emailTaken) && (
        <FormMessage>
          {state.message}
          {emailTaken && (
            <>
              {" "}
              <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-red-100 underline underline-offset-2">
                Go to sign in
              </Link>
            </>
          )}
        </FormMessage>
      )}
      {/* Kept for flows that come back to an invitation; the action redirects to onboarding today. */}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Full name" htmlFor="name" error={errors.name} required>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Jordan Lee"
          defaultValue={values.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          required
        />
      </Field>
      <Field label="Work email" htmlFor="email" error={errors.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@studio.example"
          defaultValue={values.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          required
        />
      </Field>
      <PasswordField id="password" name="password" rules={SIGN_UP_RULES} error={errors.password} />
      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm text-ink-muted">
          <Checkbox
            name="terms"
            className="mt-0.5 flex-none"
            defaultChecked={values.terms === "on"}
            aria-invalid={Boolean(errors.terms)}
            aria-describedby={errors.terms ? "terms-error" : undefined}
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-cyan-300 hover:text-cyan-200">
              terms of service
            </Link>{" "}
            and the{" "}
            <Link href="/privacy" target="_blank" className="text-cyan-300 hover:text-cyan-200">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {errors.terms && (
          <p id="terms-error" role="alert" className="pl-7 text-xs text-red-300">
            {errors.terms[0]}
          </p>
        )}
      </div>
      <SubmitButton className="w-full" size="lg" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}
