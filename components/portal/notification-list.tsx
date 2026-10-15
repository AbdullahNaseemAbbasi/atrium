"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, FileCheck2, FileWarning, Flag, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { NotificationType } from "@/lib/data/types";
import { Button } from "@/components/ui/button";

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  href: string;
  type: NotificationType;
  unread: boolean;
  when: string;
}

const ICONS: Partial<Record<NotificationType, typeof Bell>> = {
  "deliverable.submitted": FileCheck2,
  "deliverable.approved": FileCheck2,
  "deliverable.changes_requested": FileWarning,
  "comment.posted": MessageSquare,
  "comment.mention": MessageSquare,
  "milestone.completed": Flag,
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
          await markAllNotificationsRead(orgSlug);
          toast.success("All notifications marked as read");
        })
      }
    >
      <CheckCheck size={16} aria-hidden="true" /> {pending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}

/** Full notification list. Opening an unread item marks it read. */
export function NotificationList({ orgSlug, items }: { orgSlug: string; items: NotificationRow[] }) {
  const [, startTransition] = React.useTransition();
  return (
    <ul className="divide-y divide-white/[0.05]">
      {items.map((item) => {
        const Icon = ICONS[item.type] ?? Bell;
        const warn = item.type.includes("changes");
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              onClick={() => {
                if (item.unread) startTransition(() => markNotificationRead(orgSlug, item.id));
              }}
              className={cn("flex gap-4 px-4 py-4 transition hover:bg-white/[0.025] sm:px-5", item.unread && "bg-cyan-500/[0.03]")}
            >
              <span
                className={cn(
                  "grid h-10 w-10 flex-none place-items-center rounded-xl",
                  warn ? "bg-red-500/10 text-red-300" : "bg-cyan-500/10 text-cyan-300",
                )}
                aria-hidden="true"
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", item.unread ? "font-medium text-ink" : "text-ink-secondary")}>{item.title}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{item.body}</span>
                <span className="mt-1 block text-xs text-ink-faint">{item.when}</span>
              </span>
              {item.unread && (
                <span className="mt-2 flex-none">
                  <span className="block h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <span className="sr-only">Unread</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
