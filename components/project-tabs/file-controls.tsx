"use client";

import * as React from "react";
import { useActionState } from "react";
import { Eye, Lock, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn, formatBytes } from "@/lib/utils";
import { deleteProjectFile, uploadProjectFile } from "@/lib/actions/files";
import type { ActionState } from "@/lib/actions/result";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";
import { FilePicker } from "@/components/files/file-picker";

/** "Upload file" dialog: file metadata, who can see it, and the plan's remaining storage. */
export function UploadFileButton({
  orgSlug,
  projectId,
  hasClient,
  sharedWithClient,
  storage,
}: {
  orgSlug: string;
  projectId: string;
  hasClient: boolean;
  sharedWithClient: boolean;
  storage: { used: number; limit: number; planName: string };
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
        <Button>
          <Upload size={16} /> Upload file
        </Button>
      </DialogTrigger>
      <DialogContent title="Upload a file" description="Briefs, contracts, raw assets: anything that isn't a deliverable for review." size="lg">
        <UploadForm
          key={formKey}
          orgSlug={orgSlug}
          projectId={projectId}
          hasClient={hasClient}
          sharedWithClient={sharedWithClient}
          storage={storage}
          onDone={(message) => {
            setOpen(false);
            toast.success(message ?? "File uploaded.");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function UploadForm({
  orgSlug,
  projectId,
  hasClient,
  sharedWithClient,
  storage,
  onDone,
}: {
  orgSlug: string;
  projectId: string;
  hasClient: boolean;
  sharedWithClient: boolean;
  storage: { used: number; limit: number; planName: string };
  onDone: (message?: string) => void;
}) {
  const [state, action] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await uploadProjectFile(orgSlug, projectId, previous, formData);
    if (result?.ok) onDone(result.message);
    return result;
  }, null);
  const [visibility, setVisibility] = React.useState<"internal" | "client">(
    (state?.values?.visibility as "internal" | "client" | undefined) ?? "internal",
  );
  const [uploading, setUploading] = React.useState(false);
  const errors = state?.fieldErrors ?? {};
  const remaining = Math.max(storage.limit - storage.used, 0);

  const options = [
    { value: "internal" as const, label: "Internal", hint: "Only your team", icon: Lock, disabled: false },
    {
      value: "client" as const,
      label: "Visible to client",
      hint: !hasClient ? "Internal project" : sharedWithClient ? "Shows on their portal" : "Once the project is shared",
      icon: Eye,
      disabled: !hasClient,
    },
  ];

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.message}</FormMessage>}
      <FilePicker
        orgSlug={orgSlug}
        target={{ kind: "file", projectId }}
        error={errors.fileName?.[0] ?? errors.sizeBytes?.[0]}
        onBusyChange={setUploading}
      />
      <p className="-mt-2 text-xs text-ink-faint">
        {formatBytes(remaining)} of {formatBytes(storage.limit)} left on your {storage.planName} plan.
      </p>
      <fieldset>
        <legend className="text-sm font-medium text-ink-secondary">Who can see it?</legend>
        <input type="hidden" name="visibility" value={visibility} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Who can see this file">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={visibility === option.value}
              disabled={option.disabled}
              onClick={() => setVisibility(option.value)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                visibility === option.value
                  ? option.value === "internal"
                    ? "border-amber-400/40 bg-amber-500/[0.07]"
                    : "border-cyan-400/50 bg-cyan-500/[0.08]"
                  : "border-line bg-white/[0.02] hover:border-line-strong",
              )}
            >
              <option.icon size={17} className={option.value === "internal" ? "text-amber-300" : "text-cyan-300"} aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium text-ink">{option.label}</span>
                <span className="block text-xs text-ink-faint">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
        {errors.visibility && (
          <p className="mt-2 text-xs text-red-300" role="alert">
            {errors.visibility[0]}
          </p>
        )}
      </fieldset>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <SubmitButton pendingLabel="Saving…" disabled={uploading}>
          <Upload size={16} /> {uploading ? "Uploading…" : "Save file"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

export function DeleteFileButton({ orgSlug, fileId, name }: { orgSlug: string; fileId: string; name: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`Delete ${name}`}
      title="Delete file"
      className="text-ink-faint hover:bg-red-500/10 hover:text-red-300"
      onClick={() => {
        if (!window.confirm(`Delete ${name}? It's removed for your team and the client. This can't be undone.`)) return;
        startTransition(async () => {
          const result = await deleteProjectFile(orgSlug, fileId);
          if (result?.ok) toast.success(result.message);
          else toast.error(result?.message ?? "Couldn't delete the file.");
        });
      }}
    >
      <Trash2 size={15} />
    </Button>
  );
}
