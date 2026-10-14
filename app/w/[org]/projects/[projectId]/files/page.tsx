import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Eye, EyeOff, FileCheck2, FolderOpen, Lock } from "lucide-react";
import { firstParam, formatBytes, formatDate, percent } from "@/lib/utils";
import { getProjectFiles } from "@/lib/data/queries/project-tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, FilterChips, FormNote, ProgressBar, Skeleton, TableSkeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { ParamSelect } from "@/components/ui/interactive";
import { FileTypeIcon } from "@/components/files/file-type-icon";
import { DownloadButton } from "@/components/files/download-button";
import { DeleteFileButton, UploadFileButton } from "@/components/project-tabs/file-controls";

export const metadata: Metadata = { title: "Project files" };

export default function ProjectFilesPage({ params, searchParams }: PageProps<"/w/[org]/projects/[projectId]/files">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <Skeleton className="mb-4 h-10 w-full max-w-lg" />
          <div className="card">
            <TableSkeleton rows={6} />
          </div>
        </div>
      }
    >
      <ProjectFiles params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProjectFiles({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org, projectId }, query] = await Promise.all([params, searchParams]);
  const data = await getProjectFiles(org, projectId, { visibility: firstParam(query.visibility), kind: firstParam(query.kind) });
  const base = `${data.projectBase}/files`;
  const hrefFor = (visibility: string) => {
    const next = new URLSearchParams();
    if (data.kind !== "all") next.set("kind", data.kind);
    if (visibility !== "all") next.set("visibility", visibility);
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  const chips = (
    [
      ["all", "All"],
      ["client", "Client-visible"],
      ["internal", "Internal"],
    ] as const
  ).map(([key, label]) => ({ label, count: data.counts[key], active: data.visibility === key, href: hrefFor(key) }));
  const storagePercent = percent(data.storage.used, data.storage.limit);
  const total = data.counts.files + data.counts.versions;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <FilterChips label="Filter by visibility" items={chips} />
        <ParamSelect
          param="kind"
          label="Filter by type"
          className="xl:w-56"
          options={[
            { value: "", label: "Files and versions" },
            { value: "file", label: `Project files (${data.counts.files})` },
            { value: "version", label: `Deliverable versions (${data.counts.versions})` },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:ml-auto">
          <div className="min-w-0 sm:w-56" title={`${storagePercent}% of your ${data.storage.planName} storage`}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="text-ink-faint">Workspace storage</span>
              <span className="whitespace-nowrap tabular-nums text-ink-muted">
                {formatBytes(data.storage.used)} / {formatBytes(data.storage.limit)}
              </span>
            </div>
            <ProgressBar value={storagePercent} label="Workspace storage used" size="sm" tone={storagePercent > 85 ? "amber" : "cyan"} />
          </div>
          {data.can.upload && (
            <UploadFileButton
              orgSlug={data.orgSlug}
              projectId={data.projectId}
              hasClient={data.hasClient}
              sharedWithClient={data.sharedWithClient}
              storage={data.storage}
            />
          )}
        </div>
      </div>

      {data.hasClient && !data.sharedWithClient && (
        <FormNote icon={EyeOff} className="mb-4">
          This project isn&apos;t shared with the client yet. Files marked client-visible appear on their portal once it is.
        </FormNote>
      )}

      <Card>
        {data.rows.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={total === 0 ? "No files yet" : "Nothing matches"}
            description={
              total === 0
                ? "Upload briefs, contracts and raw assets here. Deliverable versions show up automatically."
                : "Try another filter."
            }
            action={
              total === 0 && data.can.upload ? (
                <UploadFileButton
                  orgSlug={data.orgSlug}
                  projectId={data.projectId}
                  hasClient={data.hasClient}
                  sharedWithClient={data.sharedWithClient}
                  storage={data.storage}
                />
              ) : undefined
            }
          />
        ) : (
          <>
            <TableWrap className="pt-4">
              <Table className="min-w-[860px]">
                <THead>
                  <Th>Name</Th>
                  <Th>Visibility</Th>
                  <Th className="text-right">Size</Th>
                  <Th>Uploaded by</Th>
                  <Th>Added</Th>
                  <Th className="text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </THead>
                <tbody>
                  {data.rows.map((row) => (
                    <Tr key={row.key}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <FileTypeIcon mimeType={row.mimeType} fileName={row.name} size="sm" />
                          <div className="min-w-0">
                            <p className="max-w-[320px] truncate font-medium text-ink">{row.name}</p>
                            {row.deliverable ? (
                              <Link href={row.deliverable.href} className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-cyan-300">
                                <FileCheck2 size={11} aria-hidden="true" /> {row.deliverable.title} · v{row.deliverable.version}
                              </Link>
                            ) : (
                              <p className="text-xs text-ink-faint">Project file</p>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {row.draft ? (
                          <Badge tone="slate">
                            <Lock size={11} aria-hidden="true" /> Draft
                          </Badge>
                        ) : row.visibility === "client" ? (
                          <Badge tone="cyan">
                            <Eye size={11} aria-hidden="true" /> Client
                          </Badge>
                        ) : (
                          <Badge tone="amber">
                            <Lock size={11} aria-hidden="true" /> Internal
                          </Badge>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{formatBytes(row.sizeBytes)}</Td>
                      <Td>
                        {row.uploadedBy ? (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <Avatar user={row.uploadedBy} size="xs" /> {row.uploadedBy.name}
                          </span>
                        ) : (
                          <span className="text-ink-faint">Former member</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <time dateTime={row.createdAt} title={formatDate(row.createdAt)}>
                          {row.when}
                        </time>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1.5">
                          <DownloadButton orgSlug={data.orgSlug} objectId={row.objectId} kind={row.kind} iconOnly label={`Download ${row.name}`} />
                          {row.kind === "file" && data.can.delete && <DeleteFileButton orgSlug={data.orgSlug} fileId={row.objectId} name={row.name} />}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <p className="px-4 pb-4 text-xs text-ink-faint sm:px-5">
              Deliverable versions are kept for the approval history and can&apos;t be deleted here.
              {!data.can.delete && " Only the project lead or a manager can delete project files."}
            </p>
          </>
        )}
      </Card>
    </>
  );
}
