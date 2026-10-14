import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CheckCircle2, Circle, FileCheck2, Flag, ListTodo, ShieldCheck } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { getProjectOverview } from "@/lib/data/queries/projects";
import { describeBlocker } from "@/lib/domain/rules";
import { TASK_STATUS } from "@/lib/domain/labels";
import { Card, CardHeader } from "@/components/ui/card";
import { DeliverableStatusBadge, MilestoneStatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { CardSkeleton, EmptyState, ProgressBar } from "@/components/ui/misc";
import { FileTypeIcon } from "@/components/files/file-type-icon";

export const metadata: Metadata = { title: "Project overview" };

export default function ProjectOverviewPage({ params }: PageProps<"/w/[org]/projects/[projectId]">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
        </div>
      }
    >
      <Overview params={params} />
    </Suspense>
  );
}

const STATUS_BAR: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-cyan-400",
  in_review: "bg-violet-400",
  blocked: "bg-red-400",
  done: "bg-emerald-400",
};

async function Overview({ params }: { params: Promise<{ org: string; projectId: string }> }) {
  const { org, projectId } = await params;
  const data = await getProjectOverview(org, projectId);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader
            icon={Flag}
            title="Milestones"
            description="Progress uses completed tasks. Approval milestones also need every deliverable approved."
            action={
              <Link href={`${data.projectBase}/milestones`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Manage →
              </Link>
            }
          />
          <div className="px-5 pb-5">
            {data.milestones.length === 0 ? (
              <EmptyState compact icon={Flag} title="No milestones yet" description="Split the project into phases the client can follow." />
            ) : (
              <ol className="relative space-y-1">
                {data.milestones.map((milestone, index) => {
                  const done = milestone.status === "completed";
                  return (
                    <li key={milestone.id} className="relative flex gap-4 pb-5 last:pb-0">
                      {index < data.milestones.length - 1 && (
                        <span className={cn("absolute left-[11px] top-7 h-[calc(100%-20px)] w-px", done ? "bg-emerald-400/40" : "bg-line-strong")} aria-hidden="true" />
                      )}
                      {done ? (
                        <CheckCircle2 size={23} className="z-10 flex-none text-emerald-400" aria-hidden="true" />
                      ) : (
                        <Circle size={23} className={cn("z-10 flex-none", milestone.status === "upcoming" ? "text-ink-faint" : "text-cyan-300")} aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-ink">{milestone.title}</h3>
                          <MilestoneStatusBadge status={milestone.status} />
                          {milestone.approvalRequired && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-300/90">
                              <ShieldCheck size={12} aria-hidden="true" /> Client approval
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">
                          Due {formatDate(milestone.dueAt)} · {milestone.doneTasks}/{milestone.taskCount} tasks · {milestone.deliverables.length} deliverables
                        </p>
                        {!done && (
                          <div className="mt-2.5 flex items-center gap-3">
                            <ProgressBar value={milestone.progress} label={`${milestone.title} progress`} className="max-w-xs flex-1" size="sm" />
                            <span className="text-xs tabular-nums text-ink-muted">{milestone.progress}%</span>
                          </div>
                        )}
                        {!done && milestone.blockers.length > 0 && milestone.status !== "upcoming" && (
                          <p className="mt-2 text-xs text-amber-300/90">Waiting on: {milestone.blockers.map(describeBlocker).join(" · ")}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={ListTodo}
            title="Up next"
            description="Open tasks, soonest first."
            action={
              <Link href={`${data.projectBase}/tasks`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                All tasks →
              </Link>
            }
          />
          <ul className="px-5 pb-5">
            {data.upcoming.length === 0 && <li className="py-6 text-center text-sm text-ink-muted">Every task is done. Nice work.</li>}
            {data.upcoming.map((task) => (
              <li key={task.id} className="flex items-center gap-3 border-b border-white/[0.05] py-3 last:border-0">
                {task.assignee ? <Avatar user={task.assignee} size="sm" /> : <span className="h-8 w-8 rounded-full border border-dashed border-line-strong" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <Link href={`${data.projectBase}/tasks?task=${task.id}`} className="block truncate text-sm font-medium text-ink hover:text-cyan-300">
                    {task.title}
                  </Link>
                  <p className="text-xs text-ink-faint">
                    {TASK_STATUS[task.status].label} · {task.assignee?.name ?? "Unassigned"}
                  </p>
                </div>
                <PriorityBadge priority={task.priority} />
                <span className={cn("hidden w-28 text-right text-xs sm:block", task.overdue ? "text-red-300" : "text-ink-muted")}>{task.dueText}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="font-semibold text-ink">Task breakdown</h2>
          <p className="mt-1 text-xs text-ink-faint">{data.totalTasks} tasks in total</p>
          {data.totalTasks > 0 && (
            <div className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
              {data.byStatus
                .filter((item) => item.count > 0)
                .map((item) => (
                  <span key={item.status} className={cn("h-full first:rounded-l-full last:rounded-r-full", STATUS_BAR[item.status])} style={{ flexGrow: item.count }} />
                ))}
            </div>
          )}
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            {data.byStatus.map((item) => (
              <li key={item.status} className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", STATUS_BAR[item.status])} aria-hidden="true" />
                <span className="text-ink-muted">{TASK_STATUS[item.status].label}</span>
                <span className="ml-auto tabular-nums text-ink">{item.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            icon={FileCheck2}
            title="Latest deliverables"
            action={
              <Link href={`${data.projectBase}/deliverables`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                All →
              </Link>
            }
          />
          <ul className="px-5 pb-5">
            {data.deliverables.length === 0 && <li className="py-6 text-center text-sm text-ink-muted">No deliverables uploaded yet.</li>}
            {data.deliverables.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${data.projectBase}/deliverables/${item.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.03]"
                >
                  <FileTypeIcon mimeType={item.latestVersion.mimeType} fileName={item.latestVersion.fileName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{item.title}</span>
                    <span className="block text-xs text-ink-faint">v{item.currentVersion} · {item.milestone?.title ?? "No milestone"}</span>
                  </span>
                  <DeliverableStatusBadge status={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={Activity} title="Recent activity" />
          <ul className="px-5 pb-5">
            {data.activity.length === 0 && <li className="py-6 text-center text-sm text-ink-muted">Nothing yet.</li>}
            {data.activity.map((item) => (
              <li key={item.id} className="flex gap-3 py-2.5 text-sm">
                {item.actor && <Avatar user={item.actor} size="xs" className="mt-0.5" />}
                <p className="min-w-0 flex-1 text-ink-muted">
                  <span className="text-ink">{item.actor?.name}</span> {item.action}{" "}
                  {item.href ? (
                    <Link href={item.href} className="text-cyan-300 hover:text-cyan-200">
                      {item.targetLabel}
                    </Link>
                  ) : (
                    <span className="text-ink-secondary">{item.targetLabel}</span>
                  )}
                  <span className="block text-xs text-ink-faint">{item.when}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
