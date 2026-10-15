import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, FileCheck2, MessageSquare } from "lucide-react";
import { firstParam, formatBytes } from "@/lib/utils";
import { getProjectDeliverables } from "@/lib/data/queries/projects";
import { Card } from "@/components/ui/card";
import { DeliverableStatusBadge } from "@/components/ui/badge";
import { EmptyState, FilterChips, FormNote, Skeleton } from "@/components/ui/misc";
import { FileTypeIcon } from "@/components/files/file-type-icon";
import { NewDeliverableButton } from "@/components/deliverables/deliverable-actions";

export const metadata: Metadata = { title: "Deliverables" };

export default function DeliverablesPage({ params, searchParams }: PageProps<"/w/[org]/projects/[projectId]/deliverables">) {
  return (
    <Suspense fallback={<Skeleton className="h-[420px] rounded-2xl" />}>
      <Deliverables params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Deliverables({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org, projectId }, query] = await Promise.all([params, searchParams]);
  const data = await getProjectDeliverables(org, projectId, { status: firstParam(query.status) });
  const base = `${data.projectBase}/deliverables`;
  const chips = (
    [
      ["all", "All"],
      ["draft", "Drafts"],
      ["in_review", "In review"],
      ["changes_requested", "Changes requested"],
      ["approved", "Approved"],
    ] as const
  ).map(([key, label]) => ({
    label,
    count: data.counts[key],
    active: data.status === key,
    href: key === "all" ? base : `${base}?status=${key}`,
  }));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips label="Filter deliverables" items={chips} />
        {data.canUpload && <NewDeliverableButton orgSlug={data.orgSlug} projectId={data.projectId} milestones={data.milestones} />}
      </div>
      {!data.sharedWithClient && (
        <FormNote className="mb-4" icon={EyeOff}>
          This project isn&apos;t shared with the client yet. Deliverables stay internal until it is, even after you submit them.
        </FormNote>
      )}
      {data.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileCheck2}
            title={data.status === "all" ? "No deliverables yet" : "Nothing in this state"}
            description={
              data.status === "all"
                ? "Upload designs, documents or videos. Each one keeps its versions and the client's decisions."
                : "Pick another filter to see more."
            }
            action={data.status === "all" && data.canUpload ? <NewDeliverableButton orgSlug={data.orgSlug} projectId={data.projectId} milestones={data.milestones} /> : undefined}
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.rows.map((item) => (
            <li key={item.id}>
              <Link
                href={`${base}/${item.id}`}
                className="card flex h-full items-start gap-4 p-4 transition hover:-translate-y-0.5 hover:border-cyan-400/25"
              >
                <FileTypeIcon mimeType={item.latestVersion.mimeType} fileName={item.latestVersion.fileName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 truncate font-medium text-ink">{item.title}</h2>
                    <DeliverableStatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-faint">
                    {item.latestVersion.fileName} · {formatBytes(item.latestVersion.sizeBytes)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span>v{item.currentVersion}</span>
                    <span>{item.milestone?.title ?? "No milestone"}</span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare size={12} aria-hidden="true" /> {item.commentCount}
                    </span>
                    <span>Updated {item.updatedText}</span>
                  </div>
                  {item.lastDecision?.decision === "changes_requested" && item.status === "changes_requested" && item.lastDecision.comment && (
                    <p className="mt-3 line-clamp-2 rounded-lg border border-red-500/15 bg-red-500/[0.05] px-3 py-2 text-xs text-red-200/90">
                      {item.lastDecision.comment} · {item.lastDecision.by?.name}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
