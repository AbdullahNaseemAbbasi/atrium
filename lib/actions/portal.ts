"use server";

import { refresh } from "next/cache";
import { requireClientContext } from "@/lib/auth/context";
import { applyClientDecision } from "@/lib/data/client-review";
import { getDb, saveDb } from "@/lib/data/store";
import { decisionSchema } from "@/lib/validation/schemas";
import { fail, formValues, invalid, ok, type ActionState } from "./result";

/**
 * A client approver approves a version or asks for changes. Tenant, role,
 * version and state are re-checked in `applyClientDecision`; this wrapper
 * only validates input and turns the outcome into form feedback.
 */
export async function decideOnDeliverable(orgSlug: string, deliverableId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireClientContext(orgSlug);
  const parsed = decisionSchema.safeParse({
    decision: formData.get("decision"),
    version: formData.get("version"),
    comment: formData.get("comment") ?? undefined,
  });
  if (!parsed.success) return invalid(parsed.error, formValues(formData));

  const outcome = applyClientDecision((await getDb()), ctx, deliverableId, parsed.data);
  switch (outcome.kind) {
    case "not_found":
      return fail("This deliverable is no longer available.");
    case "not_allowed":
      return fail(outcome.message);
    case "stale":
      await saveDb();
      refresh();
      return fail(
        `${ctx.org.name} uploaded version ${outcome.currentVersion} after you opened this page. We've loaded it. Take a look before you decide.`,
      );
    case "existing":
      await saveDb();
      refresh();
      return ok(
        outcome.approval.decision === "approved"
          ? `You already approved version ${outcome.approval.version}.`
          : `You already requested changes on version ${outcome.approval.version}.`,
      );
    case "decided": {
      await saveDb();
      refresh();
      const approved = outcome.approval.decision === "approved";
      const milestoneNote = outcome.milestone?.to === "completed" ? ` That completes the milestone "${outcome.milestone.title}".` : "";
      await saveDb();
      return ok(
        approved
          ? `Version ${outcome.approval.version} approved. ${ctx.org.name} has been notified.${milestoneNote}`
          : `Changes requested. ${ctx.org.name} will send a new version.`,
      );
    }
  }
}
