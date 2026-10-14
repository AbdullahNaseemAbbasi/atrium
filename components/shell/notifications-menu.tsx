"use client";

import * as React from "react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { Bell, CheckCheck, FileCheck2, FileWarning, MessageSquare, Receipt, SquareCheckBig, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { NotificationItem } from "@/lib/data/queries/shell";

const ICONS: Partial<Record<NotificationItem["type"], typeof Bell>> = {
  "deliverable.submitted": FileCheck2,
  "deliverable.approved": FileCheck2,
  "deliverable.changes_requested": FileWarning,
  "comment.posted": MessageSquare,
  "comment.mention": MessageSquare,
  "task.assigned": SquareCheckBig,
  "task.due_soon": SquareCheckBig,
  "invitation.accepted": UserPlus,
  "billing.invoice_paid": Receipt,
  "billing.payment_failed": Receipt,
};

export function NotificationsMenu({
  orgSlug,
  unread,
  items,
  viewAllHref,
}: {
  orgSlug: string;
  unread: number;
  items: NotificationItem[];
  viewAllHref: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-muted transition hover:bg-white/5 hover:text-ink"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow-[0_0_10px_rgba(239,68,68,.6)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          className="z-[70] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0c1823]/98 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-pop-in"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="font-semibold text-ink">Notifications</p>
              <p className="text-xs text-ink-faint">{unread > 0 ? `${unread} unread` : "You're all caught up"}</p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => markAllNotificationsRead(orgSlug))}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-cyan-300 transition hover:bg-cyan-500/10 disabled:opacity-50"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[400px] overflow-y-auto p-1.5">
            {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-muted">No notifications yet.</li>}
            {items.map((item) => {
              const Icon = ICONS[item.type] ?? Bell;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      setOpen(false);
                      if (item.unread) startTransition(() => markNotificationRead(orgSlug, item.id));
                    }}
                    className="flex gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.04]"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg",
                        item.type.includes("changes") || item.type.includes("failed")
                          ? "bg-red-500/10 text-red-300"
                          : "bg-cyan-500/10 text-cyan-300",
                      )}
                      aria-hidden="true"
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", item.unread ? "font-medium text-ink" : "text-ink-secondary")}>{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-faint">{item.body}</span>
                      <span className="mt-1 block text-[11px] text-ink-faint">{item.when}</span>
                    </span>
                    {item.unread && <span className="mt-2 h-2 w-2 flex-none rounded-full bg-cyan-400" aria-label="Unread" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line p-2">
            <Link
              href={viewAllHref}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-center text-sm text-cyan-300 transition hover:bg-cyan-500/10"
            >
              View all notifications
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
