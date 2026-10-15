"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import { decideOnDeliverable } from "@/lib/actions/portal";
import type { ActionState } from "@/lib/actions/result";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormMessage, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/interactive";

interface DecisionProps {
  orgSlug: string;
  deliverableId: string;
  version: number;
  title: string;
  agencyName: string;
}

/**
 * Wraps the decision action: success closes the dialog with a toast; a
 * general failure (version changed, no longer in review) also closes it so
 * the refreshed page is visible; a missing comment stays inline.
 */
function useDecision({ orgSlug, deliverableId }: DecisionProps, onClose: () => void) {
  return useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await decideOnDeliverable(orgSlug, deliverableId, previous, formData);
    if (result?.ok) {
      onClose();
      toast.success(result.message ?? "Decision recorded.");
    } else if (result && !result.fieldErrors) {
      onClose();
      toast.error(result.message ?? "Couldn't record your decision.");
    }
    return result;
  }, null);
}

/** "Approve" and "Request changes": the two big calls to action on the review screen. */
export function DecisionButtons(props: DecisionProps) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      <ApproveDialog {...props} />
      <RequestChangesDialog {...props} />
    </div>
  );
}

function ApproveDialog(props: DecisionProps) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useDecision(props, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full">
          <Check size={18} aria-hidden="true" /> Approve v{props.version}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Approve ${props.title} v${props.version}?`}
        description={`${props.agencyName} is notified right away and can move on. If something needs to change later, they'll send a new version for review.`}
      >
        <form action={action} noValidate>
          <input type="hidden" name="decision" value="approved" />
          <input type="hidden" name="version" value={props.version} />
          {state && !state.ok && <FormMessage className="mb-4">{state.message}</FormMessage>}
          <Field label="Note for the team" htmlFor="approve-comment" hint="Optional. Shown next to your approval." error={state?.fieldErrors?.comment}>
            <Textarea id="approve-comment" name="comment" rows={3} maxLength={2000} placeholder="Looks great. Thanks, team." />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <SubmitButton pendingLabel="Approving…">
              <Check size={16} aria-hidden="true" /> Yes, approve v{props.version}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequestChangesDialog(props: DecisionProps) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useDecision(props, () => setOpen(false));
  const error = state?.fieldErrors?.comment;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" className="w-full">
          <MessageSquareWarning size={18} aria-hidden="true" /> Request changes
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Request changes to v${props.version}`}
        description={`Tell ${props.agencyName} what to change and where. They'll see this next to version ${props.version} and send a new version.`}
      >
        <form action={action} noValidate>
          <input type="hidden" name="decision" value="changes_requested" />
          <input type="hidden" name="version" value={props.version} />
          <Field label="What should change?" htmlFor="changes-comment" required error={error}>
            <Textarea
              id="changes-comment"
              name="comment"
              rows={5}
              maxLength={2000}
              defaultValue={state?.values?.comment}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "changes-comment-error" : undefined}
              placeholder="e.g. The headline is too long. Try something shorter and use 'Book a demo' on the main button."
              autoFocus
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <SubmitButton pendingLabel="Sending…">Send change request</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
