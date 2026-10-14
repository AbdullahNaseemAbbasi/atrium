"use client";

import * as React from "react";
import { useActionState } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { toast } from "sonner";
import { changePassword, updateProfile } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/result";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";
import { HuePicker } from "./hue-picker";

export interface ProfileDefaults {
  name: string;
  email: string;
  title: string;
  timezone: string;
  avatarHue: number;
}

export function ProfileForm({
  orgSlug,
  defaults,
  timezones,
  roleLabel,
}: {
  orgSlug: string;
  defaults: ProfileDefaults;
  timezones: { value: string; label: string }[];
  roleLabel: string;
}) {
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await updateProfile(orgSlug, previous, formData);
    if (result?.ok) toast.success(result.message ?? "Profile saved.");
    return result;
  }, null);
  const values = state?.values;
  const errors = state?.fieldErrors ?? {};
  const [name, setName] = React.useState(values?.name ?? defaults.name);
  const [hue, setHue] = React.useState(Number(values?.avatarHue ?? defaults.avatarHue));

  return (
    <Card>
      <CardHeader icon={UserRound} title="Profile" description="How you appear to your team and to clients in the portal." />
      <form action={formAction} noValidate className="space-y-6 px-4 pb-5 sm:px-5">
        {state && !state.ok && <FormMessage>{state.message}</FormMessage>}

        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-white/[0.02] p-4 sm:flex-row sm:items-center">
          <Avatar user={{ name: name || "?", avatarHue: hue }} size="xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{name || "Your name"}</p>
            <p className="text-xs text-ink-faint">
              {roleLabel} · {defaults.email}
            </p>
            <div className="mt-3">
              <HuePicker id="avatarHue-range" name="avatarHue" label="Avatar colour" value={hue} onChange={setHue} />
            </div>
          </div>
        </div>
        {errors.avatarHue && <p className="text-xs text-red-300">{errors.avatarHue[0]}</p>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" error={errors.name} required>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
              required
            />
          </Field>
          <Field label="Job title" htmlFor="title" error={errors.title} hint="Shown next to your name in comments.">
            <Input id="title" name="title" defaultValue={values?.title ?? defaults.title} maxLength={80} placeholder="e.g. Senior Designer" />
          </Field>
          <Field label="Email" htmlFor="email" hint="Your sign-in email. Contact your workspace owner to change it.">
            <Input id="email" value={defaults.email} readOnly disabled />
          </Field>
          <Field label="Timezone" htmlFor="timezone" error={errors.timezone} hint="Due dates and digests use this timezone.">
            <Select id="timezone" name="timezone" defaultValue={values?.timezone ?? defaults.timezone} aria-invalid={Boolean(errors.timezone)}>
              {timezones.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label === zone.value ? zone.value : `${zone.label} · ${zone.value}`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex justify-end border-t border-line pt-5">
          <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm({ orgSlug }: { orgSlug: string }) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await changePassword(orgSlug, previous, formData);
    if (result?.ok) formRef.current?.reset();
    return result;
  }, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <Card className="mt-4">
      <CardHeader icon={KeyRound} title="Change password" description="At least 10 characters, including a number." />
      <form ref={formRef} action={formAction} noValidate className="space-y-5 px-4 pb-5 sm:px-5">
        {state?.message && <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>}
        <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword} required className="sm:max-w-sm">
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="New password" htmlFor="password" error={errors.password} required hint="10+ characters with at least one number.">
            <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword} required>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} />
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">Demo accounts share the password atrium-demo, so this form validates but doesn&apos;t change it.</p>
          <SubmitButton variant="secondary" pendingLabel="Checking…">
            Update password
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
