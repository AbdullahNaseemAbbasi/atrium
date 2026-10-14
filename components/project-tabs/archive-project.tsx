"use client";

import * as React from "react";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { setProjectStatus } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

/** Danger zone: archiving sets the project to Cancelled. Nothing is deleted. */
export function ArchiveProjectButton({ orgSlug, projectId, name, clientName }: { orgSlug: string; projectId: string; name: string; clientName: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger" className="w-full sm:w-auto">
          <Archive size={16} /> Archive project
        </Button>
      </DialogTrigger>
      <DialogContent title={`Archive “${name}”?`} size="sm">
        <div className="space-y-3 text-sm text-ink-muted">
          <p>
            The status changes to <span className="text-ink-secondary">Cancelled</span> and the project leaves your active counts and plan limit.
          </p>
          <p>
            Nothing is deleted: tasks, files, versions and approvals stay.
            {clientName ? ` ${clientName} keeps read access to what was shared.` : ""} You can reopen it later by changing its status.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep project</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await setProjectStatus(orgSlug, projectId, "cancelled");
                  setOpen(false);
                  toast.success(`${name} archived.`);
                } catch {
                  toast.error("You can't archive this project.");
                }
              })
            }
          >
            <Archive size={16} /> {pending ? "Archiving…" : "Archive project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
