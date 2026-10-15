import { Suspense } from "react";
import type { Metadata } from "next";
import { CircleAlert, CircleCheck, CircleSlash, Webhook } from "lucide-react";
import { firstParam, formatDateTime } from "@/lib/utils";
import { listWebhookEvents, type WebhookFilter } from "@/lib/data/queries/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, FilterChips, PageHeader, Pagination, Skeleton, TableSkeleton, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/misc";
import { ReplayEventButton } from "@/components/admin/admin-actions";

export const metadata: Metadata = { title: "Webhooks" };

export default function AdminWebhooksPage({ searchParams }: PageProps<"/admin/webhooks">) {
  return (
    <Suspense fallback={<WebhooksSkeleton />}>
      <Webhooks searchParams={searchParams} />
    </Suspense>
  );
}

const FILTER_LABELS: Record<WebhookFilter, string> = { all: "All", processed: "Processed", skipped: "Skipped", failed: "Failed" };

async function Webhooks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const data = await listWebhookEvents({ status: firstParam(query.status), page: firstParam(query.page) });
  const href = (status: WebhookFilter, page?: number) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (page && page > 1) params.set("page", String(page));
    return `/admin/webhooks${params.size ? `?${params}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Webhook events"
        description="Billing events from Stripe (/api/webhooks/stripe) and the simulated checkout (/api/webhooks/billing). Each is signature-checked, deduplicated by event ID and ordered by creation time."
        actions={data.replayCandidate && <ReplayEventButton providerEventId={data.replayCandidate.providerEventId} />}
      />
      <Card>
        <CardHeader
          icon={Webhook}
          title="Event log"
          description={
            data.replayCandidate
              ? `Replay resends ${data.replayCandidate.providerEventId} (${data.replayCandidate.eventType}) to show it is skipped as a duplicate.`
              : "Complete a test checkout in any workspace to create a replayable event."
          }
        />
        <div className="px-4 pb-4 sm:px-5">
          <FilterChips
            label="Filter by result"
            items={(Object.keys(FILTER_LABELS) as WebhookFilter[]).map((key) => ({
              label: FILTER_LABELS[key],
              count: data.counts[key],
              active: data.status === key,
              href: href(key),
            }))}
          />
        </div>
        {data.page.total === 0 ? (
          <EmptyState compact icon={Webhook} title="No events here" description="Events appear when the billing provider sends them or a test checkout completes." />
        ) : (
          <>
            <TableWrap>
              <Table className="min-w-[920px]">
                <THead>
                  <Th>Received</Th>
                  <Th>Event</Th>
                  <Th>Workspace</Th>
                  <Th>Result</Th>
                  <Th>Outcome</Th>
                </THead>
                <tbody>
                  {data.page.items.map((event) => (
                    <Tr key={event.id}>
                      <Td className="whitespace-nowrap align-top">
                        <span className="block text-ink-secondary">{formatDateTime(event.createdAt)}</span>
                        <span className="text-xs text-ink-faint">{event.when}</span>
                      </Td>
                      <Td className="align-top">
                        <span className="block font-mono text-xs text-ink">{event.eventType}</span>
                        <span className="block font-mono text-[11px] text-ink-faint">{event.providerEventId}</span>
                      </Td>
                      <Td className="whitespace-nowrap align-top">{event.workspace}</Td>
                      <Td className="align-top">
                        {event.status === "failed" ? (
                          <Badge tone="red">
                            <CircleAlert size={13} aria-hidden="true" /> Failed
                          </Badge>
                        ) : event.status === "skipped_duplicate" ? (
                          <Badge tone="slate">
                            <CircleSlash size={13} aria-hidden="true" /> Duplicate
                          </Badge>
                        ) : event.stale ? (
                          <Badge tone="amber">
                            <CircleSlash size={13} aria-hidden="true" /> Stale, ignored
                          </Badge>
                        ) : (
                          <Badge tone="emerald">
                            <CircleCheck size={13} aria-hidden="true" /> Processed
                          </Badge>
                        )}
                      </Td>
                      <Td className="align-top text-xs">
                        {event.outcome}
                        {event.eventCreatedAt && <span className="mt-0.5 block text-ink-faint">Created by provider {formatDateTime(event.eventCreatedAt)}</span>}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination
              page={data.page.page}
              pageCount={data.page.pageCount}
              total={data.page.total}
              pageSize={data.page.pageSize}
              hrefFor={(page) => href(data.status, page)}
            />
          </>
        )}
      </Card>
    </>
  );
}

function WebhooksSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="card">
        <TableSkeleton rows={5} />
      </div>
    </div>
  );
}
