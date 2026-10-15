import { isProjectActive } from "@/lib/domain/rules";
import { formatBytes } from "@/lib/utils";
import type { Database, ID } from "@/lib/data/types";
import type { LimitKey, Plan } from "./plans";

/**
 * What a workspace currently uses, measured the same way the limits are
 * enforced in actions:
 * - projects: projects in planning, in progress or in review
 * - clients: clients that are not archived (each has a portal)
 * - seats: active team memberships (owners, managers, members, billing)
 * - storage: every deliverable version plus every project file, in bytes
 */
export interface WorkspaceUsage {
  projects: number;
  clients: number;
  seats: number;
  storageBytes: number;
}

export function computeUsage(db: Database, organizationId: ID): WorkspaceUsage {
  return {
    projects: db.projects.filter((item) => item.organizationId === organizationId && isProjectActive(item)).length,
    clients: db.clients.filter((item) => item.organizationId === organizationId && item.status !== "archived").length,
    seats: db.memberships.filter((item) => item.organizationId === organizationId && item.status === "active").length,
    storageBytes:
      db.deliverableVersions.filter((item) => item.organizationId === organizationId).reduce((sum, item) => sum + item.sizeBytes, 0) +
      db.files.filter((item) => item.organizationId === organizationId).reduce((sum, item) => sum + item.sizeBytes, 0),
  };
}

export const LIMIT_LABELS: Record<LimitKey, { label: string; noun: string; plural: string }> = {
  projects: { label: "Active projects", noun: "active project", plural: "active projects" },
  clients: { label: "Client portals", noun: "client", plural: "clients" },
  seats: { label: "Team seats", noun: "seat", plural: "seats" },
  storageBytes: { label: "Storage", noun: "storage", plural: "storage" },
};

export type MeterLevel = "ok" | "warning" | "limit";

export interface UsageMeter {
  key: LimitKey;
  label: string;
  used: number;
  limit: number | null;
  /** 0 to 100, capped. Unlimited limits report 0. */
  percent: number;
  /** ok ≤ 80%, warning above 80%, limit at or over the cap. */
  level: MeterLevel;
  usedText: string;
  limitText: string;
}

/** Amber above 80% of the limit, red once the limit is reached. */
export function meterLevel(used: number, limit: number | null): MeterLevel {
  if (limit === null) return "ok";
  if (limit <= 0 || used >= limit) return "limit";
  return used / limit > 0.8 ? "warning" : "ok";
}

function amountText(key: LimitKey, value: number) {
  return key === "storageBytes" ? formatBytes(value) : value.toLocaleString("en-US");
}

export function usageMeters(plan: Plan, usage: WorkspaceUsage): UsageMeter[] {
  return (["projects", "clients", "seats", "storageBytes"] as LimitKey[]).map((key) => {
    const used = usage[key];
    const limit = plan.limits[key];
    return {
      key,
      label: LIMIT_LABELS[key].label,
      used,
      limit,
      percent: limit === null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100)),
      level: meterLevel(used, limit),
      usedText: amountText(key, used),
      limitText: limit === null ? "Unlimited" : amountText(key, limit),
    };
  });
}

export interface DowngradeBlocker {
  key: LimitKey;
  used: number;
  limit: number;
  message: string;
}

/**
 * A plan change is blocked when current usage is above any limit of the
 * target plan. Each blocker names the limit and what to do about it.
 */
export function downgradeBlockers(target: Plan, usage: WorkspaceUsage): DowngradeBlocker[] {
  const blockers: DowngradeBlocker[] = [];
  for (const key of ["projects", "clients", "seats", "storageBytes"] as LimitKey[]) {
    const limit = target.limits[key];
    const used = usage[key];
    if (limit === null || used <= limit) continue;
    const label = LIMIT_LABELS[key];
    let message: string;
    if (key === "storageBytes") {
      message = `You store ${formatBytes(used)}; ${target.name} includes ${formatBytes(limit)}. Delete ${formatBytes(used - limit)} of files first.`;
    } else {
      const over = used - limit;
      const action =
        key === "projects"
          ? `Complete, pause or cancel ${over} ${over === 1 ? "project" : "projects"} first.`
          : key === "clients"
            ? `Archive ${over} ${over === 1 ? "client" : "clients"} first.`
            : `Remove ${over} ${over === 1 ? "member" : "members"} first.`;
      message = `You have ${used} ${used === 1 ? label.noun : label.plural}; ${target.name} allows ${limit}. ${action}`;
    }
    blockers.push({ key, used, limit, message });
  }
  return blockers;
}
