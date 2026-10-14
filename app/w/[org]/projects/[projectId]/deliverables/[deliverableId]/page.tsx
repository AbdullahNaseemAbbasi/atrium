import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, FileWarning, History, Info, MessageSquare, UserCheck } from "lucide-react";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";
import { getDeliverableDetail } from "@/lib/data/queries/projects";
import { addDeliverableComment } from "@/lib/actions/deliverables";
import { CLIENT_ROLE_LABELS } from "@/lib/auth/permissions";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, DeliverableStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CardSkeleton, FormNote } from "@/components/ui/misc";
import { FlashToast } from "@/components/ui/flash-toast";
import { FilePreview } from "@/components/files/file-preview";
import { DownloadButton } from "@/components/files/download-button";
import { CommentThread } from "@/components/comments/comment-thread";
import { NewVersionButton, SubmitForReviewButton } from "@/components/deliverables/deliverable-actions";

export const metadata: Metadata = { title: "Deliverable" };

export default function DeliverablePage({ params }: PageProps<"/w/[org]/projects/[projectId]/deliverables/[deliverableId]">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <CardSkeleton lines={8} />
          <CardSkeleton lines={6} />
        </div>
      }
    >
      <Deliverable params={params} />
    </Suspense>
  );
}

const STATUS_COPY = {
  draft: { icon: Info, text: "Draft. Only your team can see this version." },
  in_review: { icon: Clock3, text: "Waiting for the client to approve or request changes." },
  changes_requested: { icon: FileWarning, text: "The client asked for changes. Upload a new version to continue." },
  approved: { icon: CheckCircle2, text: "Approved by the client. Uploading a new version starts a new review." },
} as const;

async function Deliverable({ params }: { params: Promise<{ org: string; projectId: string; deliverableId: string }> }) {
  const { org, projectId, deliverableId } = await params;
  const data = await getDeliverableDetail(org, projectId, deliverableId);
  const { deliverable } = data;
  const current = data.versions[0];
  const status = STATUS_COPY[deliverable.status];
  const decisionByVersion = new Map(data.approvals.map((approval) => [approval.version, approval]));

  return (
    <>
      <FlashToast messages={{ uploaded: "Draft uploaded. Send it to the client when it's ready." }} />
      <Link href={`${data.projectBase}/deliverables`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-cyan-300">
        <ArrowLeft size={15} /> All deliverables
      </Link>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-ink">{deliverable.title}</h2>
            <DeliverableStatusBadge status={deliverable.status} />
            <Badge tone="slate">v{deliverable.currentVersion}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">
            {deliverable.description ?? "No description."} {deliverable.milestone && <span className="text-ink-faint">· {deliverable.milestone.title}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <DownloadButton orgSlug={data.orgSlug} objectId={current.id} kind="version" label={`Download v${current.version}`} size="md" />
          {data.can.upload && <NewVersionButton orgSlug={data.orgSlug} deliverableId={deliverable.id} nextVersion={deliverable.currentVersion + 1} />}
          {data.can.submit && data.clientName && <SubmitForReviewButton orgSlug={data.orgSlug} deliverableId={deliverable.id} clientName={data.clientName} />}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <FilePreview fileName={current.fileName} mimeType={current.mimeType} sizeBytes={current.sizeBytes} version={current.version} />
          {current.note && (
            <FormNote icon={Info}>
              <span className="text-ink-secondary">Version {current.version} note:</span> {current.note}
            </FormNote>
          )}
          <Card>
            <CardHeader icon={MessageSquare} title="Discussion" description="Client-visible comments appear on the client portal. Internal notes never do." />
            <div className="px-5 pb-5">
              <CommentThread
                comments={data.comments}
                action={addDeliverableComment.bind(null, data.orgSlug, deliverable.id)}
                canChooseVisibility={data.project.sharedWithClient}
                defaultVisibility={data.project.sharedWithClient ? "client" : "internal"}
                canPost={data.can.comment}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <status.icon
                size={20}
                className={cn(
                  "mt-0.5 flex-none",
                  deliverable.status === "approved" ? "text-emerald-400" : deliverable.status === "changes_requested" ? "text-red-300" : deliverable.status === "in_review" ? "text-amber-300" : "text-ink-muted",
                )}
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold text-ink">Review status</h3>
                <p className="mt-1 text-sm text-ink-muted">{status.text}</p>
                {data.submitBlocker && deliverable.status === "draft" && <p className="mt-2 text-xs text-amber-300/90">{data.submitBlocker}</p>}
              </div>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-faint">
                <UserCheck size={13} aria-hidden="true" /> Client reviewers
              </p>
              {data.reviewers.length === 0 ? (
                <p className="mt-2 text-sm text-ink-muted">{data.clientName ? "No portal users yet. Invite one from the client page." : "Internal project."}</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {data.reviewers.map((reviewer) => (
                    <li key={reviewer.id} className="flex items-center gap-3">
                      <Avatar user={reviewer} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{reviewer.name}</p>
                        <p className="truncate text-xs text-ink-faint">{reviewer.email}</p>
                      </div>
                      <Badge tone={reviewer.role === "approver" ? "cyan" : "slate"}>{CLIENT_ROLE_LABELS[reviewer.role]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={History} title="Version history" description="Every upload is kept. Decisions are pinned to the version they were made on." />
            <ol className="px-5 pb-5">
              {data.versions.map((version) => {
                const decision = decisionByVersion.get(version.version);
                return (
                  <li key={version.id} className="flex gap-3 border-b border-white/[0.05] py-3.5 last:border-0">
                    <span
                      className={cn(
                        "grid h-8 w-8 flex-none place-items-center rounded-lg text-xs font-semibold",
                        version.version === deliverable.currentVersion ? "bg-cyan-500/15 text-cyan-200" : "bg-white/[0.05] text-ink-muted",
                      )}
                    >
                      v{version.version}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{version.fileName}</p>
                      <p className="text-xs text-ink-faint">
                        {formatBytes(version.sizeBytes)} · {version.uploadedBy?.name} · {version.when}
                      </p>
                      {version.note && <p className="mt-1 text-xs text-ink-muted">{version.note}</p>}
                      {decision && (
                        <p className={cn("mt-1.5 text-xs", decision.decision === "approved" ? "text-emerald-300" : "text-red-300")}>
                          {decision.decision === "approved" ? "Approved" : "Changes requested"} by {decision.by?.name}
                        </p>
                      )}
                    </div>
                    <DownloadButton orgSlug={data.orgSlug} objectId={version.id} kind="version" iconOnly label={`Download version ${version.version}`} />
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <CardHeader icon={CheckCircle2} title="Approval trail" description="Recorded with reviewer, version and time." />
            <ol className="px-5 pb-5">
              {data.approvals.length === 0 && <li className="py-4 text-sm text-ink-muted">No client decisions yet.</li>}
              {data.approvals.map((approval) => (
                <li key={approval.id} className="flex gap-3 py-3">
                  {approval.by && <Avatar user={approval.by} size="sm" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      {approval.by?.name}{" "}
                      <span className={approval.decision === "approved" ? "text-emerald-300" : "text-red-300"}>
                        {approval.decision === "approved" ? "approved" : "requested changes on"}
                      </span>{" "}
                      v{approval.version}
                    </p>
                    <p className="text-xs text-ink-faint" title={formatDateTime(approval.decidedAt)}>
                      {approval.when}
                    </p>
                    {approval.comment && <p className="mt-1.5 text-sm text-ink-muted">“{approval.comment}”</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
