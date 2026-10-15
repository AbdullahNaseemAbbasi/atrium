"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { cn, formatBytes, formatMoney } from "@/lib/utils";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { PLANS } from "@/lib/billing/plans";
import { checkSlugAvailability, createWorkspace } from "@/lib/actions/onboarding";
import type { ActionState } from "@/lib/actions/result";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Label, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";
import {
  INDUSTRIES,
  INVITATION_DAYS,
  INVITE_ROLES,
  MAX_INVITES,
  TIMEZONES,
  TRIAL_DAYS,
  isValidTimeZone,
  slugIssue,
  suggestSlug,
  type InviteRole,
} from "./options";

type Step = 0 | 1 | 2;
type PlanChoice = "starter" | "professional";

interface InviteRow {
  id: number;
  email: string;
  role: InviteRole;
}

type SlugStatus =
  | { state: "idle" }
  | { state: "checking"; slug: string }
  | { state: "available" | "taken" | "invalid"; slug: string; message: string };

const STEPS = [
  { title: "Workspace", hint: "Name and address" },
  { title: "Team", hint: "Invite teammates" },
  { title: "Plan", hint: "Free or trial" },
];

const STEP_FIELDS: Record<Step, (key: string) => boolean> = {
  0: (key) => ["name", "slug", "timezone", "industry"].includes(key),
  1: (key) => key.startsWith("invites"),
  2: (key) => key === "plan",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const noopSubscribe = () => () => {};

export function WorkspaceWizard({ defaultTimezone, ownEmail }: { defaultTimezone: string; ownEmail: string }) {
  const [step, setStep] = React.useState<Step>(0);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<SlugStatus>({ state: "idle" });
  const [timezoneChoice, setTimezoneChoice] = React.useState<string | null>(null);
  const [industry, setIndustry] = React.useState("");
  const [invites, setInvites] = React.useState<InviteRow[]>([{ id: 1, email: "", role: "member" }]);
  const [plan, setPlan] = React.useState<PlanChoice>("professional");
  const [localErrors, setLocalErrors] = React.useState<Record<string, string>>({});
  const [edited, setEdited] = React.useState<Set<string>>(new Set());
  const [advancing, setAdvancing] = React.useState(false);

  const nextRowId = React.useRef(2);
  const slugTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const slugRequest = React.useRef(0);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const firstRender = React.useRef(true);

  // The browser's timezone is the best default, but it is only known on the client.
  const browserTimezone = React.useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    () => null,
  );
  const timezone =
    timezoneChoice ?? (browserTimezone && isValidTimeZone(browserTimezone) ? browserTimezone : isValidTimeZone(defaultTimezone) ? defaultTimezone : "UTC");
  const timezoneOptions = TIMEZONES.some((item) => item.value === timezone) ? TIMEZONES : [{ value: timezone, label: timezone.replace(/_/g, " ") }, ...TIMEZONES];

  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await createWorkspace(previous, formData);
    if (result && !result.ok) {
      setEdited(new Set());
      const keys = Object.keys(result.fieldErrors ?? {});
      const target = ([0, 1, 2] as Step[]).find((candidate) => keys.some(STEP_FIELDS[candidate]));
      if (target !== undefined) setStep(target);
      const slugError = result.fieldErrors?.slug?.[0];
      if (slugError) setSlugStatus({ state: "taken", slug: String(formData.get("slug") ?? ""), message: slugError });
    }
    return result;
  }, null);

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  React.useEffect(() => () => clearTimeout(slugTimer.current), []);

  function errorFor(key: string) {
    if (localErrors[key]) return localErrors[key];
    if (edited.has(key)) return undefined;
    return state?.fieldErrors?.[key]?.[0];
  }

  function touch(key: string) {
    setEdited((current) => (current.has(key) ? current : new Set(current).add(key)));
    setLocalErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function scheduleSlugCheck(value: string) {
    clearTimeout(slugTimer.current);
    const request = ++slugRequest.current;
    if (!value) {
      setSlugStatus({ state: "idle" });
      return;
    }
    const issue = slugIssue(value);
    if (issue) {
      setSlugStatus({ state: "invalid", slug: value, message: issue });
      return;
    }
    setSlugStatus({ state: "checking", slug: value });
    slugTimer.current = setTimeout(async () => {
      const result = await checkSlugAvailability(value);
      if (request !== slugRequest.current) return;
      setSlugStatus({ state: result.available ? "available" : "taken", slug: value, message: result.message });
    }, 350);
  }

  function updateName(value: string) {
    setName(value);
    touch("name");
    if (!slugEdited) {
      const suggestion = suggestSlug(value);
      setSlug(suggestion);
      touch("slug");
      scheduleSlugCheck(suggestion);
    }
  }

  function updateSlug(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").slice(0, 32);
    setSlug(cleaned);
    setSlugEdited(true);
    touch("slug");
    scheduleSlugCheck(cleaned);
  }

  async function validateWorkspace() {
    const errors: Record<string, string> = {};
    const trimmed = name.trim();
    if (trimmed.length < 2) errors.name = "Use at least 2 characters.";
    else if (trimmed.length > 60) errors.name = "Keep the name under 60 characters.";
    const issue = slugIssue(slug);
    if (!slug) errors.slug = "Choose an address for your workspace.";
    else if (issue) errors.slug = issue;
    else if (slugStatus.state !== "available" || slugStatus.slug !== slug) {
      clearTimeout(slugTimer.current);
      const request = ++slugRequest.current;
      setSlugStatus({ state: "checking", slug });
      const result = await checkSlugAvailability(slug);
      if (request === slugRequest.current) {
        setSlugStatus({ state: result.available ? "available" : "taken", slug, message: result.message });
      }
      if (!result.available) errors.slug = result.message;
    }
    if (!industry) errors.industry = "Choose the option closest to your business.";
    return errors;
  }

  function validateInvites() {
    const errors: Record<string, string> = {};
    const seen = new Set<string>();
    const filled = invites.filter((row) => row.email.trim());
    filled.forEach((row) => {
      const index = invites.indexOf(row);
      const email = row.email.trim().toLowerCase();
      const key = `invites.${index}.email`;
      if (!EMAIL_PATTERN.test(email)) errors[key] = "Enter a valid email address.";
      else if (email === ownEmail.toLowerCase()) errors[key] = "That's your own email. You'll be the owner.";
      else if (seen.has(email)) errors[key] = "This email is already in the list.";
      seen.add(email);
    });
    return errors;
  }

  async function goNext() {
    if (advancing) return;
    setAdvancing(true);
    try {
      const errors = step === 0 ? await validateWorkspace() : validateInvites();
      setLocalErrors(errors);
      if (Object.keys(errors).length === 0) setStep((current) => (current < 2 ? ((current + 1) as Step) : current));
    } finally {
      setAdvancing(false);
    }
  }

  function goBack() {
    setLocalErrors({});
    setStep((current) => (current > 0 ? ((current - 1) as Step) : current));
  }

  function updateInvite(id: number, patch: Partial<InviteRow>) {
    setInvites((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    const index = invites.findIndex((row) => row.id === id);
    if (index !== -1) touch(`invites.${index}.email`);
  }

  function addInvite() {
    if (invites.length >= MAX_INVITES) return;
    setInvites((rows) => [...rows, { id: nextRowId.current++, email: "", role: "member" }]);
  }

  function removeInvite(id: number) {
    setInvites((rows) => (rows.length === 1 ? [{ ...rows[0], email: "" }] : rows.filter((row) => row.id !== id)));
    setLocalErrors({});
    setEdited(new Set());
  }

  const filledInvites = invites.filter((row) => row.email.trim());
  const starterSeats = PLANS.starter.limits.seats ?? 0;
  const starterTooSmall = filledInvites.length + 1 > starterSeats;
  const formError = state && !state.ok && (!state.fieldErrors || state.fieldErrors.form) ? state.message : null;

  return (
    <div className="card overflow-hidden">
      <Stepper step={step} onSelect={(target) => target < step && setStep(target)} />

      <form
        action={formAction}
        noValidate
        onKeyDown={(event) => {
          // Enter moves to the next step instead of submitting early.
          if (event.key === "Enter" && step < 2 && (event.target as HTMLElement).tagName === "INPUT") {
            event.preventDefault();
            void goNext();
          }
        }}
        className="p-5 sm:p-8"
      >
        {formError && <FormMessage className="mb-6">{formError}</FormMessage>}

        {/* Step 1: workspace */}
        <section hidden={step !== 0} aria-labelledby="step-0-title">
          <StepHeading id="step-0-title" ref={step === 0 ? headingRef : undefined} icon={Building2} title="Name your workspace">
            This is what your team and clients will see. You can change the name later; the address is permanent.
          </StepHeading>
          <div className="mt-7 space-y-5">
            <Field label="Workspace name" htmlFor="name" error={errorFor("name")} required>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(event) => updateName(event.target.value)}
                placeholder="Northwind Studio"
                autoComplete="organization"
                maxLength={60}
                aria-invalid={Boolean(errorFor("name"))}
                aria-describedby={errorFor("name") ? "name-error" : undefined}
                required
              />
            </Field>
            <div className="space-y-2">
              <Label htmlFor="slug">
                Workspace address
                <span className="ml-0.5 text-red-400" aria-hidden="true">
                  *
                </span>
              </Label>
              <div
                className={cn(
                  "flex h-11 items-center overflow-hidden rounded-xl border bg-white/[0.025] transition-colors focus-within:border-cyan-400/60 focus-within:ring-2 focus-within:ring-cyan-400/20",
                  errorFor("slug") || slugStatus.state === "taken" || slugStatus.state === "invalid" ? "border-red-500/50" : "border-line-strong",
                )}
              >
                <span className="flex h-full flex-none items-center border-r border-line bg-white/[0.03] px-3 font-mono text-xs text-ink-faint">
                  atrium.example/w/
                </span>
                <input
                  id="slug"
                  name="slug"
                  value={slug}
                  onChange={(event) => updateSlug(event.target.value)}
                  placeholder="northwind-studio"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={32}
                  aria-invalid={Boolean(errorFor("slug")) || slugStatus.state === "taken" || slugStatus.state === "invalid"}
                  aria-describedby="slug-status"
                  className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
                  required
                />
                <span className="pr-3" aria-hidden="true">
                  {slugStatus.state === "checking" && <LoaderCircle size={16} className="animate-spin text-ink-faint" />}
                  {slugStatus.state === "available" && slugStatus.slug === slug && <CheckCircle2 size={16} className="text-emerald-400" />}
                  {(slugStatus.state === "taken" || slugStatus.state === "invalid") && <AlertCircle size={16} className="text-red-400" />}
                </span>
              </div>
              <SlugMessage id="slug-status" status={slugStatus} slug={slug} error={errorFor("slug")} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Timezone" htmlFor="timezone" error={errorFor("timezone")} hint="Used for due dates and digests." required>
                <Select
                  id="timezone"
                  name="timezone"
                  value={timezone}
                  onChange={(event) => {
                    setTimezoneChoice(event.target.value);
                    touch("timezone");
                  }}
                  aria-describedby={errorFor("timezone") ? "timezone-error" : "timezone-hint"}
                >
                  {timezoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="What best describes you?" htmlFor="industry" error={errorFor("industry")} required>
                <Select
                  id="industry"
                  name="industry"
                  value={industry}
                  onChange={(event) => {
                    setIndustry(event.target.value);
                    touch("industry");
                  }}
                  aria-invalid={Boolean(errorFor("industry"))}
                  aria-describedby={errorFor("industry") ? "industry-error" : undefined}
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {INDUSTRIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </section>

        {/* Step 2: invitations */}
        <section hidden={step !== 1} aria-labelledby="step-1-title">
          <StepHeading id="step-1-title" ref={step === 1 ? headingRef : undefined} icon={UserPlus} title="Invite your team">
            Optional. Invitations stay open for {INVITATION_DAYS} days, and you can invite more people from the Team page later. Clients are
            invited separately, once you&apos;ve added them.
          </StepHeading>
          <fieldset className="mt-7">
            <legend className="sr-only">Teammates to invite</legend>
            <ul className="space-y-3">
              {invites.map((row, index) => {
                const emailKey = `invites.${index}.email`;
                const error = errorFor(emailKey);
                return (
                  <li key={row.id} className="grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3 sm:grid-cols-[1fr_190px_auto] sm:items-start sm:border-0 sm:bg-transparent sm:p-0">
                    <div className="min-w-0 space-y-1.5">
                      <label htmlFor={`invite-email-${row.id}`} className="sr-only">
                        Email for teammate {index + 1}
                      </label>
                      <Input
                        id={`invite-email-${row.id}`}
                        name="inviteEmail"
                        type="email"
                        value={row.email}
                        onChange={(event) => updateInvite(row.id, { email: event.target.value })}
                        placeholder="teammate@studio.example"
                        autoComplete="off"
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `invite-email-${row.id}-error` : undefined}
                      />
                      {error && (
                        <p id={`invite-email-${row.id}-error`} role="alert" className="flex items-center gap-1.5 text-xs text-red-300">
                          <AlertCircle size={13} aria-hidden="true" /> {error}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 sm:contents">
                      <label htmlFor={`invite-role-${row.id}`} className="sr-only">
                        Role for teammate {index + 1}
                      </label>
                      <Select
                        id={`invite-role-${row.id}`}
                        name="inviteRole"
                        value={row.role}
                        onChange={(event) => updateInvite(row.id, { role: event.target.value as InviteRole })}
                        className="min-w-0 flex-1"
                      >
                        {INVITE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInvite(row.id)}
                        aria-label={row.email ? `Remove ${row.email}` : `Remove teammate ${index + 1}`}
                        disabled={invites.length === 1 && !row.email}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={addInvite} disabled={invites.length >= MAX_INVITES}>
              <Plus size={14} /> Add another
            </Button>
            <span className="text-xs text-ink-faint">
              {invites.length >= MAX_INVITES ? `You can invite up to ${MAX_INVITES} people here.` : `${filledInvites.length} of ${MAX_INVITES}`}
            </span>
          </div>
          <dl className="mt-7 grid gap-3 sm:grid-cols-3">
            {INVITE_ROLES.map((role) => (
              <div key={role} className="rounded-xl border border-white/[0.06] p-3.5">
                <dt className="text-sm font-medium text-ink">{ROLE_LABELS[role]}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-ink-muted">{ROLE_DESCRIPTIONS[role]}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Step 3: plan */}
        <section hidden={step !== 2} aria-labelledby="step-2-title">
          <StepHeading id="step-2-title" ref={step === 2 ? headingRef : undefined} icon={CreditCard} title="Choose how to start">
            No card needed for either option. You can change plans from Billing at any time.
          </StepHeading>
          <fieldset className="mt-7">
            <legend className="sr-only">Plan</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <PlanOption
                value="professional"
                checked={plan === "professional"}
                onChange={() => {
                  setPlan("professional");
                  touch("plan");
                }}
                title={`${TRIAL_DAYS}-day Professional trial`}
                price={`Free for ${TRIAL_DAYS} days, then ${formatMoney(PLANS.professional.price.month)}/month`}
                badge="Recommended"
                points={[
                  `${PLANS.professional.limits.projects} active projects`,
                  `${PLANS.professional.limits.clients} client portals`,
                  `${PLANS.professional.limits.seats} team seats`,
                  `${formatBytes(PLANS.professional.limits.storageBytes)} storage, audit log, milestone approvals`,
                ]}
              />
              <PlanOption
                value="starter"
                checked={plan === "starter"}
                onChange={() => {
                  setPlan("starter");
                  touch("plan");
                }}
                title="Starter"
                price="Free, no time limit"
                points={[
                  `${PLANS.starter.limits.projects} active projects`,
                  `${PLANS.starter.limits.clients} client portals`,
                  `${starterSeats} team seats, including you`,
                  `${formatBytes(PLANS.starter.limits.storageBytes)} private storage`,
                ]}
              />
            </div>
          </fieldset>
          {errorFor("plan") ? (
            <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-300">
              <AlertCircle size={15} className="mt-0.5 flex-none" aria-hidden="true" /> {errorFor("plan")}
            </p>
          ) : (
            plan === "starter" &&
            starterTooSmall && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100/90">
                <AlertCircle size={15} className="mt-0.5 flex-none text-amber-300" aria-hidden="true" />
                Starter includes {starterSeats} seats, so it fits you and {starterSeats - 1} teammate. You&apos;ve added {filledInvites.length}{" "}
                invitations: remove some, or start the trial.
              </p>
            )
          )}
          <div className="mt-7 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs font-medium text-ink-faint">Summary</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <SummaryRow label="Workspace" value={name.trim() || "Not set"} />
              <SummaryRow label="Address" value={slug ? `/w/${slug}` : "Not set"} mono />
              <SummaryRow label="Your role" value="Owner" />
              <SummaryRow
                label="Invitations"
                value={filledInvites.length === 0 ? "None for now" : `${filledInvites.length} pending`}
              />
            </dl>
          </div>
        </section>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          {step > 0 ? (
            <Button variant="outline" size="lg" onClick={goBack}>
              <ArrowLeft size={16} /> Back
            </Button>
          ) : (
            <span className="hidden text-xs text-ink-faint sm:block">Step 1 of 3</span>
          )}
          {step < 2 ? (
            <Button size="lg" onClick={() => void goNext()} disabled={advancing} aria-busy={advancing}>
              {advancing && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              {step === 1 && filledInvites.length === 0 ? "Skip for now" : "Continue"}
              {!advancing && <ArrowRight size={16} />}
            </Button>
          ) : (
            <SubmitButton size="lg" pendingLabel="Creating your workspace…">
              <Check size={16} /> {plan === "professional" ? "Create workspace and start trial" : "Create workspace"}
            </SubmitButton>
          )}
        </div>
      </form>
    </div>
  );
}

function Stepper({ step, onSelect }: { step: Step; onSelect: (step: Step) => void }) {
  return (
    <nav aria-label="Setup progress" className="border-b border-line bg-white/[0.015] px-5 py-4 sm:px-8">
      <ol className="flex items-center gap-2 sm:gap-4">
        {STEPS.map((item, index) => {
          const done = index < step;
          const current = index === step;
          const content = (
            <>
              <span
                className={cn(
                  "grid h-8 w-8 flex-none place-items-center rounded-full border text-xs font-semibold transition",
                  current && "border-cyan-300 bg-cyan-400 text-on-brand shadow-[0_0_18px_rgba(34,211,238,.45)]",
                  done && "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
                  !current && !done && "border-line-strong text-ink-faint",
                )}
              >
                {done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : index + 1}
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className={cn("block text-sm font-medium", current ? "text-ink" : done ? "text-ink-secondary" : "text-ink-faint")}>
                  {item.title}
                </span>
                <span className="hidden text-xs text-ink-faint md:block">{item.hint}</span>
              </span>
              <span className="sr-only">{done ? "(completed)" : current ? "(current step)" : ""}</span>
            </>
          );
          return (
            <li key={item.title} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4" aria-current={current ? "step" : undefined}>
              {done ? (
                <button type="button" onClick={() => onSelect(index as Step)} className="flex min-w-0 items-center gap-3 rounded-lg hover:opacity-90">
                  {content}
                </button>
              ) : (
                <div className="flex min-w-0 items-center gap-3">{content}</div>
              )}
              {index < STEPS.length - 1 && (
                <span className={cn("h-px min-w-4 flex-1", index < step ? "bg-cyan-400/50" : "bg-line-strong")} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-ink-secondary sm:hidden" aria-hidden="true">
        Step {step + 1} of {STEPS.length}: <span className="font-medium text-ink">{STEPS[step].title}</span>
      </p>
    </nav>
  );
}

function StepHeading({
  id,
  ref,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  ref?: React.Ref<HTMLHeadingElement>;
  icon: typeof Building2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="hidden h-11 w-11 flex-none place-items-center rounded-xl bg-cyan-500/10 text-cyan-300 sm:grid">
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 id={id} ref={ref} tabIndex={-1} className="text-xl font-semibold text-ink focus:outline-none">
          {title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{children}</p>
      </div>
    </div>
  );
}

function SlugMessage({ id, status, slug, error }: { id: string; status: SlugStatus; slug: string; error?: string }) {
  let tone = "text-ink-faint";
  let text: React.ReactNode = "Lowercase letters, numbers and hyphens, 3 to 32 characters.";
  if (error && !(status.state === "available" && status.slug === slug)) {
    tone = "text-red-300";
    text = error;
  } else if (status.state === "checking") {
    text = "Checking availability…";
  } else if (status.state === "available" && status.slug === slug) {
    tone = "text-emerald-300";
    text = status.message;
  } else if ((status.state === "taken" || status.state === "invalid") && status.slug === slug) {
    tone = "text-red-300";
    text = status.message;
  }
  return (
    <p id={id} className={cn("flex items-center gap-1.5 text-xs", tone)} aria-live="polite">
      {tone === "text-red-300" && <AlertCircle size={13} className="flex-none" aria-hidden="true" />}
      {tone === "text-emerald-300" && <CheckCircle2 size={13} className="flex-none" aria-hidden="true" />}
      {text}
    </p>
  );
}

function PlanOption({
  value,
  checked,
  onChange,
  title,
  price,
  badge,
  points,
}: {
  value: PlanChoice;
  checked: boolean;
  onChange: () => void;
  title: string;
  price: string;
  badge?: string;
  points: string[];
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col rounded-2xl border p-5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-400/60",
        checked
          ? "border-cyan-400/60 bg-gradient-to-b from-cyan-500/[0.12] to-transparent shadow-[0_0_30px_rgba(34,211,238,.12)]"
          : "border-line-strong bg-white/[0.015] hover:border-white/20",
      )}
    >
      <input type="radio" name="plan" value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block font-semibold text-ink">{title}</span>
          <span className="mt-1 block text-sm text-ink-muted">{price}</span>
        </span>
        <span
          className={cn(
            "grid h-5 w-5 flex-none place-items-center rounded-full border transition",
            checked ? "border-cyan-300 bg-cyan-400 text-on-brand" : "border-line-strong",
          )}
          aria-hidden="true"
        >
          {checked && <Check size={12} strokeWidth={3} />}
        </span>
      </span>
      {badge && (
        <span className="absolute -top-2.5 right-12 rounded-full border border-cyan-300/40 bg-[#0b1f2c] px-2.5 py-0.5 text-[11px] font-medium text-cyan-200">
          {badge}
        </span>
      )}
      <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-ink-secondary">
            <Check size={15} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
    </label>
  );
}

function SummaryRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 justify-between gap-4 sm:block">
      <dt className="text-ink-faint">{label}</dt>
      <dd className={cn("truncate text-ink-secondary", mono && "font-mono text-[13px]")}>{value}</dd>
    </div>
  );
}
