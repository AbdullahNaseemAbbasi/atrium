import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CLIENT_STATUS,
  DELIVERABLE_STATUS,
  INVITATION_STATUS,
  INVOICE_STATUS,
  MILESTONE_STATUS,
  PRIORITY,
  PROJECT_STATUS,
  SUBSCRIPTION_STATUS,
  TASK_STATUS,
  type Tone,
} from "@/lib/domain/labels";
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

const TONES: Record<Tone, { badge: string; dot: string }> = {
  cyan: { badge: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300", dot: "bg-cyan-400" },
  blue: { badge: "border-blue-500/25 bg-blue-500/10 text-blue-300", dot: "bg-blue-400" },
  emerald: { badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  amber: { badge: "border-amber-500/25 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  red: { badge: "border-red-500/25 bg-red-500/10 text-red-300", dot: "bg-red-400" },
  slate: { badge: "border-slate-500/25 bg-slate-500/10 text-slate-300", dot: "bg-slate-400" },
  violet: { badge: "border-violet-500/25 bg-violet-500/10 text-violet-300", dot: "bg-violet-400" },
};

export function Badge({
  tone = "slate",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium",
        TONES[tone].badge,
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", TONES[tone].dot)} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function DeliverableStatusBadge({ status }: { status: DeliverableStatus }) {
  const meta = DELIVERABLE_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  const meta = MILESTONE_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY[priority];
  return (
    <Badge tone={meta.tone} className={priority === "urgent" ? "font-semibold" : undefined}>
      {meta.label}
    </Badge>
  );
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const meta = CLIENT_STATUS[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = INVOICE_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const meta = SUBSCRIPTION_STATUS[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  const meta = INVITATION_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
