"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/actions/result";
import type { ClientStatus } from "@/lib/data/types";
import type { ClientFormDefaults } from "@/lib/data/queries/clients";
import { CLIENT_STATUS } from "@/lib/domain/labels";
import { BrandTile } from "@/components/ui/avatar";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

/** Hand-picked hues that stay readable on the dark canvas. */
export const BRAND_HUES = [190, 210, 232, 262, 290, 322, 350, 12, 28, 45, 75, 105, 150, 170];

const STATUS_HELP: Record<ClientStatus, string> = {
  active: "Work is under way. Portal users can sign in.",
  onboarding: "Contracts or setup in progress. Portal users can sign in.",
  paused: "Work is on hold. Portal users can still sign in.",
  archived: "Portal closed for everyone. Doesn't count toward your plan.",
};

export function ClientForm({
  action,
  defaults,
  industries,
  submitLabel,
  allowArchived = false,
  footer,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaults: ClientFormDefaults;
  industries: string[];
  submitLabel: string;
  allowArchived?: boolean;
  footer?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const values = state?.values;
  const errors = state?.fieldErrors ?? {};
  const [name, setName] = React.useState(values?.companyName ?? defaults.companyName ?? "");
  const [hue, setHue] = React.useState<number>(Number(values?.brandHue ?? defaults.brandHue ?? BRAND_HUES[0]));
  // Keep a saved hue that is not one of the presets selectable, so editing never changes it silently.
  const hues = React.useMemo(() => {
    const saved = defaults.brandHue;
    return saved !== undefined && !BRAND_HUES.includes(saved) ? [saved, ...BRAND_HUES] : BRAND_HUES;
  }, [defaults.brandHue]);
  const [status, setStatus] = React.useState<ClientStatus>((values?.status as ClientStatus) ?? defaults.status ?? "onboarding");
  const statuses = (Object.keys(CLIENT_STATUS) as ClientStatus[]).filter((item) => allowArchived || item !== "archived");
  const err = (key: string) => errors[key];
  const invalidProps = (key: string) => ({
    "aria-invalid": Boolean(err(key)) || undefined,
    "aria-describedby": err(key) ? `${key}-error` : undefined,
  });

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {state?.message && !state.ok && <FormMessage>{state.message}</FormMessage>}

      <fieldset className="space-y-5">
        <legend className="mb-4 text-sm font-semibold text-ink">Company</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company name" htmlFor="companyName" error={err("companyName")} required>
            <Input
              id="companyName"
              name="companyName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Acme Co."
              maxLength={80}
              autoComplete="organization"
              required
              {...invalidProps("companyName")}
            />
          </Field>
          <Field label="Industry" htmlFor="industry" error={err("industry")} required>
            <Input
              id="industry"
              name="industry"
              list="industry-options"
              defaultValue={values?.industry ?? defaults.industry}
              placeholder="e.g. E-commerce"
              maxLength={60}
              required
              {...invalidProps("industry")}
            />
            <datalist id="industry-options">
              {industries.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>
          <Field label="Website" htmlFor="website" error={err("website")} hint="Domain only is fine, e.g. acme.example">
            <Input
              id="website"
              name="website"
              defaultValue={values?.website ?? defaults.website}
              placeholder="acme.example"
              inputMode="url"
              autoComplete="url"
              maxLength={120}
              {...invalidProps("website")}
            />
          </Field>
          <Field label="Status" htmlFor="status" error={err("status")} hint={STATUS_HELP[status]}>
            <Select id="status" name="status" value={status} onChange={(event) => setStatus(event.target.value as ClientStatus)} {...invalidProps("status")}>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {CLIENT_STATUS[item].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-4 text-sm font-semibold text-ink">Main contact</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contact name" htmlFor="contactName" error={err("contactName")} required>
            <Input
              id="contactName"
              name="contactName"
              defaultValue={values?.contactName ?? defaults.contactName}
              placeholder="e.g. Daniel Reed"
              maxLength={80}
              autoComplete="name"
              required
              {...invalidProps("contactName")}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={err("email")} required hint="Used for billing questions. Portal access is invited separately.">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={values?.email ?? defaults.email}
              placeholder="daniel@acme.example"
              autoComplete="email"
              maxLength={160}
              required
              {...invalidProps("email")}
            />
          </Field>
          <Field label="Phone" htmlFor="phone" error={err("phone")}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={values?.phone ?? defaults.phone}
              placeholder="+1 (212) 555-0142"
              autoComplete="tel"
              maxLength={32}
              {...invalidProps("phone")}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-4 text-sm font-semibold text-ink">Brand colour</legend>
        <input type="hidden" name="brandHue" value={hue} />
        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-white/[0.02] p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 sm:w-56">
            <BrandTile name={name.trim() || "New client"} hue={hue} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{name.trim() || "New client"}</p>
              <p className="text-xs text-ink-faint">Shown on project tiles and the portal</p>
            </div>
          </div>
          <div role="radiogroup" aria-label="Brand colour" className="grid flex-1 grid-cols-7 gap-2 sm:flex sm:flex-wrap">
            {hues.map((value, index) => {
              const selected = value === hue;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={hueName(value)}
                  data-hue={value}
                  tabIndex={selected || (!hues.includes(hue) && index === 0) ? 0 : -1}
                  onClick={() => setHue(value)}
                  onKeyDown={(event) => {
                    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
                    if (!step) return;
                    event.preventDefault();
                    const next = hues[(index + step + hues.length) % hues.length];
                    setHue(next);
                    const group = event.currentTarget.parentElement;
                    (group?.querySelector(`[data-hue="${next}"]`) as HTMLButtonElement | null)?.focus();
                  }}
                  className={cn(
                    "grid aspect-square w-full place-items-center rounded-lg transition sm:h-8 sm:w-8",
                    selected ? "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0c1823]" : "hover:scale-110",
                  )}
                  style={{ background: `linear-gradient(135deg, hsl(${value} 80% 60%), hsl(${value} 70% 40%))` }}
                >
                  {selected && <Check size={14} className="text-white" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
        {err("brandHue") && <p className="mt-2 text-xs text-red-300">{err("brandHue")?.[0]}</p>}
      </fieldset>

      <Field label="Internal notes" htmlFor="notes" error={err("notes")} hint="Only your team sees these. Never shown on the client portal.">
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={values?.notes ?? defaults.notes}
          placeholder="Preferred review day, decision makers, contract details…"
          {...invalidProps("notes")}
        />
      </Field>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-end">
        {footer}
        <SubmitButton size="lg" pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Plain colour name for a hue, so screen readers announce "Teal" rather than a number. */
function hueName(hue: number) {
  const names: [number, string][] = [
    [8, "Red"],
    [20, "Vermilion"],
    [38, "Orange"],
    [55, "Amber"],
    [85, "Lime"],
    [135, "Green"],
    [160, "Emerald"],
    [178, "Teal"],
    [200, "Cyan"],
    [222, "Sky blue"],
    [245, "Blue"],
    [270, "Indigo"],
    [300, "Violet"],
    [330, "Magenta"],
    [345, "Pink"],
    [360, "Crimson"],
  ];
  const match = names.find(([max]) => hue <= max);
  return match ? match[1] : "Red";
}
