"use client";

import * as React from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, Input } from "@/components/ui/form";

export interface PasswordRule {
  label: string;
  test: (value: string) => boolean;
}

/** Mirrors the server rules in `signUp` / `resetPassword`; the server decides. */
export const SIGN_UP_RULES: PasswordRule[] = [
  { label: "At least 10 characters", test: (value) => value.length >= 10 },
  { label: "A letter", test: (value) => /[A-Za-z]/.test(value) },
  { label: "A number", test: (value) => /[0-9]/.test(value) },
];

export const RESET_RULES: PasswordRule[] = [
  { label: "At least 10 characters", test: (value) => value.length >= 10 },
  { label: "A number", test: (value) => /[0-9]/.test(value) },
];

function strength(value: string, rules: PasswordRule[]) {
  if (!value) return { score: 0, label: "", tone: "" };
  if (!rules.every((rule) => rule.test(value))) return { score: 1, label: "Too weak", tone: "bg-red-400" };
  // Meets the minimum; length and character variety earn the rest.
  let score = 2;
  if (value.length >= 14) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || (/[a-z]/.test(value) && /[A-Z]/.test(value))) score += 1;
  if (score === 2) return { score: 2, label: "Fair", tone: "bg-amber-400" };
  if (score === 3) return { score: 3, label: "Good", tone: "bg-cyan-400" };
  return { score: 4, label: "Strong", tone: "bg-emerald-400" };
}

export function PasswordField({
  id,
  name,
  label = "Password",
  autoComplete = "new-password",
  rules,
  error,
  showStrength = true,
}: {
  id: string;
  name: string;
  label?: React.ReactNode;
  autoComplete?: string;
  rules: PasswordRule[];
  error?: string | string[];
  showStrength?: boolean;
}) {
  const [value, setValue] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const meter = strength(value, rules);
  const hintId = `${id}-rules`;

  return (
    <Field label={label} htmlFor={id} error={error} required>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={[error ? `${id}-error` : null, hintId].filter(Boolean).join(" ")}
          className="pr-12"
          required
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-faint transition hover:bg-white/5 hover:text-ink"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {showStrength && (
        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="grid flex-1 grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((step) => (
              <span key={step} className={cn("h-1 rounded-full transition-colors", meter.score >= step ? meter.tone : "bg-white/[0.08]")} />
            ))}
          </div>
          <span className="w-16 text-right text-[11px] text-ink-faint">{meter.label}</span>
        </div>
      )}
      <ul id={hintId} className="flex flex-wrap gap-x-4 gap-y-1.5">
        {rules.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.label} className={cn("flex items-center gap-1.5 text-xs transition-colors", met ? "text-emerald-300" : "text-ink-faint")}>
              {met ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <Circle size={11} aria-hidden="true" />}
              {rule.label}
              <span className="sr-only">{met ? "(done)" : "(missing)"}</span>
            </li>
          );
        })}
      </ul>
    </Field>
  );
}
