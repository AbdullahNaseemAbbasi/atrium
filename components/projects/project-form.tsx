"use client";

import * as React from "react";
import { useActionState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/actions/result";
import type { ProjectIcon as ProjectIconName, ProjectStatus } from "@/lib/data/types";
import type { UserLite } from "@/lib/data/views";
import { PROJECT_STATUS } from "@/lib/domain/labels";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";
import { PROJECT_ICON_OPTIONS, ProjectIcon } from "./project-icon";

export interface ProjectFormDefaults {
  name?: string;
  description?: string;
  clientId?: string | null;
  status?: ProjectStatus;
  icon?: ProjectIconName;
  startAt?: string;
  dueAt?: string;
  leadId?: string;
  memberIds?: string[];
  sharedWithClient?: boolean;
  budget?: number;
}

function toDateInput(value?: string) {
  return value ? value.slice(0, 10) : "";
}

export function ProjectForm({
  action,
  clients,
  team,
  defaults,
  submitLabel,
  canShare = true,
  footer,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  clients: { id: string; name: string }[];
  team: UserLite[];
  defaults: ProjectFormDefaults;
  submitLabel: string;
  canShare?: boolean;
  footer?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const values = state?.values;
  const errors = state?.fieldErrors ?? {};
  const [icon, setIcon] = React.useState<ProjectIconName>((values?.icon as ProjectIconName) ?? defaults.icon ?? "layers");
  const [clientId, setClientId] = React.useState(values?.clientId ?? defaults.clientId ?? "");
  const [shared, setShared] = React.useState(defaults.sharedWithClient ?? false);
  const [leadId, setLeadId] = React.useState(values?.leadId ?? defaults.leadId ?? "");
  const [members, setMembers] = React.useState<Set<string>>(new Set(defaults.memberIds ?? []));

  const err = (key: string) => errors[key];

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {state?.message && <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>}

      <fieldset className="space-y-5">
        <legend className="mb-4 text-sm font-semibold text-ink">Basics</legend>
        <Field label="Project name" htmlFor="name" error={err("name")} required>
          <Input
            id="name"
            name="name"
            defaultValue={values?.name ?? defaults.name}
            placeholder="e.g. Website redesign"
            aria-invalid={Boolean(err("name"))}
            maxLength={80}
            required
          />
        </Field>
        <Field label="Description" htmlFor="description" error={err("description")} hint="What does done look like? Clients see this on their portal.">
          <Textarea id="description" name="description" defaultValue={values?.description ?? defaults.description} rows={3} maxLength={600} />
        </Field>
        <div>
          <p className="text-sm font-medium text-ink-secondary">Type</p>
          <input type="hidden" name="icon" value={icon} />
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Project type">
            {PROJECT_ICON_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={icon === option.value}
                onClick={() => setIcon(option.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-[11px] transition",
                  icon === option.value ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-200" : "border-line bg-white/[0.02] text-ink-muted hover:border-line-strong",
                )}
              >
                <ProjectIcon icon={option.value} size="sm" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm font-semibold text-ink">Client & schedule</legend>
        <Field label="Client" htmlFor="clientId" error={err("clientId")}>
          <Select id="clientId" name="clientId" value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">Internal project (no client)</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status" error={err("status")}>
          <Select id="status" name="status" defaultValue={values?.status ?? defaults.status ?? "planning"}>
            {(Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((status) => (
              <option key={status} value={status}>
                {PROJECT_STATUS[status].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start date" htmlFor="startAt" error={err("startAt")}>
          <Input id="startAt" name="startAt" type="date" defaultValue={values?.startAt ?? toDateInput(defaults.startAt)} />
        </Field>
        <Field label="Due date" htmlFor="dueAt" error={err("dueAt")}>
          <Input id="dueAt" name="dueAt" type="date" defaultValue={values?.dueAt ?? toDateInput(defaults.dueAt)} aria-invalid={Boolean(err("dueAt"))} />
        </Field>
        <Field label="Budget (USD)" htmlFor="budget" error={err("budget")} hint="Internal only. Never shown to the client.">
          <Input
            id="budget"
            name="budget"
            inputMode="decimal"
            placeholder="25,000"
            defaultValue={values?.budget ?? (defaults.budget !== undefined ? String(defaults.budget) : "")}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-4 text-sm font-semibold text-ink">Team</legend>
        <Field label="Project lead" htmlFor="leadId" error={err("leadId")} required hint="The lead can edit the project and send work to the client.">
          <Select id="leadId" name="leadId" value={leadId} onChange={(event) => setLeadId(event.target.value)} aria-invalid={Boolean(err("leadId"))}>
            <option value="" disabled>
              Choose a lead
            </option>
            {team.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
                {user.title ? ` · ${user.title}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <p className="text-sm font-medium text-ink-secondary">Contributors</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {team
              .filter((user) => user.id !== leadId)
              .map((user) => (
                <li key={user.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 transition hover:border-line-strong has-[:checked]:border-cyan-400/40 has-[:checked]:bg-cyan-500/[0.06]">
                    <Checkbox
                      name="memberIds"
                      value={user.id}
                      checked={members.has(user.id)}
                      onChange={(event) => {
                        const next = new Set(members);
                        if (event.target.checked) next.add(user.id);
                        else next.delete(user.id);
                        setMembers(next);
                      }}
                    />
                    <Avatar user={user} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{user.name}</span>
                      <span className="block truncate text-xs text-ink-faint">{user.title}</span>
                    </span>
                  </label>
                </li>
              ))}
          </ul>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-4 text-sm font-semibold text-ink">Client portal</legend>
        <label
          className={cn(
            "flex items-start gap-4 rounded-2xl border p-4 transition",
            shared ? "border-cyan-400/40 bg-cyan-500/[0.06]" : "border-line bg-white/[0.02]",
            (!clientId || !canShare) && "opacity-60",
          )}
        >
          <Checkbox
            name="sharedWithClient"
            checked={shared && Boolean(clientId)}
            disabled={!clientId || !canShare}
            onChange={(event) => setShared(event.target.checked)}
            className="mt-1"
          />
          {/* A disabled checkbox isn't submitted; keep the current sharing state for people who can't change it. */}
          {!canShare && shared && clientId && <input type="hidden" name="sharedWithClient" value="on" />}
          <span className="flex-1">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              {shared && clientId ? <Eye size={16} className="text-cyan-300" /> : <EyeOff size={16} className="text-ink-faint" />}
              Share this project with the client
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
              Client users see the description, client-visible tasks, milestone progress and submitted deliverables. Internal tasks, internal
              comments, drafts and the budget always stay private.
              {!clientId && " Choose a client first."}
              {!canShare && " Only owners and managers can change sharing."}
            </span>
          </span>
        </label>
        {err("sharedWithClient") && <p className="mt-2 text-xs text-red-300">{err("sharedWithClient")?.[0]}</p>}
      </fieldset>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-end">
        {footer}
        <SubmitButton size="lg" pendingLabel="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
