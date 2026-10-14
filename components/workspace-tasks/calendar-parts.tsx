"use client";

import * as React from "react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS } from "@/lib/domain/labels";
import type { TaskStatus } from "@/lib/data/types";
import { Avatar } from "@/components/ui/avatar";
import type { CalendarTaskLink } from "./task-calendar";

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-cyan-400",
  in_review: "bg-violet-400",
  blocked: "bg-red-400",
  done: "bg-emerald-400",
};

/** One task on the calendar. Status is shown as a dot plus a text label for screen readers. */
export function CalendarTaskChip({ task, roomy = false, onOpen }: { task: CalendarTaskLink; roomy?: boolean; onOpen?: () => void }) {
  const done = task.status === "done";
  return (
    <Link
      href={task.href}
      scroll={false}
      onClick={onOpen}
      title={`${task.title} · ${task.projectName}`}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-md border text-left transition",
        roomy ? "px-3 py-2 text-sm" : "px-1.5 py-1 text-[11px] leading-tight",
        task.overdue
          ? "border-red-500/25 bg-red-500/[0.08] text-red-200 hover:border-red-400/50"
          : done
            ? "border-transparent bg-white/[0.02] text-ink-faint hover:text-ink-muted"
            : "border-white/[0.06] bg-white/[0.035] text-ink-secondary hover:border-cyan-400/30 hover:text-ink",
      )}
    >
      <span className={cn("h-1.5 w-1.5 flex-none rounded-full", STATUS_DOT[task.status])} aria-hidden="true" />
      <span className="sr-only">{TASK_STATUS[task.status].label}: </span>
      <span className={cn("min-w-0 flex-1 truncate", done && "line-through decoration-ink-faint/60")}>{task.title}</span>
      {roomy && <span className="hidden truncate text-xs text-ink-faint min-[400px]:inline">{task.projectName}</span>}
      {roomy && task.assignee && <Avatar user={task.assignee} size="xs" />}
      {task.overdue && <span className="sr-only"> (overdue)</span>}
    </Link>
  );
}

/** "+N more" overflow: opens the full list for that day. */
export function CalendarMore({ count, label, tasks }: { count: number; label: string; tasks: CalendarTaskLink[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="mt-1 w-full rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-cyan-300 transition hover:bg-cyan-500/10 focus-visible:bg-cyan-500/10"
        aria-label={`Show all ${tasks.length} tasks due ${label}`}
      >
        +{count} more
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[70] w-[300px] rounded-2xl border border-cyan-500/20 bg-[#0c1823]/98 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-pop-in"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-ink">{label}</p>
            <Popover.Close className="grid h-7 w-7 place-items-center rounded-lg text-ink-faint hover:bg-white/5 hover:text-ink" aria-label="Close">
              <X size={15} />
            </Popover.Close>
          </div>
          <ul className="max-h-[320px] space-y-1 overflow-y-auto">
            {tasks.map((task) => (
              <li key={task.id}>
                <CalendarTaskChip task={task} onOpen={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
