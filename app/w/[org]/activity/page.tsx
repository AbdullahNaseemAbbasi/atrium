import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, SearchX } from "lucide-react";
import { firstParam } from "@/lib/utils";
import { ACTIVITY_TYPES, getActivityLog } from "@/lib/data/queries/activity";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, FilterChips, PageHeader, Pagination, Skeleton } from "@/components/ui/misc";
import { ParamSelect } from "@/components/ui/interactive";
import { ActivityRow } from "@/components/activity/activity-row";

export const metadata: Metadata = { title: "Activity" };

type Search = Record<string, string | string[] | undefined>;

export default function ActivityPage({ params, searchParams }: PageProps<"/w/[org]/activity">) {
  return (
    <Suspense fallback={<ActivitySkeleton />}>
      <ActivityLog params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ActivityLog({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Search> }) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await getActivityLog(org, { project: firstParam(query.project), type: firstParam(query.type), page: firstParam(query.page) });
  const { filters } = data;

  const href = (patch: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { project: filters.project || undefined, type: filters.type || undefined, ...patch };
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const qs = next.toString();
    return `${data.base}/activity${qs ? `?${qs}` : ""}`;
  };
  const chips = [{ key: "", label: "Everything" }, ...Object.entries(ACTIVITY_TYPES).map(([key, meta]) => ({ key, label: meta.label }))].map((chip) => ({
    label: chip.label,
    count: data.typeCounts[chip.key || "all"] ?? 0,
    active: filters.type === chip.key,
    href: href({ type: chip.key || undefined, page: undefined }),
  }));

  return (
    <>
      <PageHeader
        title="Activity"
        description={data.scopeNote ?? "A full log of what happened across your projects, newest first. Internal events never reach clients."}
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips label="Filter by type" items={chips} />
          <ParamSelect
            param="project"
            label="Filter by project"
            className="lg:w-60"
            options={[
              { value: "", label: "All projects" },
              ...(data.hasWorkspaceEvents ? [{ value: "workspace", label: "Workspace (team & clients)" }] : []),
              ...data.projects.map((project) => ({ value: project.id, label: project.name })),
            ]}
          />
        </div>
      </Card>

      <Card className="mt-4">
        {data.groups.length === 0 ? (
          data.totalVisible === 0 ? (
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Uploads, reviews, comments and task updates appear here as your team works."
              action={
                <Link href={`${data.base}/projects`} className={buttonClasses({ variant: "secondary" })}>
                  Go to projects
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="Nothing matches these filters"
              description="Try another type or project."
              action={
                <Link href={`${data.base}/activity`} className={buttonClasses({ variant: "secondary" })}>
                  Clear filters
                </Link>
              }
            />
          )
        ) : (
          <>
            <div className="px-4 pt-2 sm:px-5">
              {data.groups.map((group) => (
                <section key={group.key} aria-labelledby={`day-${group.key}`} className="pb-2">
                  <h2
                    id={`day-${group.key}`}
                    className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-surface/95 px-4 py-3 text-xs font-medium text-ink-faint backdrop-blur sm:-mx-5 sm:px-5"
                  >
                    {group.label}
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                    <span className="font-normal">
                      {group.items.length} {group.items.length === 1 ? "event" : "events"}
                    </span>
                  </h2>
                  <ol className="relative">
                    <span className="absolute bottom-4 left-[17px] top-4 w-px bg-gradient-to-b from-cyan-400/30 to-transparent" aria-hidden="true" />
                    {group.items.map((item) => (
                      <li key={item.id} className="border-b border-white/[0.04] last:border-0">
                        <ActivityRow item={item} />
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
            <div className="pt-2">
              <Pagination
                page={data.pagination.page}
                pageCount={data.pagination.pageCount}
                total={data.pagination.total}
                pageSize={data.pagination.pageSize}
                hrefFor={(page) => href({ page: page > 1 ? String(page) : undefined })}
              />
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function ActivitySkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[72px] rounded-2xl" />
      <div className="card mt-4 space-y-4 p-5">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
