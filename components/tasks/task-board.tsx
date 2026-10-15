"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "@/lib/actions/tasks";
import type { TaskStatus } from "@/lib/data/types";
import type { TaskRow } from "@/lib/data/views";
import { TASK_STATUS, TASK_STATUS_ORDER } from "@/lib/domain/labels";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/ui/badge";

export type BoardTask = TaskRow & { dueText: string };

/**
 * Kanban board. Cards can be dragged between columns (or moved with the
 * status menu for keyboard users); the move shows instantly and is confirmed
 * by the server action.
 */
export function TaskBoard({
  tasks,
  orgSlug,
  canWork,
  showProject = false,
}: {
  tasks: BoardTask[];
  orgSlug: string;
  canWork: boolean;
  /** Show the project name on each card (cross-project boards). */
  showProject?: boolean;
}) {
  const [optimistic, applyMove] = React.useOptimistic(tasks, (state, move: { id: string; status: TaskStatus }) =>
    state.map((task) => (task.id === move.id ? { ...task, status: move.status } : task)),
  );
  const [, startTransition] = React.useTransition();
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overColumn, setOverColumn] = React.useState<TaskStatus | null>(null);

  function move(id: string, status: TaskStatus) {
    const task = optimistic.find((item) => item.id === id);
    if (!task || task.status === status) return;
    startTransition(async () => {
      applyMove({ id, status });
      try {
        await setTaskStatus(orgSlug, id, status);
        if (status === "done") toast.success(`${task.title} marked as done`);
      } catch {
        toast.error("Couldn't move the task. Please try again.");
      }
    });
  }

  return (
    <div className="relative -mx-1 overflow-x-auto pb-2">
      <div className="grid min-w-[1100px] grid-cols-5 gap-3 px-1">
        {TASK_STATUS_ORDER.map((status) => {
          const column = optimistic.filter((task) => task.status === status);
          return (
            <section
              key={status}
              aria-label={`${TASK_STATUS[status].label} column`}
              onDragOver={(event) => {
                if (!canWork || !dragId) return;
                event.preventDefault();
                setOverColumn(status);
              }}
              onDragLeave={() => setOverColumn((value) => (value === status ? null : value))}
              onDrop={(event) => {
                event.preventDefault();
                if (dragId) move(dragId, status);
                setDragId(null);
                setOverColumn(null);
              }}
              className={cn(
                "flex min-h-[420px] flex-col rounded-2xl border bg-surface-sunken/60 p-2.5 transition",
                overColumn === status ? "border-cyan-400/50 bg-cyan-500/[0.04]" : "border-line",
              )}
            >
              <header className="flex items-center justify-between px-1.5 pb-3 pt-1">
                <h3 className="text-sm font-medium text-ink-secondary">{TASK_STATUS[status].label}</h3>
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] tabular-nums text-ink-faint">{column.length}</span>
              </header>
              <ul className="flex flex-1 flex-col gap-2.5">
                {column.map((task) => (
                  <li key={task.id}>
                    <TaskCard
                      task={task}
                      showProject={showProject}
                      draggable={canWork}
                      dragging={dragId === task.id}
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverColumn(null);
                      }}
                      onMove={canWork ? (next) => move(task.id, next) : undefined}
                    />
                  </li>
                ))}
                {column.length === 0 && (
                  <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-line px-3 py-8 text-center text-xs text-ink-faint">
                    {canWork ? "Drop tasks here" : "No tasks"}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  showProject,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  task: BoardTask;
  showProject: boolean;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove?: (status: TaskStatus) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = new URLSearchParams(searchParams.toString());
  next.set("task", task.id);

  return (
    <article
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-xl border border-white/[0.07] bg-surface p-3 shadow-[0_6px_20px_rgba(0,0,0,0.25)] transition hover:border-cyan-400/25",
        draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`${pathname}?${next}`} scroll={false} className="text-sm font-medium leading-snug text-ink hover:text-cyan-200">
          {task.title}
        </Link>
        {!task.clientVisible && (
          <span title="Internal: hidden from client" className="mt-0.5 text-amber-300/80">
            <Lock size={13} aria-label="Internal task" />
          </span>
        )}
      </div>
      {(showProject || task.milestone) && (
        <p className="mt-1 truncate text-[11px] text-ink-faint">
          {[showProject ? task.project.name : null, task.milestone?.title].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {task.dueAt && (
          <span className={cn("inline-flex items-center gap-1 text-[11px]", task.overdue ? "text-red-300" : "text-ink-muted")}>
            <CalendarDays size={12} aria-hidden="true" />
            {task.dueText}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-ink-faint">
          {task.assignee ? <Avatar user={task.assignee} size="xs" /> : <span className="h-6 w-6 rounded-full border border-dashed border-line-strong" aria-label="Unassigned" />}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={12} aria-hidden="true" /> {task.commentCount}
            </span>
          )}
        </div>
        {onMove && (
          <label className="relative">
            <span className="sr-only">Move {task.title}</span>
            <select
              value={task.status}
              onChange={(event) => onMove(event.target.value as TaskStatus)}
              className="h-7 cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent px-2 text-[11px] text-ink-faint outline-none transition hover:border-line-strong hover:text-ink-secondary focus:border-cyan-400/50 [&>option]:bg-surface-raised"
            >
              {TASK_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {status === task.status ? TASK_STATUS[status].label : `Move to ${TASK_STATUS[status].label}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </article>
  );
}
