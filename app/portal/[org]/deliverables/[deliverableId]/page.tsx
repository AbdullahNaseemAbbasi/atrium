import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCircle2, Clock3, FileWarning, History, Info, MessageSquare, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import { cn, formatBytes, formatDateTime } from "@/lib/utils";
import { getPortalDeliverable } from "@/lib/data/queries/portal";
import { addDeliverableComment } from "@/lib/actions/deliverables";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, DeliverableStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Breadcrumbs, CardSkeleton, FormNote, Skeleton } from "@/components/ui/misc";
import { FilePreview } from "@/components/files/file-preview";
import { DownloadButton } from "@/components/files/download-button";
import { CommentThread } from "@/components/comments/comment-thread";
import { DecisionButtons } from "@/components/portal/decision-panel";

export const metadata: Metadata = { title: "Review" };

export default function PortalDeliverablePage({ params }: PageProps<"/portal/[org]/deliverables/[deliverableId]">) {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <Review params={params} />
    </Suspense>
  );
}

type Data = Awaited<ReturnType<typeof getPortalDeliverable>>;

async function Review({ params }: { params: Promise<{ org: string; deliverableId: string }> }) {
  const { org, deliverableId } = await params;
  const data = await getPortalDeliverable(org, deliverableId);
  const { deliverable, current } = data;

  return (
    <>
      <section className="pb-5 pt-7">
        <Breadcrumbs
          items={[
            { label: "Projects", href: `${data.base}/projects` },
            { label: data.project.name, href: `${data.base}/projects/${data.project.id}` },
            { label: deliverable.title },
          ]}
        />
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{deliverable.title}</h1>
              <DeliverableStatusBadge status={deliverable.status} />
              <Badge tone="slate">v{deliverable.currentVersion}</Badge>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {data.project.name}
              {data.milestone && (
                <span className="text-ink-faint">
                  {" "}
                  · {data.milestone.title}
                  {data.milestone.approvalRequired && " (needs your sign-off)"}
                </span>
              )}
            </p>
            {deliverable.description && <p className="mt-2 max-w-3xl text-sm text-ink-secondary">{deliverable.description}</p>}
          </div>
          <DownloadButton
            orgSlug={data.orgSlug}
            objectId={current.id}
            kind="version"
            label={`Download v${current.version}`}
            size="md"
            className="w-full sm:w-auto"
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr] xl:grid-rows-[auto_1fr]">
        <div className="min-w-0 space-y-4">
          <FilePreview fileName={current.fileName} mimeType={current.mimeType} sizeBytes={current.sizeBytes} version={current.version} />
          {current.note && (
            <FormNote icon={Info}>
              <span className="text-ink-secondary">
                {current.uploadedBy ? `${current.uploadedBy.name}` : data.agencyName} on version {current.version}:
              </span>{" "}
              {current.note}
            </FormNote>
          )}
        </div>

        <div className="min-w-0 space-y-4 xl:row-span-2">
          <DecisionCard data={data} />
          <VersionHistory data={data} />
          <DecisionTrail data={data} />
        </div>

        <Card className="self-start">
          <CardHeader
            icon={MessageSquare}
            title="Discussion"
            description={`Questions and feedback for ${data.agencyName}. Everyone on the project sees these.`}
          />
          <CardBody>
            <CommentThread
              comments={data.comments}
              action={addDeliverableComment.bind(null, data.orgSlug, deliverable.id)}
              canChooseVisibility={false}
              defaultVisibility="client"
              canPost={data.canComment}
              emptyText="No comments yet. Ask a question or leave feedback here."
              placeholder={`Write to ${data.agencyName}…`}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function DecisionCard({ data }: { data: Data }) {
  const { deliverable } = data;
  const latest = data.decisions[0] ?? null;
  const approverNames = data.approvers.map((user) => user.name);

  if (deliverable.status === "in_review") {
    return (
      <Card className="border-amber-400/25 p-5 shadow-[0_0_40px_rgba(251,191,36,0.06)]">
        <p className="flex items-center gap-2 text-xs font-medium text-amber-300">
          <Clock3 size={14} aria-hidden="true" /> {data.role === "approver" ? "Waiting for your decision" : "Waiting for approval"}
        </p>
        {data.canDecide ? (
          <>
            <h2 className="mt-3 text-lg font-semibold text-ink">Is version {deliverable.currentVersion} ready to go?</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              Approve it, or tell {data.agencyName} what to change. Your decision is saved against version {deliverable.currentVersion} with
              your name and the time.
            </p>
            <p className={cn("mt-2 text-xs", data.waiting.long ? "text-amber-300" : "text-ink-faint")}>Sent {data.waiting.sentText}</p>
            <div className="mt-5">
              <DecisionButtons
                key={deliverable.currentVersion}
                orgSlug={data.orgSlug}
                deliverableId={deliverable.id}
                version={deliverable.currentVersion}
                title={deliverable.title}
                agencyName={data.agencyName}
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-lg font-semibold text-ink">Out for approval</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              {approverNames.length > 0
                ? `${listNames(approverNames)} ${approverNames.length === 1 ? "approves" : "approve"} work for ${data.clientName.replace(/\.$/, "")}.`
                : `An approver at ${data.clientName.replace(/\.$/, "")} makes the final call.`}{" "}
              As a {data.roleLabel.toLowerCase()} you can open every version and comment, but not approve.
            </p>
            <p className="mt-2 text-xs text-ink-faint">Sent {data.waiting.sentText}</p>
            <FormNote icon={MessageSquare} className="mt-4">
              Spotted something? Leave a comment in the discussion. {approverNames[0] ?? "Your approver"} and the team will see it.
            </FormNote>
          </>
        )}
      </Card>
    );
  }

  if (deliverable.status === "approved") {
    return (
      <Card className="border-emerald-400/20 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="mt-0.5 flex-none text-emerald-400" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-semibold text-ink">Approved</h2>
            {latest ? (
              <p className="mt-1 text-sm text-ink-muted">
                {latest.byYou ? "You" : (latest.by?.name ?? "Your approver")} approved version {latest.version} {latest.when}.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">This deliverable is signed off.</p>
            )}
            {latest?.comment && <p className="mt-2 text-sm text-ink-secondary">{latest.comment}</p>}
            <p className="mt-3 text-xs text-ink-faint">If anything changes, {data.agencyName} will send a new version for review.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (deliverable.status === "changes_requested") {
    return (
      <Card className="border-red-400/20 p-5">
        <div className="flex items-start gap-3">
          <FileWarning size={22} className="mt-0.5 flex-none text-red-300" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-semibold text-ink">Changes requested</h2>
            {latest && (
              <p className="mt-1 text-sm text-ink-muted">
                {latest.byYou ? "You" : (latest.by?.name ?? "Your approver")} asked for changes on version {latest.version} {latest.when}.
              </p>
            )}
            {latest?.comment && <p className="mt-2 text-sm text-ink-secondary">{latest.comment}</p>}
            <p className="mt-3 text-xs text-ink-faint">{data.agencyName} is working on a new version. You&apos;ll get a notification when it&apos;s ready.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <RefreshCw size={20} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-ink">A new version is on its way</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {data.agencyName} is preparing the next version. You&apos;ll be notified when it&apos;s ready for review.
          </p>
        </div>
      </div>
    </Card>
  );
}

function VersionHistory({ data }: { data: Data }) {
  return (
    <Card>
      <CardHeader icon={History} title="Version history" description="Every version you've been sent. Decisions stay with the version they were made on." />
      <ol className="px-4 pb-4 sm:px-5 sm:pb-5">
        {data.versions.map((version) => (
          <li key={version.id} className="flex gap-3 border-b border-white/[0.05] py-3.5 last:border-0">
            <span
              className={cn(
                "grid h-8 w-8 flex-none place-items-center rounded-lg text-xs font-semibold",
                version.version === data.deliverable.currentVersion ? "bg-cyan-500/15 text-cyan-200" : "bg-white/[0.05] text-ink-muted",
              )}
            >
              v{version.version}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{version.fileName}</p>
              <p className="text-xs text-ink-faint">
                {formatBytes(version.sizeBytes)} · {version.uploadedBy?.name ?? data.agencyName} · {version.when}
              </p>
              {version.note && <p className="mt-1 text-xs text-ink-muted">{version.note}</p>}
              {version.decision && (
                <p className={cn("mt-1.5 text-xs", version.decision.decision === "approved" ? "text-emerald-300" : "text-red-300")}>
                  {version.decision.decision === "approved" ? "Approved" : "Changes requested"} by {version.decision.byYou ? "you" : version.decision.by?.name}
                </p>
              )}
            </div>
            <DownloadButton orgSlug={data.orgSlug} objectId={version.id} kind="version" iconOnly label={`Download version ${version.version}`} />
          </li>
        ))}
      </ol>
    </Card>
  );
}

function DecisionTrail({ data }: { data: Data }) {
  return (
    <Card>
      <CardHeader icon={UserCheck} title="Decision trail" description="Each approval and change request, with the version and date." />
      <ol className="px-4 pb-4 sm:px-5 sm:pb-5">
        {data.decisions.length === 0 && (
          <li className="flex items-center gap-2 py-3 text-sm text-ink-muted">
            <ShieldCheck size={16} className="text-ink-faint" aria-hidden="true" /> No decisions yet.
          </li>
        )}
        {data.decisions.map((decision) => (
          <li key={decision.id} className="flex gap-3 border-b border-white/[0.05] py-3 last:border-0">
            {decision.by ? <Avatar user={decision.by} size="sm" /> : <span className="h-8 w-8 flex-none rounded-full bg-surface-raised" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                {decision.byYou ? "You" : decision.by?.name}{" "}
                <span className={decision.decision === "approved" ? "text-emerald-300" : "text-red-300"}>
                  {decision.decision === "approved" ? "approved" : "requested changes on"}
                </span>{" "}
                v{decision.version}
              </p>
              <p className="text-xs text-ink-faint">
                <time dateTime={decision.decidedAt} title={formatDateTime(decision.decidedAt)}>
                  {decision.when}
                </time>
              </p>
              {decision.comment && <p className="mt-1.5 text-sm text-ink-muted">{decision.comment}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function ReviewSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Skeleton className="aspect-[16/9] rounded-2xl" />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
