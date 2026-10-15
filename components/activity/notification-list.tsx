"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  CircleCheck,
  FileCheck2,
  FileWarning,
  LoaderCircle,
  MessageSquare,
  Receipt,
  SquareCheckBig,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { NotificationRow } from "@/lib/data/queries/notifications";
import type { Tone } from "@/lib/domain/labels";
import { IconBox } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const META: Record<NotificationRow["type"], { icon: LucideIcon; tone: Tone }> = {
  "deliverable.submitted": { icon: FileCheck2, tone: "cyan" },
  "deliverable.approved": { icon: CircleCheck, tone: "emerald" },
  "deliverable.changes_requested": { icon: FileWarning, tone: "red" },
  "comment.mention": { icon: MessageSquare, tone: "violet" },
  "comment.posted": { icon: MessageSquare, tone: "blue" },
  "task.assigned": { icon: SquareCheckBig, tone: "cyan" },
  "task.due_soon": { icon: SquareCheckBig, tone: "amber" },
  "milestone.completed": { icon: CircleCheck, tone: "emerald" },
  "invitation.accepted": { icon: UserPlus, tone: "cyan" },
  "billing.payment_failed": { icon: Receipt, tone: "red" },
  "billing.invoice_paid": { icon: Receipt, tone: "emerald" },
};

export function MarkAllReadButton({ orgSlug, unread }: { orgSlug: string; unread: number }) {
  const [pending, startTransition] = React.useTransition();
  if (unread === 0) return null;
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await markAllNotificationsRead(orgSlug);
            toast.success(`Marked ${unread} ${unread === 1 ? "notification" : "notifications"} as read`);
          } catch {
            toast.error("Couldn't update notifications. Please try again.");
          }
        })
      }
    >
      {pending ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCheck size={16} />} Mark all as read
    </Button>
  );
}

export function NotificationItem({ orgSlug, item }: { orgSlug: string; item: NotificationRow }) {
  const [read, setRead] = React.useOptimistic(!item.unread, (_current, next: boolean) => next);
  const [pending, startTransition] = React.useTransition();
  const meta = META[item.type] ?? { icon: Bell, tone: "slate" as Tone };

  const markRead = () => {
    if (read) return;
    startTransition(async () => {
      setRead(true);
      try {
        await markNotificationRead(orgSlug, item.id);
      } catch {
        toast.error("Couldn't mark it as read.");
      }
    });
  };

  return (
    <div className={cn("group relative flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.025]", !read && "bg-cyan-500/[0.035]")}>
      <IconBox icon={meta.icon} tone={meta.tone} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <Link
          href={item.href}
          onClick={markRead}
          className={cn(
            "block text-sm leading-snug after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-cyan-400/40",
            read ? "text-ink-secondary" : "font-medium text-ink",
          )}
        >
          {item.title}
        </Link>
        {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{item.body}</p>}
        <p className="mt-1 text-[11px] text-ink-faint" title={item.time}>
          {item.when}
        </p>
      </div>
      <div className="relative z-10 flex flex-none items-center gap-2 self-center">
        {!read ? (
          <>
            <span className="h-2 w-2 rounded-full bg-cyan-400" aria-label="Unread" />
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              onClick={markRead}
              aria-label={`Mark ${item.title} as read`}
              title="Mark as read"
              className="text-ink-faint hover:text-cyan-300"
            >
              <Check size={15} />
            </Button>
          </>
        ) : (
          <span className="sr-only">Read</span>
        )}
      </div>
    </div>
  );
}
