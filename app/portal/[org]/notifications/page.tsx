import { Suspense } from "react";
import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { firstParam } from "@/lib/utils";
import { getPortalNotifications } from "@/lib/data/queries/portal";
import { Card } from "@/components/ui/card";
import { EmptyState, FilterChips, PageHeader, Pagination, Skeleton, TableSkeleton } from "@/components/ui/misc";
import { MarkAllReadButton, NotificationList } from "@/components/portal/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default function PortalNotificationsPage({ params, searchParams }: PageProps<"/portal/[org]/notifications">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="space-y-3 pb-5 pt-7">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="card">
            <TableSkeleton rows={6} />
          </div>
        </div>
      }
    >
      <Notifications params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Notifications({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getPortalNotifications(org, { filter: firstParam(query.filter), page: firstParam(query.page) });
  const href = `${data.base}/notifications`;
  const hrefFor = (filter: string, page?: number) => {
    const next = new URLSearchParams();
    if (filter !== "all") next.set("filter", filter);
    if (page && page > 1) next.set("page", String(page));
    return `${href}${next.size ? `?${next}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="New versions to review, replies from the team and finished milestones."
        actions={<MarkAllReadButton orgSlug={data.orgSlug} unread={data.counts.unread} />}
      />
      <div className="mb-4">
        <FilterChips
          label="Filter notifications"
          items={[
            { label: "All", count: data.counts.all, active: data.filter === "all", href: hrefFor("all") },
            { label: "Unread", count: data.counts.unread, active: data.filter === "unread", href: hrefFor("unread") },
          ]}
        />
      </div>
      <Card className="overflow-hidden">
        {data.page.total === 0 ? (
          <EmptyState
            icon={BellOff}
            title={data.filter === "unread" ? "No unread notifications" : "No notifications yet"}
            description={
              data.filter === "unread"
                ? "You've read everything."
                : "You'll hear from us here when there's work to review or a reply on one of your comments."
            }
          />
        ) : (
          <>
            <NotificationList orgSlug={data.orgSlug} items={data.page.items} />
            {data.page.pageCount > 1 && (
              <div className="border-t border-line pt-4">
                <Pagination
                  page={data.page.page}
                  pageCount={data.page.pageCount}
                  total={data.page.total}
                  pageSize={data.page.pageSize}
                  hrefFor={(page) => hrefFor(data.filter, page)}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
