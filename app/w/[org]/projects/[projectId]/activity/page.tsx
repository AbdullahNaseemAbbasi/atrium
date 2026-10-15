import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Eye, EyeOff, Lock } from "lucide-react";
import { cn, firstParam } from "@/lib/utils";
import { getProjectActivity } from "@/lib/data/queries/project-tabs";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, FilterChips, FormNote, Skeleton } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Project activity" };

export default function ProjectActivityPage({ params, searchParams }: PageProps<"/w/[org]/projects/[projectId]/activity">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <Skeleton className="mb-4 h-8 w-80 max-w-full" />
          <Skeleton className="h-[480px] rounded-2xl" />
        </div>
      }
    >
      <ProjectActivity params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProjectActivity({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org, projectId }, query] = await Promise.all([params, searchParams]);
  const data = await getProjectActivity(org, projectId, { show: firstParam(query.show) });
  const chips = (
    [
      ["all", "Everything"],
      ["client", "Client can see"],
      ["internal", "Internal only"],
    ] as const
  ).map(([key, label]) => ({ label, count: data.counts[key], active: data.show === key, href: key === "all" ? `${data.projectBase}/activity` : `${data.projectBase}/activity?show=${key}` }));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips label="Filter activity" items={chips} />
        <p className="flex items-center gap-4 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <Eye size={13} className="text-cyan-300" aria-hidden="true" /> On the client portal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock size={13} className="text-amber-300" aria-hidden="true" /> Team only
          </span>
        </p>
      </div>

      {data.hasClient && !data.sharedWithClient && (
        <FormNote icon={EyeOff} className="mb-4">
          This project isn&apos;t shared with the client, so they see none of this yet. Client-visible events appear on their portal once you
          share it.
        </FormNote>
      )}

      <Card className="p-4 sm:p-6">
        {data.groups.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={data.counts.all === 0 ? "No activity yet" : "Nothing in this view"}
            description={
              data.counts.all === 0
                ? "Uploads, comments, approvals and completed tasks are recorded here as they happen."
                : "Switch to Everything to see the full timeline."
            }
          />
        ) : (
          <div className="space-y-8">
            {data.groups.map((group) => (
              <section key={group.key} aria-labelledby={`day-${group.key}`}>
                <h2 id={`day-${group.key}`} className="mb-2 flex items-center gap-3 text-xs font-medium text-ink-faint">
                  {group.label}
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  <span>
                    {group.items.length} {group.items.length === 1 ? "event" : "events"}
                  </span>
                </h2>
                <ol className="relative">
                  <span className="absolute bottom-3 left-[71px] top-3 hidden w-px bg-line sm:block" aria-hidden="true" />
                  {group.items.map((item) => {
                    const internal = item.visibility === "internal";
                    return (
                      <li key={item.id} className="relative flex items-start gap-3 py-2.5">
                        <time dateTime={item.createdAt} className="hidden w-11 flex-none pt-2 text-right text-xs tabular-nums text-ink-faint sm:block">
                          {item.time}
                        </time>
                        {item.actor ? (
                          <Avatar user={item.actor} size="sm" ring className="z-10" />
                        ) : (
                          <span className="z-10 h-8 w-8 flex-none rounded-full bg-surface-raised" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1 pt-1">
                          <p className="text-sm text-ink-muted">
                            <span className="text-ink">{item.actor?.name ?? "Someone"}</span> {item.action}{" "}
                            {item.href ? (
                              <Link href={item.href} className="font-medium text-cyan-300 hover:text-cyan-200">
                                {item.targetLabel}
                              </Link>
                            ) : (
                              <span className="font-medium text-ink-secondary">{item.targetLabel}</span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-faint sm:hidden">{item.when}</p>
                        </div>
                        <span
                          className={cn(
                            "mt-1 inline-flex flex-none items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
                            internal ? "border-amber-500/20 bg-amber-500/[0.06] text-amber-200" : "border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-200",
                          )}
                          title={internal ? "Only your team sees this" : "Shown on the client portal"}
                        >
                          {internal ? <Lock size={11} aria-hidden="true" /> : <Eye size={11} aria-hidden="true" />}
                          <span className="hidden sm:inline">{internal ? "Internal" : "Client"}</span>
                          <span className="sr-only sm:hidden">{internal ? "Internal" : "Visible to client"}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
