import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, Eye, EyeOff, Settings } from "lucide-react";
import { formatDateRange } from "@/lib/utils";
import { getProjectHeader } from "@/lib/data/queries/projects";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Breadcrumbs, ProgressBar, Skeleton } from "@/components/ui/misc";
import { NavTabs } from "@/components/ui/nav-tabs";
import { FlashToast } from "@/components/ui/flash-toast";
import { ProjectIcon } from "@/components/projects/project-icon";

export default function ProjectLayout({ children, params }: LayoutProps<"/w/[org]/projects/[projectId]">) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <ProjectHeader params={params} />
      </Suspense>
      <div className="mt-5">{children}</div>
    </>
  );
}

async function ProjectHeader({ params }: { params: Promise<{ org: string; projectId: string }> }) {
  const { org, projectId } = await params;
  const header = await getProjectHeader(org, projectId);
  const { summary, projectBase } = header;

  const tabs = [
    { href: projectBase, label: "Overview", exact: true },
    { href: `${projectBase}/tasks`, label: "Tasks", count: header.counts.tasks },
    { href: `${projectBase}/milestones`, label: "Milestones", count: header.counts.milestones },
    { href: `${projectBase}/deliverables`, label: "Deliverables", count: header.counts.deliverables },
    { href: `${projectBase}/files`, label: "Files", count: header.counts.files },
    { href: `${projectBase}/activity`, label: "Activity" },
    ...(header.can.manage ? [{ href: `${projectBase}/settings`, label: "Settings" }] : []),
  ];

  return (
    <section className="pt-7">
      <FlashToast messages={{ created: "Project created. Add milestones and tasks next.", saved: "Project saved." }} />
      <Breadcrumbs items={[{ label: "Projects", href: `${header.base}/projects` }, { label: summary.name }]} />
      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <ProjectIcon icon={summary.icon} hue={summary.client?.hue} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-ink">{summary.name}</h1>
              <ProjectStatusBadge status={summary.status} />
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
              <span>
                {summary.client ? (
                  <Link href={`${header.base}/clients/${summary.client.id}`} className="text-ink-secondary hover:text-cyan-300">
                    {summary.client.name}
                  </Link>
                ) : (
                  "Internal project"
                )}
              </span>
              {summary.client && (
                <span className={`inline-flex items-center gap-1.5 ${summary.sharedWithClient ? "text-cyan-300" : "text-ink-faint"}`}>
                  {summary.sharedWithClient ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                  {summary.sharedWithClient ? "Shared with client" : "Not shared with client"}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} className="text-ink-faint" aria-hidden="true" />
                {formatDateRange(summary.startAt, summary.dueAt)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <div className="w-48">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-ink-faint">Progress</span>
              <span className="tabular-nums text-ink-secondary">{summary.progress}%</span>
            </div>
            <ProgressBar value={summary.progress} label="Project progress" />
          </div>
          <AvatarStack users={summary.members} max={5} size="sm" />
          {header.can.manage && (
            <Link href={`${projectBase}/settings`} className={buttonClasses({ variant: "outline" })}>
              <Settings size={16} /> Edit
            </Link>
          )}
        </div>
      </div>
      <NavTabs tabs={tabs} label="Project sections" className="mt-6" />
    </section>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-4 pt-7" aria-busy="true">
      <Skeleton className="h-3 w-40" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
