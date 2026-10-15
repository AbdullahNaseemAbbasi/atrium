import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Clock3, Eye, EyeOff, FolderPlus, Plus, SquareCheckBig } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { listProjects, PROJECT_SORTS } from "@/lib/data/queries/projects";
import type { ProjectSummary } from "@/lib/data/views";
import { Card } from "@/components/ui/card";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, FilterChips, PageHeader, Pagination, ProgressBar, Skeleton } from "@/components/ui/misc";
import { ParamSelect, SearchInput } from "@/components/ui/interactive";
import { ProjectIcon } from "@/components/projects/project-icon";

export const metadata: Metadata = { title: "Projects" };

type Search = Record<string, string | string[] | undefined>;

export default function ProjectsPage({ params, searchParams }: PageProps<"/w/[org]/projects">) {
  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      <Projects params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function Projects({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Search> }) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  const data = await listProjects(org, {
    q: one(query.q),
    status: one(query.status),
    client: one(query.client),
    sort: one(query.sort),
    page: one(query.page),
  });
  const { filters } = data;

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q: filters.q, status: filters.status === "all" ? undefined : filters.status, client: filters.client, sort: filters.sort === "updated" ? undefined : filters.sort, ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    const qs = next.toString();
    return `${data.base}/projects${qs ? `?${qs}` : ""}`;
  };

  const chips = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "planning", label: "Planning" },
    { key: "in_progress", label: "In progress" },
    { key: "in_review", label: "In review" },
    { key: "on_hold", label: "On hold" },
    { key: "completed", label: "Completed" },
  ].map((chip) => ({
    label: chip.label,
    count: data.counts[chip.key] ?? 0,
    active: filters.status === chip.key,
    href: href({ status: chip.key === "all" ? undefined : chip.key, page: undefined }),
  }));

  return (
    <>
      <PageHeader
        title="Projects"
        description={data.scopeNote ?? "Client work and internal projects."}
        actions={
          data.canCreate && (
            <Link href={`${data.base}/projects/new`} className={buttonClasses({ size: "lg" })}>
              <Plus size={17} /> New project
            </Link>
          )
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput placeholder="Search projects or clients…" className="lg:w-80" />
          <div className="grid flex-1 grid-cols-2 gap-3 sm:flex sm:justify-end">
            <ParamSelect
              param="client"
              label="Filter by client"
              className="sm:w-52"
              options={[
                { value: "", label: "All clients" },
                ...data.clients.map((client) => ({ value: client.id, label: client.name })),
                ...(data.hasInternal ? [{ value: "internal", label: "Internal projects" }] : []),
              ]}
            />
            <ParamSelect
              param="sort"
              label="Sort projects"
              className="sm:w-56"
              options={Object.entries(PROJECT_SORTS).map(([value, label]) => ({ value: value === "updated" ? "" : value, label: `Sort: ${label}` }))}
            />
          </div>
        </div>
        <div className="mt-4">
          <FilterChips label="Filter by status" items={chips} />
        </div>
      </Card>

      {data.page.total === 0 ? (
        <Card className="mt-4">
          {data.totalVisible === 0 ? (
            <EmptyState
              icon={FolderPlus}
              title="No projects yet"
              description={data.canCreate ? "Create your first project to plan milestones, assign tasks and share work with a client." : "You haven't been added to a project yet. Ask a manager to add you."}
              action={
                data.canCreate && (
                  <Link href={`${data.base}/projects/new`} className={buttonClasses()}>
                    <Plus size={16} /> New project
                  </Link>
                )
              }
            />
          ) : (
            <EmptyState
              icon={FolderPlus}
              title="No projects match these filters"
              description="Try a different status, client or search term."
              action={
                <Link href={`${data.base}/projects`} className={buttonClasses({ variant: "secondary" })}>
                  Clear filters
                </Link>
              }
            />
          )}
        </Card>
      ) : (
        <>
          <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.page.items.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} href={`${data.base}/projects/${project.id}`} />
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Pagination
              page={data.page.page}
              pageCount={data.page.pageCount}
              total={data.page.total}
              pageSize={data.page.pageSize}
              hrefFor={(page) => href({ page: String(page) })}
            />
          </div>
        </>
      )}
    </>
  );
}

function ProjectCard({ project, href }: { project: ProjectSummary; href: string }) {
  return (
    <Link
      href={href}
      className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/25 hover:shadow-[0_16px_50px_rgba(0,0,0,0.35),0_0_0_1px_rgba(34,211,238,0.06)]"
    >
      <div className="flex items-start gap-3">
        <ProjectIcon icon={project.icon} hue={project.client?.hue} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-ink transition group-hover:text-cyan-200">{project.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
            {project.client?.name ?? "Internal project"}
            {project.client && (
              <span className="inline-flex items-center gap-1" title={project.sharedWithClient ? "Shared with client" : "Not shared with client"}>
                ·{" "}
                {project.sharedWithClient ? (
                  <>
                    <Eye size={12} aria-hidden="true" /> Shared
                  </>
                ) : (
                  <>
                    <EyeOff size={12} aria-hidden="true" /> Private
                  </>
                )}
              </span>
            )}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <p className="mt-4 line-clamp-2 min-h-[2.5rem] text-sm text-ink-muted">{project.description}</p>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-ink-faint">Progress</span>
          <span className="tabular-nums text-ink-secondary">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} label={`${project.name} progress`} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <SquareCheckBig size={14} className="text-ink-faint" aria-hidden="true" />
          {project.openTasks} open
        </span>
        {project.overdueTasks > 0 && (
          <span className="inline-flex items-center gap-1.5 text-red-300">
            <AlertTriangle size={14} aria-hidden="true" />
            {project.overdueTasks} overdue
          </span>
        )}
        {project.pendingApprovals > 0 && (
          <span className="inline-flex items-center gap-1.5 text-amber-300">
            <Clock3 size={14} aria-hidden="true" />
            {project.pendingApprovals} in review
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
        <AvatarStack users={project.members} max={4} size="xs" />
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <CalendarDays size={14} className="text-ink-faint" aria-hidden="true" />
          {project.dueAt ? `Due ${formatDate(project.dueAt)}` : "No due date"}
        </span>
      </div>
    </Link>
  );
}

function ProjectsSkeleton() {
  return (
    <div aria-busy="true">
      <div className="space-y-3 pb-5 pt-7">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-[120px] rounded-2xl" />
      <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[260px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
