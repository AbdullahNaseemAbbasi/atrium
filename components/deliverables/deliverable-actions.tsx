"use client";

import * as React from "react";
import { useActionState } from "react";
import { FileUp, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { createDeliverable, submitForReview, uploadNewVersion } from "@/lib/actions/deliverables";
import type { ActionState } from "@/lib/actions/result";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";
import { FilePicker } from "@/components/files/file-picker";

/** "Upload deliverable" dialog: title, milestone, description and the first file. */
export function NewDeliverableButton({
  orgSlug,
  projectId,
  milestones,
  variant = "primary",
}: {
  orgSlug: string;
  projectId: string;
  milestones: { id: string; title: string }[];
  variant?: "primary" | "secondary";
}) {
  const [state, action] = useActionState(createDeliverable.bind(null, orgSlug, projectId), null);
  const [uploading, setUploading] = React.useState(false);
  const errors = state?.fieldErrors ?? {};
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Upload size={16} /> Upload deliverable
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Upload a deliverable"
        description="It starts as a private draft. Your team can review it before you send it to the client."
        size="lg"
      >
        <form action={action} className="space-y-5" noValidate>
          {state && !state.ok && <FormMessage>{state.message}</FormMessage>}
          <Field label="Title" htmlFor="dlv-title" error={errors.title} required>
            <Input id="dlv-title" name="title" placeholder="e.g. Homepage mockup" defaultValue={state?.values?.title} maxLength={120} required />
          </Field>
          <Field label="Milestone" htmlFor="dlv-milestone" error={errors.milestoneId}>
            <Select id="dlv-milestone" name="milestoneId" defaultValue={state?.values?.milestoneId ?? ""}>
              <option value="">No milestone</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="dlv-description" hint="What should the client look at?">
            <Textarea id="dlv-description" name="description" rows={2} defaultValue={state?.values?.description} />
          </Field>
          <FilePicker
            orgSlug={orgSlug}
            target={{ kind: "deliverable", projectId }}
            error={errors.fileName?.[0] ?? errors.sizeBytes?.[0]}
            onBusyChange={setUploading}
          />
          <Field label="Version note" htmlFor="dlv-note" hint="Optional. Shown next to version 1.">
            <Input id="dlv-note" name="note" placeholder="First draft for internal review" defaultValue={state?.values?.note} />
          </Field>
          <div className="flex justify-end border-t border-line pt-5">
            <SubmitButton pendingLabel="Saving…" disabled={uploading}>
              <FileUp size={16} /> {uploading ? "Uploading…" : "Save draft"}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewVersionButton({ orgSlug, deliverableId, nextVersion }: { orgSlug: string; deliverableId: string; nextVersion: number }) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await uploadNewVersion(orgSlug, deliverableId, previous, formData);
    if (result?.ok) {
      setOpen(false);
      toast.success(result.message ?? "New version uploaded");
    }
    return result;
  }, null);
  const [uploading, setUploading] = React.useState(false);
  const errors = state?.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Upload size={16} /> Upload v{nextVersion}
        </Button>
      </DialogTrigger>
      <DialogContent title={`Upload version ${nextVersion}`} description="Earlier versions and their decisions stay in the history.">
        <form action={action} className="space-y-5" noValidate>
          {state && !state.ok && <FormMessage>{state.message}</FormMessage>}
          <FilePicker
            orgSlug={orgSlug}
            target={{ kind: "version", deliverableId }}
            error={errors.fileName?.[0] ?? errors.sizeBytes?.[0]}
            onBusyChange={setUploading}
          />
          <Field label="What changed?" htmlFor="ver-note" hint="Clients see this note when they review.">
            <Textarea id="ver-note" name="note" rows={3} placeholder="Shortened the headline and updated the CTA, as requested." />
          </Field>
          <div className="flex justify-end border-t border-line pt-5">
            <SubmitButton pendingLabel="Saving…" disabled={uploading}>
              {uploading ? "Uploading…" : "Save version"}
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SubmitForReviewButton({ orgSlug, deliverableId, clientName }: { orgSlug: string; deliverableId: string; clientName: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Send this version to ${clientName} for review? They'll be notified.`)) return;
        startTransition(async () => {
          const result = await submitForReview(orgSlug, deliverableId);
          if (result?.ok) toast.success(result.message);
          else toast.error(result?.message ?? "Couldn't submit.");
        });
      }}
    >
      <Send size={16} /> {pending ? "Sending…" : "Send to client"}
    </Button>
  );
}
