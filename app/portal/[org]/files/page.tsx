import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2, Files } from "lucide-react";
import { firstParam, formatBytes, formatDate } from "@/lib/utils";
import { getPortalFiles } from "@/lib/data/queries/portal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, FilterChips, PageHeader, Skeleton, TableSkeleton } from "@/components/ui/misc";
import { ParamSelect, SearchInput } from "@/components/ui/interactive";
import { FileTypeIcon } from "@/components/files/file-type-icon";
import { DownloadButton } from "@/components/files/download-button";

export const metadata: Metadata = { title: "Files" };

export default function PortalFilesPage({ params, searchParams }: PageProps<"/portal/[org]/files">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="space-y-3 pb-5 pt-7">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="card">
            <TableSkeleton rows={6} />
          </div>
        </div>
      }
    >
      <PortalFiles params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PortalFiles({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getPortalFiles(org, { project: firstParam(query.project), type: firstParam(query.type), q: firstParam(query.q) });
  const href = `${data.base}/files`;
  const hrefFor = (type: string) => {
    const next = new URLSearchParams();
    if (data.filters.project) next.set("project", data.filters.project);
    if (data.filters.q) next.set("q", data.filters.q);
    if (type !== "all") next.set("type", type);
    return `${href}${next.size ? `?${next}` : ""}`;
  };
  const chips = (
    [
      ["all", "All"],
      ["shared", "Shared files"],
      ["approved", "Approved deliverables"],
    ] as const
  ).map(([key, label]) => ({ label, count: data.counts[key], active: data.type === key, href: hrefFor(key) }));
  const filtered = Boolean(data.filters.project || data.filters.q || data.type !== "all");

  return (
    <>
      <PageHeader
        title="Files"
        description={`Everything ${data.agencyName} has shared with you, plus the final version of every deliverable you approved.`}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput placeholder="Search files…" className="lg:w-72" />
        <ParamSelect
          param="project"
          label="Filter by project"
          className="lg:w-60"
          options={[{ value: "", label: "All projects" }, ...data.projects.map((project) => ({ value: project.id, label: project.name }))]}
        />
        <div className="lg:ml-auto">
          <FilterChips label="Filter by type" items={chips} />
        </div>
      </div>

      <Card>
        {data.rows.length === 0 ? (
          <EmptyState
            icon={Files}
            title={data.totalAvailable === 0 ? "No files yet" : "No files match"}
            description={
              data.totalAvailable === 0
                ? `Briefs, contracts and assets ${data.agencyName} shares with you will appear here, along with every deliverable you approve.`
                : filtered
                  ? "Try another project, type or search."
                  : undefined
            }
            action={
              filtered && data.totalAvailable > 0 ? (
                <Link href={href} className="text-sm text-cyan-300 hover:text-cyan-200">
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {data.rows.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                <FileTypeIcon mimeType={row.mimeType} fileName={row.name} />
                <div className="min-w-0 flex-1 basis-[60%] sm:basis-auto">
                  <p className="truncate text-sm font-medium text-ink">{row.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {row.href ? (
                      <Link href={row.href} className="hover:text-cyan-300">
                        {row.detail}
                      </Link>
                    ) : (
                      row.detail
                    )}
                  </p>
                </div>
                <div className="hidden w-44 min-w-0 md:block">
                  <p className="truncate text-sm text-ink-secondary">{row.projectName}</p>
                </div>
                <div className="hidden w-40 lg:block">
                  {row.kind === "version" ? (
                    <Badge tone="emerald">
                      <FileCheck2 size={12} aria-hidden="true" /> Approved
                    </Badge>
                  ) : (
                    <Badge tone="blue">Shared file</Badge>
                  )}
                </div>
                <div className="ml-14 flex flex-1 items-center gap-3 text-xs text-ink-faint sm:ml-0 sm:w-36 sm:flex-none sm:flex-col sm:items-end sm:gap-0.5">
                  <span className="tabular-nums">{formatBytes(row.sizeBytes)}</span>
                  <span title={formatDate(row.addedAt)}>{row.when}</span>
                </div>
                <DownloadButton orgSlug={data.orgSlug} objectId={row.objectId} kind={row.kind} iconOnly label={`Download ${row.name}`} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
