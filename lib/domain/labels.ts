import type {
  ClientStatus,
  DeliverableStatus,
  InvitationStatus,
  InvoiceStatus,
  MilestoneStatus,
  Priority,
  ProjectStatus,
  SubscriptionStatus,
  TaskStatus,
} from "@/lib/data/types";

export type Tone = "cyan" | "blue" | "emerald" | "amber" | "red" | "slate" | "violet";

interface StatusMeta {
  label: string;
  tone: Tone;
}

export const PROJECT_STATUS: Record<ProjectStatus, StatusMeta> = {
  planning: { label: "Planning", tone: "blue" },
  in_progress: { label: "In progress", tone: "cyan" },
  in_review: { label: "In review", tone: "violet" },
  on_hold: { label: "On hold", tone: "amber" },
  completed: { label: "Completed", tone: "emerald" },
  cancelled: { label: "Cancelled", tone: "slate" },
};

export const TASK_STATUS: Record<TaskStatus, StatusMeta> = {
  todo: { label: "To do", tone: "slate" },
  in_progress: { label: "In progress", tone: "cyan" },
  in_review: { label: "In review", tone: "violet" },
  blocked: { label: "Blocked", tone: "red" },
  done: { label: "Done", tone: "emerald" },
};

export const TASK_STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "in_review", "blocked", "done"];

export const DELIVERABLE_STATUS: Record<DeliverableStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "slate" },
  in_review: { label: "In review", tone: "amber" },
  changes_requested: { label: "Changes requested", tone: "red" },
  approved: { label: "Approved", tone: "emerald" },
};

export const MILESTONE_STATUS: Record<MilestoneStatus, StatusMeta> = {
  upcoming: { label: "Upcoming", tone: "slate" },
  in_progress: { label: "In progress", tone: "cyan" },
  awaiting_approval: { label: "Awaiting approval", tone: "amber" },
  completed: { label: "Completed", tone: "emerald" },
};

export const PRIORITY: Record<Priority, StatusMeta> = {
  low: { label: "Low", tone: "emerald" },
  medium: { label: "Medium", tone: "amber" },
  high: { label: "High", tone: "red" },
  urgent: { label: "Urgent", tone: "red" },
};

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "medium", "low"];

export const CLIENT_STATUS: Record<ClientStatus, StatusMeta> = {
  active: { label: "Active", tone: "emerald" },
  onboarding: { label: "Onboarding", tone: "blue" },
  paused: { label: "Paused", tone: "amber" },
  archived: { label: "Archived", tone: "slate" },
};

export const INVOICE_STATUS: Record<InvoiceStatus, StatusMeta> = {
  paid: { label: "Paid", tone: "emerald" },
  open: { label: "Open", tone: "amber" },
  void: { label: "Void", tone: "slate" },
  uncollectible: { label: "Uncollectible", tone: "red" },
};

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, StatusMeta> = {
  trialing: { label: "Trial", tone: "blue" },
  active: { label: "Active", tone: "emerald" },
  past_due: { label: "Past due", tone: "red" },
  canceled: { label: "Canceled", tone: "slate" },
  incomplete: { label: "Incomplete", tone: "amber" },
};

export const INVITATION_STATUS: Record<InvitationStatus, StatusMeta> = {
  pending: { label: "Pending", tone: "amber" },
  accepted: { label: "Accepted", tone: "emerald" },
  expired: { label: "Expired", tone: "slate" },
  revoked: { label: "Revoked", tone: "red" },
};
