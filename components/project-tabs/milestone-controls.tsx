"use client";

import * as React from "react";
import { useActionState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Pencil, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { completeMilestone, createMilestone, moveMilestone, reopenMilestone, updateMilestone } from "@/lib/actions/milestones";
import type { ActionState } from "@/lib/actions/result";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton, Switch } from "@/components/ui/interactive";

export interface MilestoneDefaults {
  id: string;
  title: string;
  description: string;
  dueAt: string | null;
  approvalRequired: boolean;
}

/** Create (no `milestone`) or edit dialog. The form remounts on every open so it starts clean. */
export function MilestoneDialog({
  orgSlug,
  projectId,
  milestone,
  hasClient,
  variant = "primary",
}: {
  orgSlug: string;
  projectId: string;
  milestone?: MilestoneDefaults;
  hasClient: boolean;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((key) => key + 1);
      }}
    >
      <DialogTrigger asChild>
        {milestone ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${milestone.title}`} title="Edit milestone">
            <Pencil size={15} />
          </Button>
        ) : (
          <Button variant={variant}>
            <Plus size={16} /> New milestone
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={milestone ? `Edit “${milestone.title}”` : "New milestone"}
        description={milestone ? "Changes show on the client portal straight away." : "A phase of the project. Link tasks and deliverables to it afterwards."}
      >
        <MilestoneForm
          key={formKey}
          orgSlug={orgSlug}
          projectId={projectId}
          milestone={milestone}
          hasClient={hasClient}
          onDone={(message) => {
            setOpen(false);
            toast.success(message ?? "Milestone saved.");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function MilestoneForm({
  orgSlug,
  projectId,
  milestone,
  hasClient,
  onDone,
}: {
  orgSlug: string;
  projectId: string;
  milestone?: MilestoneDefaults;
  hasClient: boolean;
  onDone: (message?: string) => void;
}) {
  const [state, action] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = milestone
      ? await updateMilestone(orgSlug, milestone.id, previous, formData)
      : await createMilestone(orgSlug, projectId, previous, formData);
    if (result?.ok) onDone(result.message);
    return result;
  }, null);
  const errors = state?.fieldErrors ?? {};
  const values = state?.values;
  const id = milestone?.id ?? "new";

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && <FormMessage>{state.message}</FormMessage>}
      <Field label="Title" htmlFor={`ms-title-${id}`} error={errors.title} required>
        <Input
          id={`ms-title-${id}`}
          name="title"
          defaultValue={values?.title ?? milestone?.title}
          maxLength={100}
          placeholder="e.g. Visual design"
          aria-invalid={Boolean(errors.title)}
          autoFocus
          required
        />
      </Field>
      <Field label="Description" htmlFor={`ms-description-${id}`} error={errors.description} hint={hasClient ? "What's included? The client sees this." : "What's included?"}>
        <Textarea
          id={`ms-description-${id}`}
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={values?.description ?? milestone?.description}
          placeholder="Homepage, inner templates and the design system."
        />
      </Field>
      <Field label="Due date" htmlFor={`ms-due-${id}`} error={errors.dueAt}>
        <Input
          id={`ms-due-${id}`}
          name="dueAt"
          type="date"
          defaultValue={values?.dueAt ?? milestone?.dueAt?.slice(0, 10) ?? ""}
          aria-invalid={Boolean(errors.dueAt)}
          className="block sm:w-56"
        />
      </Field>
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-white/[0.02] p-4 has-[[data-state=checked]]:border-amber-400/35 has-[[data-state=checked]]:bg-amber-500/[0.05]">
        <label htmlFor={`ms-approval-${id}`} className="cursor-pointer">
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <ShieldCheck size={15} className="text-amber-300" aria-hidden="true" /> Requires client approval
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
            The milestone can only be completed once the client has approved every deliverable in it. When their last approval comes in,
            it completes automatically.
          </span>
        </label>
        <Switch
          id={`ms-approval-${id}`}
          name="approvalRequired"
          defaultChecked={values ? values.approvalRequired === "on" : (milestone?.approvalRequired ?? false)}
          className="mt-0.5"
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <SubmitButton pendingLabel="Saving…">{milestone ? "Save milestone" : "Add milestone"}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

function useMilestoneAction() {
  const [pending, startTransition] = React.useTransition();
  const run = (task: () => Promise<ActionState>) =>
    startTransition(async () => {
      const result = await task();
      if (result?.ok) toast.success(result.message ?? "Done");
      else toast.error(result?.message ?? "Something went wrong. Try again.");
    });
  return [pending, run] as const;
}

export function MoveMilestoneButtons({
  orgSlug,
  milestoneId,
  title,
  isFirst,
  isLast,
}: {
  orgSlug: string;
  milestoneId: string;
  title: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, run] = useMilestoneAction();
  return (
    <div className="flex items-center" role="group" aria-label={`Reorder ${title}`}>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending || isFirst}
        onClick={() => run(() => moveMilestone(orgSlug, milestoneId, "up"))}
        aria-label={`Move ${title} up`}
        title="Move up"
      >
        <ArrowUp size={15} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending || isLast}
        onClick={() => run(() => moveMilestone(orgSlug, milestoneId, "down"))}
        aria-label={`Move ${title} down`}
        title="Move down"
      >
        <ArrowDown size={15} />
      </Button>
    </div>
  );
}

/**
 * "Mark complete". While blockers exist the button is disabled and points at
 * the explanation rendered next to it; the server re-checks the same rule.
 */
export function CompleteMilestoneButton({
  orgSlug,
  milestoneId,
  title,
  blocked,
  describedBy,
  clientName,
}: {
  orgSlug: string;
  milestoneId: string;
  title: string;
  blocked: boolean;
  describedBy?: string;
  clientName: string | null;
}) {
  const [pending, run] = useMilestoneAction();
  return (
    <Button
      variant={blocked ? "outline" : "primary"}
      size="sm"
      disabled={pending || blocked}
      aria-describedby={describedBy}
      className={cn(blocked && "cursor-not-allowed")}
      onClick={() => {
        const who = clientName ? ` ${clientName} will see it as done.` : "";
        if (!window.confirm(`Mark “${title}” complete?${who}`)) return;
        run(() => completeMilestone(orgSlug, milestoneId));
      }}
    >
      <CheckCircle2 size={15} aria-hidden="true" /> {pending ? "Completing…" : "Mark complete"}
    </Button>
  );
}

export function ReopenMilestoneButton({ orgSlug, milestoneId, title }: { orgSlug: string; milestoneId: string; title: string }) {
  const [pending, run] = useMilestoneAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Reopen “${title}”? It goes back to In progress.`)) return;
        run(() => reopenMilestone(orgSlug, milestoneId));
      }}
    >
      <RotateCcw size={14} aria-hidden="true" /> Reopen
    </Button>
  );
}
