import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, FileCheck2, Flag, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectMilestones } from "@/lib/data/queries/project-tabs";
import { Card } from "@/components/ui/card";
import { DeliverableStatusBadge, MilestoneStatusBadge } from "@/components/ui/badge";
import { EmptyState, FormNote, ProgressBar, Skeleton } from "@/components/ui/misc";
import {
  CompleteMilestoneButton,
  MilestoneDialog,
  MoveMilestoneButtons,
  ReopenMilestoneButton,
} from "@/components/project-tabs/milestone-controls";

export const metadata: Metadata = { title: "Milestones" };

export default function MilestonesPage({ params }: PageProps<"/w/[org]/projects/[projectId]/milestones">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-10 w-full max-w-md" />
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-2xl" />
          ))}
        </div>
      }
    >
      <Milestones params={params} />
    </Suspense>
  );
}

async function Milestones({ params }: { params: Promise<{ org: string; projectId: string }> }) {
  const { org, projectId } = await params;
  const data = await getProjectMilestones(org, projectId);
  const { summary } = data;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          {summary.total === 0 ? (
            "No milestones yet."
          ) : (
            <>
              <span className="text-ink">{summary.completed}</span> of {summary.total} complete
              {summary.awaiting > 0 && <span className="text-amber-300"> · {summary.awaiting} awaiting client approval</span>}
              {summary.overdue > 0 && <span className="text-red-300"> · {summary.overdue} overdue</span>}
            </>
          )}
        </p>
        {data.canManage && <MilestoneDialog orgSlug={data.orgSlug} projectId={data.projectId} hasClient={Boolean(data.clientName)} />}
      </div>

      {!data.canManage && summary.total > 0 && (
        <FormNote icon={Info} className="mb-4">
          Only the project lead or a manager can add, reorder or complete milestones.
        </FormNote>
      )}

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Flag}
            title="Plan the project in phases"
            description="Milestones group tasks and deliverables. Mark the ones the client must sign off, and they complete themselves when the last approval comes in."
            action={data.canManage ? <MilestoneDialog orgSlug={data.orgSlug} projectId={data.projectId} hasClient={Boolean(data.clientName)} /> : undefined}
          />
        </Card>
      ) : (
        <ol className="space-y-3">
          {data.rows.map((milestone, index) => {
            const done = milestone.status === "completed";
            const blockerId = `blockers-${milestone.id}`;
            return (
              <li key={milestone.id} className={cn("card p-4 sm:p-5", milestone.status === "awaiting_approval" && "border-amber-400/20")}>
                <div className="flex gap-4">
                  <span
                    className={cn(
                      "grid h-9 w-9 flex-none place-items-center rounded-xl text-sm font-semibold",
                      done ? "bg-emerald-500/10 text-emerald-300" : "bg-cyan-500/10 text-cyan-300",
                    )}
                    aria-label={`Milestone ${index + 1}`}
                  >
                    {done ? <CheckCircle2 size={18} aria-hidden="true" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-ink">{milestone.title}</h2>
                          <MilestoneStatusBadge status={milestone.status} />
                          {milestone.approvalRequired && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-300/90">
                              <ShieldCheck size={12} aria-hidden="true" /> Client approval
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-ink-faint">
                          <span className={cn(milestone.overdue && "text-red-300")}>{milestone.dueText}</span> · {milestone.doneTasks}/{milestone.taskCount} tasks ·{" "}
                          {milestone.deliverables.length} {milestone.deliverables.length === 1 ? "deliverable" : "deliverables"}
                        </p>
                      </div>
                      {data.canManage && (
                        <div className="-ml-2 flex items-center gap-0.5 sm:ml-0">
                          <MilestoneDialog
                            orgSlug={data.orgSlug}
                            projectId={data.projectId}
                            hasClient={Boolean(data.clientName)}
                            milestone={{
                              id: milestone.id,
                              title: milestone.title,
                              description: milestone.description,
                              dueAt: milestone.dueAt,
                              approvalRequired: milestone.approvalRequired,
                            }}
                          />
                          <MoveMilestoneButtons
                            orgSlug={data.orgSlug}
                            milestoneId={milestone.id}
                            title={milestone.title}
                            isFirst={milestone.isFirst}
                            isLast={milestone.isLast}
                          />
                        </div>
                      )}
                    </div>

                    {milestone.description && <p className="mt-2 max-w-3xl text-sm text-ink-muted">{milestone.description}</p>}

                    {!done && (
                      <div className="mt-3 flex max-w-md items-center gap-3">
                        <ProgressBar value={milestone.progress} label={`${milestone.title} progress`} size="sm" className="flex-1" />
                        <span className="w-9 text-right text-xs tabular-nums text-ink-muted">{milestone.progress}%</span>
                      </div>
                    )}

                    {milestone.deliverables.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Deliverables in ${milestone.title}`}>
                        {milestone.deliverables.map((item) => (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] py-1 pl-2.5 pr-1 text-xs text-ink-secondary transition hover:border-line-strong hover:text-ink"
                            >
                              <FileCheck2 size={13} className="text-ink-faint" aria-hidden="true" />
                              {item.title}
                              <DeliverableStatusBadge status={item.status} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                      {done ? (
                        <p className="text-sm text-emerald-300/90">Complete. Everything in this phase is done{milestone.approvalRequired ? " and signed off" : ""}.</p>
                      ) : milestone.blockers.length > 0 ? (
                        <p id={blockerId} className="text-sm text-amber-200/90">
                          <span className="text-ink-muted">Before it can be completed: </span>
                          {milestone.blockers.join(" · ")}
                        </p>
                      ) : (
                        <p className="text-sm text-ink-muted">Nothing blocking. Ready to mark complete.</p>
                      )}
                      {data.canManage && (
                        <div className="flex flex-none items-center gap-2">
                          {done ? (
                            <ReopenMilestoneButton orgSlug={data.orgSlug} milestoneId={milestone.id} title={milestone.title} />
                          ) : (
                            <CompleteMilestoneButton
                              orgSlug={data.orgSlug}
                              milestoneId={milestone.id}
                              title={milestone.title}
                              blocked={milestone.blockers.length > 0}
                              describedBy={milestone.blockers.length > 0 ? blockerId : undefined}
                              clientName={data.sharedWithClient ? data.clientName : null}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
