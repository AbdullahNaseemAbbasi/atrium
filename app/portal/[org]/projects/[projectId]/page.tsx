import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CalendarDays, CheckCircle2, Circle, FileCheck2, Files, Flag, ListChecks, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { cn, formatBytes, formatDateRange } from "@/lib/utils";
import { getPortalProject } from "@/lib/data/queries/portal";
import { TASK_STATUS } from "@/lib/domain/labels";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, DeliverableStatusBadge, MilestoneStatusBadge, ProjectStatusBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Breadcrumbs, CardSkeleton, EmptyState, ProgressBar, Skeleton } from "@/components/ui/misc";
import { ProjectIcon } from "@/components/projects/project-icon";
import { FileTypeIcon } from "@/components/files/file-type-icon";
import { DownloadButton } from "@/components/files/download-button";
import { ActivityFeed } from "@/components/portal/activity-feed";

export const metadata: Metadata = { title: "Project" };

export default function PortalProjectPage({ params }: PageProps<"/portal/[org]/projects/[projectId]">) {
  return (
    <Suspense fallback={<ProjectSkeleton />}>
      <Project params={params} />
    </Suspense>
  );
}

async function Project({ params }: { params: Promise<{ org: string; projectId: string }> }) {
  const { org, projectId } = await params;
  const data = await getPortalProject(org, projectId);
  const { project } = data;
  const lead = data.team.find((member) => member.lead)?.user;
  const openTasks = data.tasks.filter((task) => task.status !== "done");
  const doneTasks = data.tasks.filter((task) => task.status === "done");

  return (
    <>
      <section className="pb-5 pt-7">
        <Breadcrumbs items={[{ label: "Projects", href: `${data.base}/projects` }, { label: project.name }]} />
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <ProjectIcon icon={project.icon} hue={data.clientHue} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-ink">{project.name}</h1>
                <ProjectStatusBadge status={project.status} />
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-ink-faint" aria-hidden="true" />
                  {formatDateRange(project.startAt, project.dueAt)}
                </span>
                {lead && <span>Led by {lead.name}</span>}
              </p>
              {project.description && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">{project.description}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="w-full sm:w-56">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-ink-faint">Progress</span>
                <span className="tabular-nums text-ink-secondary">{project.progress}%</span>
              </div>
              <ProgressBar value={project.progress} label="Project progress" tone={project.status === "completed" ? "emerald" : "cyan"} />
              <p className="mt-1.5 text-xs text-ink-faint">
                {project.milestonesDone} of {project.milestonesTotal} milestones complete
              </p>
            </div>
          </div>
        </div>
        {project.pendingReviews > 0 && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2.5 text-sm text-amber-100">
              <ShieldCheck size={18} className="flex-none text-amber-300" aria-hidden="true" />
              {project.pendingReviews === 1 ? "One deliverable is" : `${project.pendingReviews} deliverables are`} waiting for{" "}
              {data.canApprove ? "your review" : "approval"}.
            </p>
            <a href="#deliverables" className={buttonClasses({ size: "md", className: "w-full sm:w-auto" })}>
              {data.canApprove ? "Review now" : "See deliverables"}
            </a>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader icon={Flag} title="Milestones" description="The phases of this project. A phase that needs your sign-off finishes only after you approve its deliverables." />
            <CardBody>
              {data.milestones.length === 0 ? (
                <EmptyState compact icon={Flag} title="No milestones yet" description={`${data.agencyName} will add the plan here.`} />
              ) : (
                <ol className="relative">
                  {data.milestones.map((milestone, index) => {
                    const done = milestone.status === "completed";
                    const review = milestone.deliverables.find((item) => item.status === "in_review");
                    return (
                      <li key={milestone.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {index < data.milestones.length - 1 && (
                          <span
                            className={cn("absolute left-[11px] top-7 h-[calc(100%-20px)] w-px", done ? "bg-emerald-400/40" : "bg-line-strong")}
                            aria-hidden="true"
                          />
                        )}
                        {done ? (
                          <CheckCircle2 size={23} className="z-10 flex-none text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Circle
                            size={23}
                            className={cn("z-10 flex-none", milestone.needsApproval ? "text-amber-300" : milestone.status === "upcoming" ? "text-ink-faint" : "text-cyan-300")}
                            aria-hidden="true"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-ink">{milestone.title}</h3>
                            <MilestoneStatusBadge status={milestone.status} />
                            {milestone.needsApproval ? (
                              <Badge tone="amber">
                                <ShieldCheck size={12} aria-hidden="true" /> Needs your approval
                              </Badge>
                            ) : milestone.approvalRequired && !done ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                                <ShieldCheck size={12} aria-hidden="true" /> Your sign-off
                              </span>
                            ) : null}
                          </div>
                          {milestone.description && <p className="mt-1 text-sm text-ink-muted">{milestone.description}</p>}
                          <p className={cn("mt-1 text-xs", milestone.overdue ? "text-red-300" : "text-ink-faint")}>
                            {milestone.dueText}
                            {milestone.taskCount > 0 && ` · ${milestone.doneTasks} of ${milestone.taskCount} tasks done`}
                          </p>
                          {!done && milestone.taskCount > 0 && (
                            <ProgressBar value={milestone.progress} label={`${milestone.title} progress`} size="sm" className="mt-2.5 max-w-xs" />
                          )}
                          {milestone.deliverables.length > 0 && (
                            <ul className="mt-3 flex flex-wrap gap-2">
                              {milestone.deliverables.map((item) => (
                                <li key={item.id}>
                                  <Link
                                    href={`${data.base}/deliverables/${item.id}`}
                                    className={cn(
                                      "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition",
                                      item.status === "in_review"
                                        ? "border-amber-400/30 bg-amber-500/[0.06] text-amber-100 hover:border-amber-300/50"
                                        : "border-line bg-white/[0.02] text-ink-secondary hover:border-line-strong",
                                    )}
                                  >
                                    <FileCheck2 size={13} aria-hidden="true" />
                                    {item.title}
                                    <span className="text-ink-faint">· {item.status === "in_review" ? "waiting for you" : labelFor(item.status)}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                          {review && data.canApprove && (
                            <Link href={`${data.base}/deliverables/${review.id}`} className={buttonClasses({ size: "sm", className: "mt-3" })}>
                              Review {review.title}
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card id="deliverables" className="scroll-mt-28">
            <CardHeader icon={FileCheck2} title="Deliverables" description={`Work ${data.agencyName} has sent you. Open one to see every version and the discussion.`} />
            <CardBody>
              {data.deliverables.length === 0 ? (
                <EmptyState compact icon={FileCheck2} title="Nothing sent yet" description={`${data.agencyName} hasn't sent anything for review on this project yet.`} />
              ) : (
                <ul className="space-y-2">
                  {data.deliverables.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`${data.base}/deliverables/${item.id}`}
                        className={cn(
                          "flex flex-col gap-3 rounded-xl border p-3.5 transition sm:flex-row sm:items-center",
                          item.status === "in_review" ? "border-amber-400/20 bg-amber-500/[0.04] hover:border-amber-300/40" : "border-line hover:border-line-strong hover:bg-white/[0.02]",
                        )}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <FileTypeIcon mimeType={item.mimeType} fileName={item.fileName} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {item.title} <span className="font-normal text-ink-faint">v{item.version}</span>
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-faint">
                              <span>{item.milestoneTitle ?? "General"}</span>
                              <span>Updated {item.updatedText}</span>
                              {item.commentCount > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <MessageSquare size={11} aria-hidden="true" /> {item.commentCount}
                                </span>
                              )}
                            </span>
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-3 sm:justify-end">
                          <DeliverableStatusBadge status={item.status} />
                          {item.status === "in_review" && data.canApprove && (
                            <span className={buttonClasses({ size: "sm" })}>Review</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={ListChecks} title="Tasks" description={`Tasks ${data.agencyName} shares with you, soonest first. Read only.`} />
            <CardBody>
              {data.tasks.length === 0 ? (
                <EmptyState compact icon={ListChecks} title="No shared tasks" description={`${data.agencyName} hasn't shared any tasks on this project.`} />
              ) : (
                <>
                  {openTasks.length === 0 ? (
                    <p className="py-3 text-sm text-ink-muted">Every shared task is done.</p>
                  ) : (
                    <TaskList tasks={openTasks} />
                  )}
                  {doneTasks.length > 0 && (
                    <details className="group mt-2 border-t border-line pt-3">
                      <summary className="cursor-pointer list-none text-sm text-cyan-300 hover:text-cyan-200 [&::-webkit-details-marker]:hidden">
                        <span className="group-open:hidden">Show {doneTasks.length} completed {doneTasks.length === 1 ? "task" : "tasks"}</span>
                        <span className="hidden group-open:inline">Hide completed tasks</span>
                      </summary>
                      <TaskList tasks={doneTasks} />
                    </details>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader icon={Files} title="Shared files" description="Contracts, briefs and assets shared with you." />
            <CardBody>
              {data.files.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">No files shared on this project yet.</p>
              ) : (
                <ul className="space-y-1">
                  {data.files.map((file) => (
                    <li key={file.id} className="flex items-center gap-3 py-2">
                      <FileTypeIcon mimeType={file.mimeType} fileName={file.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{file.name}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {formatBytes(file.sizeBytes)} · {file.when}
                        </p>
                      </div>
                      <DownloadButton orgSlug={data.orgSlug} objectId={file.id} kind="file" iconOnly label={`Download ${file.name}`} />
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`${data.base}/files?project=${project.id}`} className="mt-3 inline-block text-sm text-cyan-300 hover:text-cyan-200">
                All files for this project →
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={Activity} title="Recent activity" />
            <CardBody>
              <ActivityFeed items={data.activity} showProject={false} emptyText="Updates on this project will show up here." />
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={Users} title="Project team" description={`The people at ${data.agencyName} working on this.`} />
            <CardBody>
              <ul className="space-y-3">
                {data.team.map(({ user, lead: isLead }) => (
                  <li key={user.id} className="flex items-center gap-3">
                    <Avatar user={user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-faint">{user.title}</p>
                    </div>
                    {isLead && <Badge tone="cyan">Lead</Badge>}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

type PortalTask = Awaited<ReturnType<typeof getPortalProject>>["tasks"][number];

function TaskList({ tasks }: { tasks: PortalTask[] }) {
  return (
    <ul className="divide-y divide-white/[0.05]">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-3 py-3">
          <span className="hidden w-24 flex-none sm:block">
            <TaskStatusBadge status={task.status} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm", task.status === "done" ? "text-ink-muted line-through decoration-white/20" : "text-ink")}>
              {task.title}
            </span>
            <span className="block truncate text-xs text-ink-faint">
              <span className="sm:hidden">{TASK_STATUS[task.status].label} · </span>
              {task.milestoneTitle ?? "General"}
            </span>
          </span>
          {task.assignee && <Avatar user={task.assignee} size="xs" />}
          <span className={cn("w-24 flex-none text-right text-xs", task.overdue ? "text-red-300" : "text-ink-muted")}>{task.dueText}</span>
        </li>
      ))}
    </ul>
  );
}

function labelFor(status: string) {
  return status === "approved" ? "approved" : status === "changes_requested" ? "changes requested" : "being updated";
}

function ProjectSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-4 pb-5 pt-7">
        <Skeleton className="h-3 w-40" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
