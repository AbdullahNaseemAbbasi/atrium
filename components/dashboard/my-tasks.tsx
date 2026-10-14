"use client";

import * as React from "react";
import Link from "next/link";
import { CheckSquare, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardHeader } from "@/components/ui/card";
import { PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { EmptyState, THead, Table, Td, Th, Tr } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import type { DashboardTask } from "@/lib/data/queries/dashboard";

const FILTERS = ["All", "Today", "Upcoming", "Overdue"] as const;
type Filter = (typeof FILTERS)[number];

export function MyTasksCard({
  tasks,
  base,
  defaultScope,
  canSeeEveryone,
}: {
  tasks: DashboardTask[];
  base: string;
  defaultScope: "mine" | "all";
  canSeeEveryone: boolean;
}) {
  const [filter, setFilter] = React.useState<Filter>("All");
  const [scope, setScope] = React.useState<"mine" | "all">(defaultScope);

  const scoped = scope === "mine" ? tasks.filter((task) => task.mine) : tasks;
  const counts: Record<Filter, number> = {
    All: scoped.length,
    Today: scoped.filter((task) => task.dueToday).length,
    Upcoming: scoped.filter((task) => !task.overdue && !task.dueToday && task.dueAt).length,
    Overdue: scoped.filter((task) => task.overdue).length,
  };
  const visible = scoped
    .filter((task) => {
      if (filter === "Today") return task.dueToday;
      if (filter === "Upcoming") return !task.overdue && !task.dueToday && Boolean(task.dueAt);
      if (filter === "Overdue") return task.overdue;
      return true;
    })
    .slice(0, 6);

  return (
    <div className="card flex min-w-0 flex-col">
      <CardHeader
        icon={CheckSquare}
        className="sm:flex-col sm:items-stretch 2xl:flex-row 2xl:items-center"
        title={scope === "mine" ? "My tasks" : "Team tasks"}
        description={scope === "mine" ? "Your assigned work and upcoming deadlines." : "Open work across every project you can see."}
        action={
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter tasks">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                aria-pressed={filter === item}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs transition",
                  filter === item
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,.2)]"
                    : "border-white/[0.08] bg-white/[0.02] text-ink-muted hover:text-ink",
                )}
              >
                {item}
                <span className="ml-1.5 tabular-nums text-ink-faint">{counts[item]}</span>
              </button>
            ))}
          </div>
        }
      />
      {canSeeEveryone && (
        <div className="-mt-2 flex gap-4 px-5 pb-3 text-xs" role="group" aria-label="Whose tasks">
          {(["mine", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              aria-pressed={scope === value}
              className={cn("transition", scope === value ? "text-cyan-300" : "text-ink-faint hover:text-ink-secondary")}
            >
              {value === "mine" ? "Assigned to me" : "Everyone"}
            </button>
          ))}
        </div>
      )}
      <div className="relative flex-1 overflow-x-auto px-4 pb-4 sm:px-5">
        {visible.length === 0 ? (
          <EmptyState
            compact
            icon={PartyPopper}
            title={filter === "Overdue" ? "Nothing overdue" : "No tasks here"}
            description={filter === "All" ? "New assignments will show up here." : "Try another filter."}
          />
        ) : (
          <Table className="min-w-[620px]">
            <THead>
              <Th className="px-2">Task</Th>
              <Th className="px-2">Project</Th>
              <Th className="px-2">Priority</Th>
              <Th className="px-2">Due</Th>
              <Th className="px-2">Status</Th>
            </THead>
            <tbody>
              {visible.map((task) => (
                <Tr key={task.id} className="text-xs">
                  <Td className="px-2 py-3">
                    <Link href={`${base}/projects/${task.projectId}/tasks?task=${task.id}`} className="font-medium text-ink hover:text-cyan-300">
                      {task.title}
                    </Link>
                    {scope === "all" && task.assigneeName && <p className="mt-0.5 text-[11px] text-ink-faint">{task.assigneeName}</p>}
                  </Td>
                  <Td className="px-2 py-3">{task.projectName}</Td>
                  <Td className="px-2 py-3">
                    <PriorityBadge priority={task.priority} />
                  </Td>
                  <Td className={cn("whitespace-nowrap px-2 py-3", task.overdue && "text-red-300")}>{task.dueLabel}</Td>
                  <Td className="px-2 py-3">
                    <TaskStatusBadge status={task.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      <div className="px-5 pb-5 text-center">
        <Link href={`${base}/tasks${scope === "mine" ? "?scope=mine" : ""}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          View all tasks →
        </Link>
      </div>
    </div>
  );
}
