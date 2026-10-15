import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock3, History } from "lucide-react";
import { formatDate, formatDateTime, firstParam } from "@/lib/utils";
import { getPortalApprovals } from "@/lib/data/queries/portal";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CardSkeleton, EmptyState, FilterChips, PageHeader, Pagination, Skeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { ReviewList } from "@/components/portal/review-list";

export const metadata: Metadata = { title: "Approvals" };

export default function PortalApprovalsPage({ params, searchParams }: PageProps<"/portal/[org]/approvals">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="space-y-3 pb-5 pt-7">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <CardSkeleton lines={2} />
          <CardSkeleton className="mt-4" lines={5} />
        </div>
      }
    >
      <Approvals params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Approvals({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getPortalApprovals(org, { decision: firstParam(query.decision), page: firstParam(query.page) });
  const href = `${data.base}/approvals`;
  const hrefFor = (decision: string, page?: number) => {
    const next = new URLSearchParams();
    if (decision !== "all") next.set("decision", decision);
    if (page && page > 1) next.set("page", String(page));
    return `${href}${next.size ? `?${next}` : ""}`;
  };
  const chips = (
    [
      ["all", "All decisions"],
      ["approved", "Approved"],
      ["changes_requested", "Changes requested"],
    ] as const
  ).map(([key, label]) => ({ label, count: data.counts[key], active: data.decision === key, href: hrefFor(key) }));

  return (
    <>
      <PageHeader
        title="Approvals"
        description={
          data.canApprove
            ? `Work waiting for your decision, and every decision your team has made on ${data.agencyName}'s deliverables.`
            : `Work out for approval, and every decision your team has made on ${data.agencyName}'s deliverables.`
        }
      />

      <Card>
        <CardHeader
          icon={Clock3}
          tone="amber"
          title={data.canApprove ? "Waiting for your review" : "Out for approval"}
          description={data.pending.length > 0 ? "Oldest first, so nothing waits too long." : undefined}
        />
        <CardBody>
          {data.pending.length === 0 ? (
            <EmptyState compact icon={CheckCircle2} title="Nothing waiting" description={`${data.agencyName} will notify you when the next version is ready.`} />
          ) : (
            <ReviewList items={data.pending} base={data.base} canApprove={data.canApprove} />
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader icon={History} title="Decision history" description="Each decision is tied to the exact version it was made on." action={<FilterChips label="Filter decisions" items={chips} />} />
        {data.history.total === 0 ? (
          <EmptyState
            compact
            icon={History}
            title={data.counts.all === 0 ? "No decisions yet" : "No decisions of this kind"}
            description={data.counts.all === 0 ? "Approvals and change requests will be listed here." : "Try another filter."}
          />
        ) : (
          <>
            <TableWrap>
              <Table className="min-w-[760px]">
                <THead>
                  <Th>Deliverable</Th>
                  <Th>Project</Th>
                  <Th>Decision</Th>
                  <Th>By</Th>
                  <Th>Comment</Th>
                  <Th>Date</Th>
                </THead>
                <tbody>
                  {data.history.items.map((row) => (
                    <Tr key={row.id}>
                      <Td className="font-medium text-ink">
                        <Link href={`${data.base}/deliverables/${row.deliverableId}`} className="whitespace-nowrap hover:text-cyan-300">
                          {row.title}
                        </Link>
                        <span className="ml-1.5 text-xs text-ink-faint">v{row.version}</span>
                      </Td>
                      <Td className="whitespace-nowrap">{row.projectName}</Td>
                      <Td>
                        {row.decision === "approved" ? <Badge tone="emerald">Approved</Badge> : <Badge tone="red">Changes requested</Badge>}
                      </Td>
                      <Td>
                        {row.by && (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <Avatar user={row.by} size="xs" /> {row.byYou ? "You" : row.by.name}
                          </span>
                        )}
                      </Td>
                      <Td className="max-w-[280px]">
                        {row.comment ? <span className="line-clamp-2 text-ink-secondary">{row.comment}</span> : <span className="text-ink-faint">No comment</span>}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <time dateTime={row.decidedAt} title={formatDateTime(row.decidedAt)}>
                          {formatDate(row.decidedAt)}
                        </time>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination
              page={data.history.page}
              pageCount={data.history.pageCount}
              total={data.history.total}
              pageSize={data.history.pageSize}
              hrefFor={(page) => hrefFor(data.decision, page)}
            />
          </>
        )}
      </Card>
    </>
  );
}
