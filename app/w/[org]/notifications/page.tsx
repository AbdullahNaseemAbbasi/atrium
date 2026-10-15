import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, CheckCheck } from "lucide-react";
import { firstParam } from "@/lib/utils";
import { getNotificationsPage } from "@/lib/data/queries/notifications";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, FilterChips, PageHeader, Pagination, Skeleton } from "@/components/ui/misc";
import { MarkAllReadButton, NotificationItem } from "@/components/activity/notification-list";

export const metadata: Metadata = { title: "Notifications" };

type Search = Record<string, string | string[] | undefined>;

export default function NotificationsPage({ params, searchParams }: PageProps<"/w/[org]/notifications">) {
  return (
    <Suspense fallback={<NotificationsSkeleton />}>
      <Notifications params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Notifications({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Search> }) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getNotificationsPage(org, { filter: firstParam(query.filter), page: firstParam(query.page) });
  const href = (filter: "all" | "unread", page?: number) => {
    const next = new URLSearchParams();
    if (filter === "unread") next.set("filter", "unread");
    if (page && page > 1) next.set("page", String(page));
    const qs = next.toString();
    return `${data.base}/notifications${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          data.counts.unread > 0
            ? `${data.counts.unread} unread in ${data.orgName}.`
            : `No unread notifications in ${data.orgName}.`
        }
        actions={<MarkAllReadButton orgSlug={data.orgSlug} unread={data.counts.unread} />}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <FilterChips
              label="Filter notifications"
              items={[
                { label: "All", count: data.counts.all, active: data.filter === "all", href: href("all") },
                { label: "Unread", count: data.counts.unread, active: data.filter === "unread", href: href("unread") },
              ]}
            />
            <Link href={`${data.base}/settings/profile`} className="text-xs text-ink-faint hover:text-cyan-300">
              Notification preferences
            </Link>
          </div>
  
          {data.groups.length === 0 ? (
            data.filter === "unread" && data.counts.all > 0 ? (
              <EmptyState
                icon={CheckCheck}
                title="No unread notifications"
                description="Older notifications are still under All."
                action={
                  <Link href={href("all")} className={buttonClasses({ variant: "secondary" })}>
                    Show all notifications
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={BellOff}
                title="No notifications yet"
                description="You'll be notified here when a client reviews your work, someone mentions you or you're assigned a task."
                action={
                  <Link href={data.base} className={buttonClasses({ variant: "secondary" })}>
                    Back to dashboard
                  </Link>
                }
              />
            )
          ) : (
            <>
              <div className="px-2 pb-2 sm:px-3">
                {data.groups.map((group) => (
                  <section key={group.key} aria-labelledby={`ntf-day-${group.key}`}>
                    <h2 id={`ntf-day-${group.key}`} className="flex items-center gap-3 px-3 pb-1.5 pt-4 text-xs font-medium text-ink-faint">
                      {group.label}
                      <span className="h-px flex-1 bg-line" aria-hidden="true" />
                    </h2>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <NotificationItem orgSlug={data.orgSlug} item={item} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <div className="pt-2">
                <Pagination
                  page={data.pagination.page}
                  pageCount={data.pagination.pageCount}
                  total={data.pagination.total}
                  pageSize={data.pagination.pageSize}
                  hrefFor={(page) => href(data.filter, page)}
                />
              </div>
            </>
          )}
        </Card>
        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">By type</p>
            <dl className="mt-3 divide-y divide-white/[0.05]">
              {data.byGroup.map((group) => (
                <div key={group.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <dt className="text-ink-muted">{group.label}</dt>
                  <dd className="flex items-center gap-2 tabular-nums">
                    {group.unread > 0 && <span className="rounded-md bg-cyan-500/15 px-1.5 py-0.5 text-[11px] text-cyan-200">{group.unread} new</span>}
                    <span className="text-ink-secondary">{group.total}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-5 text-sm text-ink-muted">
            <p className="font-semibold text-ink">What you&apos;re notified about</p>
            <p className="mt-2">
              You get notified when a client decides on work you sent, someone comments on your tasks, or work is assigned to you. Similar
              updates within ten minutes are bundled into one.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}

function NotificationsSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="card space-y-4 p-5 xl:mr-[336px]">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
