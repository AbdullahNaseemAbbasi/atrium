import { checkLimit, getPlan } from "@/lib/billing/plans";
import type { Database, ID } from "./types";

/**
 * Private storage used by a workspace: every deliverable version plus every
 * project file. Plan limits are checked against this in upload actions.
 */
export function storageUsage(db: Database, orgId: ID) {
  const used =
    db.deliverableVersions.filter((item) => item.organizationId === orgId).reduce((sum, item) => sum + item.sizeBytes, 0) +
    db.files.filter((item) => item.organizationId === orgId).reduce((sum, item) => sum + item.sizeBytes, 0);
  const subscription = db.subscriptions.find((item) => item.organizationId === orgId);
  const plan = getPlan(subscription?.planKey ?? "starter");
  return {
    used,
    limit: plan.limits.storageBytes,
    planName: plan.name,
    allows: (adding: number) => checkLimit(plan, "storageBytes", used, adding).allowed,
  };
}
