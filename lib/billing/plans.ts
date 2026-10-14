import type { BillingInterval, PlanKey } from "@/lib/data/types";

export interface PlanLimits {
  /** `null` means unlimited. */
  projects: number | null;
  clients: number | null;
  seats: number | null;
  storageBytes: number;
}

export interface Plan {
  key: PlanKey;
  name: string;
  tagline: string;
  /** Prices in cents. */
  price: Record<BillingInterval, number>;
  limits: PlanLimits;
  highlights: string[];
  recommended?: boolean;
}

const GB = 1024 ** 3;

/**
 * The trusted plan catalogue. Checkout maps a plan key to a provider price ID
 * on the server; the browser never sends a price.
 */
export const PLANS: Record<PlanKey, Plan> = {
  starter: {
    key: "starter",
    name: "Starter",
    tagline: "For freelancers sharing work with a few clients.",
    price: { month: 0, year: 0 },
    limits: { projects: 3, clients: 2, seats: 2, storageBytes: 2 * GB },
    highlights: ["3 active projects", "2 client portals", "2 team seats", "2 GB private storage", "Approval history"],
  },
  professional: {
    key: "professional",
    name: "Professional",
    tagline: "For growing studios running several client accounts.",
    price: { month: 4900, year: 47000 },
    limits: { projects: 25, clients: 15, seats: 10, storageBytes: 100 * GB },
    highlights: [
      "25 active projects",
      "15 client portals",
      "10 team seats",
      "100 GB private storage",
      "Milestone approval rules",
      "Audit log & CSV export",
    ],
    recommended: true,
  },
  agency: {
    key: "agency",
    name: "Agency",
    tagline: "For agencies with many clients and a larger team.",
    price: { month: 12900, year: 123800 },
    limits: { projects: null, clients: null, seats: 40, storageBytes: 1024 * GB },
    highlights: [
      "Unlimited projects",
      "Unlimited client portals",
      "40 team seats",
      "1 TB private storage",
      "Priority support",
      "Custom roles (coming soon)",
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ["starter", "professional", "agency"];

export function getPlan(key: PlanKey): Plan {
  return PLANS[key];
}

/** Monthly equivalent of a yearly price, in cents. */
export function monthlyEquivalent(plan: Plan, interval: BillingInterval) {
  return interval === "year" ? Math.round(plan.price.year / 12) : plan.price.month;
}

export type LimitKey = keyof PlanLimits;

export interface UsageCheck {
  key: LimitKey;
  used: number;
  limit: number | null;
  allowed: boolean;
  remaining: number | null;
}

/** Server-side plan enforcement: would adding `adding` more exceed the limit? */
export function checkLimit(plan: Plan, key: LimitKey, used: number, adding = 1): UsageCheck {
  const limit = plan.limits[key];
  if (limit === null) return { key, used, limit, allowed: true, remaining: null };
  return { key, used, limit, allowed: used + adding <= limit, remaining: Math.max(limit - used, 0) };
}
