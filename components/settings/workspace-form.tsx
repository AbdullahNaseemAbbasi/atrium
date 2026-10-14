"use client";

import * as React from "react";
import { useActionState } from "react";
import { Building2, Link2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateWorkspace } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/result";
import { INDUSTRIES } from "@/lib/settings/options";
import { BrandTile } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";
import { FormNote } from "@/components/ui/misc";
import { HuePicker } from "./hue-picker";

export interface WorkspaceDefaults {
  name: string;
  slug: string;
  timezone: string;
  industry: string;
  website: string;
  brandHue: number;
}

export function WorkspaceForm({
  orgSlug,
  defaults,
  timezones,
  canEdit,
  ownerName,
}: {
  orgSlug: string;
  defaults: WorkspaceDefaults;
  timezones: { value: string; label: string }[];
  canEdit: boolean;
  ownerName: string | null;
}) {
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await updateWorkspace(orgSlug, previous, formData);
    if (result?.ok) toast.success(result.message ?? "Workspace saved.");
    return result;
  }, null);
  const values = state?.values;
  const errors = state?.fieldErrors ?? {};
  const [name, setName] = React.useState(values?.name ?? defaults.name);
  const [hue, setHue] = React.useState(Number(values?.brandHue ?? defaults.brandHue));
  const industries = INDUSTRIES.includes(defaults.industry) ? INDUSTRIES : [defaults.industry, ...INDUSTRIES];

  return (
    <Card>
      <CardHeader icon={Building2} title="Workspace" description="Shown to your team and on every client portal." />
      <form action={formAction} noValidate className="space-y-6 px-4 pb-5 sm:px-5">
        {!canEdit && (
          <FormNote icon={Lock}>
            You can view these settings. Only {ownerName ? `the owner (${ownerName})` : "the owner"} can change them.
          </FormNote>
        )}
        {state && !state.ok && <FormMessage>{state.message}</FormMessage>}

        <fieldset disabled={!canEdit} className="space-y-6">
          <legend className="sr-only">Workspace details</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Workspace name" htmlFor="ws-name" error={errors.name} required>
              <Input
                id="ws-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                aria-invalid={Boolean(errors.name)}
                required
              />
            </Field>
            <Field
              label="Workspace URL"
              htmlFor="ws-slug"
              hint="Fixed after creation: clients have bookmarked portal links that use it. Support can move it and set up redirects."
            >
              <div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white/[0.015] px-3.5 text-sm text-ink-muted">
                <Link2 size={15} className="flex-none text-ink-faint" aria-hidden="true" />
                <span className="truncate" id="ws-slug">
                  atrium.example/w/<span className="text-ink-secondary">{defaults.slug}</span>
                </span>
              </div>
            </Field>
            <Field label="Timezone" htmlFor="ws-timezone" error={errors.timezone} hint="Used for client-facing due dates and reports.">
              <Select id="ws-timezone" name="timezone" defaultValue={values?.timezone ?? defaults.timezone} aria-invalid={Boolean(errors.timezone)}>
                {timezones.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label === zone.value ? zone.value : `${zone.label} · ${zone.value}`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Industry" htmlFor="ws-industry" error={errors.industry}>
              <Select id="ws-industry" name="industry" defaultValue={values?.industry ?? defaults.industry}>
                {industries.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Website" htmlFor="ws-website" error={errors.website} hint="Linked from the client portal footer.">
              <Input
                id="ws-website"
                name="website"
                defaultValue={values?.website ?? defaults.website}
                placeholder="studio.example"
                inputMode="url"
                maxLength={120}
                aria-invalid={Boolean(errors.website)}
              />
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-ink-secondary">Brand colour</p>
            <p className="mt-1 text-xs text-ink-faint">Tints your logo tile and the client portal accent.</p>
            <div className="mt-3 flex flex-col gap-5 rounded-2xl border border-line bg-white/[0.02] p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <BrandTile name={name || "?"} hue={hue} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{name || "Workspace name"}</p>
                  <p className="text-xs text-ink-faint">Portal preview</p>
                </div>
              </div>
              <div className="min-w-0 flex-1 sm:border-l sm:border-line sm:pl-5">
                <HuePicker id="brandHue-range" name="brandHue" label="Brand colour" value={hue} onChange={setHue} disabled={!canEdit} />
              </div>
            </div>
          </div>
        </fieldset>

        {canEdit && (
          <div className="flex justify-end border-t border-line pt-5">
            <SubmitButton pendingLabel="Saving…">Save workspace</SubmitButton>
          </div>
        )}
      </form>
    </Card>
  );
}

export function DangerZone({ workspaceName, isOwner }: { workspaceName: string; isOwner: boolean }) {
  const [typed, setTyped] = React.useState("");
  const matches = typed === workspaceName;
  return (
    <Card className="mt-4 border-red-500/20">
      <CardHeader icon={Trash2} tone="red" title="Delete workspace" description="Permanently removes projects, files, client portals and the audit log." />
      <div className="space-y-5 px-4 pb-5 sm:px-5">
        <div className="grid gap-4 text-sm text-ink-muted md:grid-cols-3">
          <RetentionStep step="1" title="Read-only at once">
            Members and clients lose access immediately. Billing stops at the end of the paid period.
          </RetentionStep>
          <RetentionStep step="2" title="30-day soft delete">
            Data is kept for 30 days so support can restore it if this was a mistake.
          </RetentionStep>
          <RetentionStep step="3" title="Then purged">
            Database rows and every stored file are permanently deleted. Paid invoices are kept for tax records.
          </RetentionStep>
        </div>
        <Field label={`Type “${workspaceName}” to confirm`} htmlFor="confirmName" className="sm:max-w-sm">
          <Input
            id="confirmName"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={!isOwner}
            autoComplete="off"
            placeholder={workspaceName}
          />
        </Field>
        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">
            {isOwner
              ? matches
                ? "Name confirmed. Deletion is still turned off in this demo so the shared data stays intact."
                : "Deletion is turned off in this demo. The confirmation works so you can see the flow."
              : "Only the workspace owner can delete a workspace."}
          </p>
          <Button variant="danger" disabled aria-disabled="true" title="Turned off in the demo">
            <Trash2 size={16} /> Delete workspace
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RetentionStep({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-3.5">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-red-500/15 text-[11px] text-red-300">{step}</span>
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed">{children}</p>
    </div>
  );
}
