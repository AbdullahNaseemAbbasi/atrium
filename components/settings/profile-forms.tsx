"use client";

import * as React from "react";
import { useActionState } from "react";
import { Camera, KeyRound, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { changePassword, deleteAvatar, updateProfile, uploadAvatar } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/result";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  avatarUrl?: string;
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
          <Avatar user={{ name: name || "?", avatarHue: hue, avatarUrl: defaults.avatarUrl }} size="xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{name || "Your name"}</p>
            <p className="text-xs text-ink-faint">
              {roleLabel} · {defaults.email}
            </p>
            <PhotoControls orgSlug={orgSlug} hasPhoto={Boolean(defaults.avatarUrl)} />
            <div className="mt-3">
              <HuePicker
                id="avatarHue-range"
                name="avatarHue"
                label={defaults.avatarUrl ? "Colour behind your initials (used when there's no photo)" : "Avatar colour"}
                value={hue}
                onChange={setHue}
              />
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

/** Upload or remove the profile photo. Runs outside the profile form's submit, right after a file is picked. */
function PhotoControls({ orgSlug, hasPhoto }: { orgSlug: string; hasPhoto: boolean }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, startTransition] = React.useTransition();

  function upload(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("avatar", file);
    startTransition(async () => {
      const result = await uploadAvatar(orgSlug, formData);
      if (result?.ok) toast.success(result.message);
      else toast.error(result?.message ?? "The photo couldn't be saved.");
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        id="avatar-file"
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
        <Camera size={15} /> {pending ? "Saving…" : hasPhoto ? "Change photo" : "Upload photo"}
      </Button>
      {hasPhoto && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteAvatar(orgSlug);
              if (result?.ok) toast.success(result.message);
              else toast.error(result?.message ?? "The photo couldn't be removed.");
            })
          }
        >
          <Trash2 size={15} /> Remove
        </Button>
      )}
      <span className="text-xs text-ink-faint">JPG, PNG or WebP, up to 1.5 MB.</span>
    </div>
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
          <p className="text-xs text-ink-faint">Demo accounts keep the shared password atrium-demo. Accounts you create change for real.</p>
          <SubmitButton variant="secondary" pendingLabel="Checking…">
            Update password
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
