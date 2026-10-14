"use client";

import * as React from "react";
import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/result";
import type { Priority, TaskStatus } from "@/lib/data/types";
import type { UserLite } from "@/lib/data/views";
import { PRIORITY, PRIORITY_ORDER, TASK_STATUS, TASK_STATUS_ORDER } from "@/lib/domain/labels";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

export interface TaskFormDefaults {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueAt?: string;
  assigneeUserId?: string;
  milestoneId?: string;
  clientVisible?: boolean;
}

export function TaskForm({
  action,
  members,
  milestones,
  defaults = {},
  submitLabel,
  onDone,
  projectShared,
  footer,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  members: UserLite[];
  milestones: { id: string; title: string }[];
  defaults?: TaskFormDefaults;
  submitLabel: string;
  onDone?: () => void;
  projectShared: boolean;
  footer?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  const values = state?.values;

  React.useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state && !state.ok && <FormMessage>{state.message}</FormMessage>}
      <Field label="Title" htmlFor="task-title" error={errors.title} required>
        <Input id="task-title" name="title" defaultValue={values?.title ?? defaults.title} maxLength={140} placeholder="What needs to happen?" autoFocus required />
      </Field>
      <Field label="Details" htmlFor="task-description" error={errors.description}>
        <Textarea id="task-description" name="description" rows={3} defaultValue={values?.description ?? defaults.description} placeholder="Context, links, acceptance criteria…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="task-status">
          <Select id="task-status" name="status" defaultValue={values?.status ?? defaults.status ?? "todo"}>
            {TASK_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS[status].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <Select id="task-priority" name="priority" defaultValue={values?.priority ?? defaults.priority ?? "medium"}>
            {PRIORITY_ORDER.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY[priority].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assignee" htmlFor="task-assignee" error={errors.assigneeId}>
          <Select id="task-assignee" name="assigneeId" defaultValue={values?.assigneeId ?? defaults.assigneeUserId ?? ""}>
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" htmlFor="task-due" error={errors.dueAt}>
          <Input id="task-due" name="dueAt" type="date" defaultValue={values?.dueAt ?? defaults.dueAt?.slice(0, 10) ?? ""} />
        </Field>
        <Field label="Milestone" htmlFor="task-milestone" error={errors.milestoneId} className="sm:col-span-2">
          <Select id="task-milestone" name="milestoneId" defaultValue={values?.milestoneId ?? defaults.milestoneId ?? ""}>
            <option value="">No milestone</option>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] p-3.5">
        <Checkbox name="clientVisible" defaultChecked={defaults.clientVisible ?? true} className="mt-0.5" />
        <span>
          <span className="block text-sm text-ink">Visible to the client</span>
          <span className="block text-xs text-ink-faint">
            {projectShared
              ? "Client users will see this task and its status on their portal."
              : "The project isn't shared yet, so clients won't see anything until it is."}
          </span>
        </span>
      </label>
      <div className="flex flex-col-reverse gap-2.5 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
        {footer}
        <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
