"use client";

import * as React from "react";
import { useActionState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/actions/result";
import type { OrgRole } from "@/lib/data/types";
import { Field, FormMessage, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

const MAX = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parse(raw: string) {
  const all = raw
    .split(/[\s,;]+/)
    .map((item) => item.trim().replace(/^<|>$/g, "").toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(all)];
  return { unique, duplicates: all.length - unique.length, invalid: unique.filter((item) => !EMAIL.test(item)) };
}

export function InviteForm({
  action,
  roleOptions,
  defaultRole,
  seatsLeft,
  footer,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  roleOptions: { value: OrgRole; label: string; description: string }[];
  defaultRole: OrgRole;
  /** `null` when the plan has unlimited seats. */
  seatsLeft: number | null;
  footer?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  const [raw, setRaw] = React.useState(state?.values?.emails ?? "");
  const [role, setRole] = React.useState<OrgRole>((state?.values?.role as OrgRole) ?? defaultRole);
  const { unique, duplicates, invalid } = parse(raw);
  const overMax = unique.length > MAX;
  const overSeats = seatsLeft !== null && unique.length > seatsLeft;

  return (
    <form action={formAction} className="space-y-7" noValidate>
      {state && !state.ok && state.message && <FormMessage>{state.message}</FormMessage>}

      <div className="space-y-2">
        <Field
          label="Email addresses"
          htmlFor="emails"
          error={errors.emails}
          required
          hint="Separate addresses with commas or new lines. Up to 10 at a time."
        >
          <Textarea
            id="emails"
            name="emails"
            rows={4}
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder={"jordan@studio.example\nriley@studio.example"}
            aria-invalid={Boolean(errors.emails) || undefined}
            aria-describedby={errors.emails ? "emails-error" : "emails-hint emails-summary"}
            autoFocus
            spellCheck={false}
          />
        </Field>
        {unique.length > 0 && (
          <div id="emails-summary" aria-live="polite">
            <ul className="flex flex-wrap gap-1.5" aria-label="People to invite">
              {unique.slice(0, 12).map((email) => (
                <li
                  key={email}
                  className={cn(
                    "max-w-full truncate rounded-md border px-2 py-0.5 text-xs",
                    EMAIL.test(email) ? "border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-100" : "border-red-500/30 bg-red-500/10 text-red-200",
                  )}
                >
                  {email}
                </li>
              ))}
              {unique.length > 12 && <li className="px-1 text-xs text-ink-faint">+{unique.length - 12} more</li>}
            </ul>
            <p className={cn("mt-2 text-xs", overMax || overSeats || invalid.length ? "text-amber-300" : "text-ink-faint")}>
              {unique.length} {unique.length === 1 ? "person" : "people"}
              {duplicates > 0 && ` · ${duplicates} duplicate${duplicates === 1 ? "" : "s"} removed`}
              {invalid.length > 0 && ` · ${invalid.length} not a valid email`}
              {overMax && ` · the limit is ${MAX} per batch`}
              {!overMax && overSeats && ` · only ${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left`}
            </p>
          </div>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink-secondary">Role</legend>
        <p className="mt-1 text-xs text-ink-faint">Everyone in this batch gets the same role. You can change it later.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {roleOptions.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-cyan-400/30",
                role === option.value ? "border-cyan-400/50 bg-cyan-500/[0.07]" : "border-line bg-white/[0.02] hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="mt-1 h-4 w-4 flex-none accent-cyan-400"
              />
              <span>
                <span className="block text-sm font-medium text-ink">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.role && <p className="mt-2 text-xs text-red-300">{errors.role[0]}</p>}
      </fieldset>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-end">
        {footer}
        <SubmitButton size="lg" pendingLabel="Sending…" disabled={unique.length === 0}>
          <Send size={16} /> {unique.length > 1 ? `Send ${unique.length} invitations` : "Send invitation"}
        </SubmitButton>
      </div>
    </form>
  );
}
