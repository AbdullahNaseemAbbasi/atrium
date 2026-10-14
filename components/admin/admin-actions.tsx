"use client";

import * as React from "react";
import { Eye, LoaderCircle, Repeat, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { openSupportView, replayWebhookEvent, resetDemoData, type SupportView } from "@/lib/actions/admin";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ConfirmSubmit } from "@/components/ui/interactive";
import { DetailList, FormNote } from "@/components/ui/misc";

export function ResetDemoButton() {
  return (
    <form action={resetDemoData}>
      <ConfirmSubmit
        variant="danger"
        message="Reset all demo data? Every workspace goes back to the original seed. Changes made by anyone using the demo are lost."
      >
        <RotateCcw size={16} /> Reset demo data
      </ConfirmSubmit>
    </form>
  );
}

const ROLE_NAMES: Record<string, [string, string]> = {
  owner: ["owner", "owners"],
  manager: ["manager", "managers"],
  member: ["member", "members"],
  billing: ["billing manager", "billing managers"],
};

/** Opens metadata-only support view. Every opening is written to the workspace's own audit log. */
export function SupportViewButton({ organizationId, name }: { organizationId: string; name: string }) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<SupportView["workspace"] | null>(null);
  const [pending, startTransition] = React.useTransition();

  const load = () => {
    startTransition(async () => {
      const result = await openSupportView(organizationId);
      if (result.ok) {
        setView(result.workspace);
        setOpen(true);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      <Button variant="outline" size="xs" onClick={load} disabled={pending} aria-label={`Open support view for ${name}`}>
        {pending ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />} Support view
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {view && (
          <DialogContent title={`Support view · ${view.name}`} description="Metadata only. Project names, files and messages are never shown to operators." size="md">
            <FormNote icon={ShieldAlert} tone="warning">
              This opening was recorded in {view.name}&apos;s audit log with your name and IP address.
            </FormNote>
            <DetailList
              className="mt-4"
              items={[
                { label: "Workspace URL", value: `/w/${view.slug}` },
                { label: "Created", value: formatDate(view.createdAt) },
                { label: "Timezone", value: view.timezone },
                { label: "Plan", value: `${view.plan} · ${view.subscriptionStatus.replace("_", " ")}` },
                { label: "Owner", value: view.owner ? `${view.owner.name} (${view.owner.email})` : "No owner" },
                { label: "Team", value: view.members.map((item) => `${item.count} ${ROLE_NAMES[item.role]?.[item.count === 1 ? 0 : 1] ?? item.role}`).join(", ") },
                ...view.counts.map((item) => ({ label: item.label, value: item.value })),
                { label: "Last activity", value: view.lastActivityAt ? formatDateTime(view.lastActivityAt) : "None" },
              ]}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

export function ReplayEventButton({ providerEventId }: { providerEventId: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await replayWebhookEvent(providerEventId);
          if (result?.ok) toast.success(result.message);
          else toast.error(result?.message ?? "Replay failed.");
        })
      }
    >
      <Repeat size={14} /> {pending ? "Replaying…" : "Replay last event"}
    </Button>
  );
}
